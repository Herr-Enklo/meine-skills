"""Orchestrierung: Scan (Dateisysteme + Carving) und Wiederherstellung.

Der ``Scanner`` fuehrt die gewaehlten Engines nacheinander aus und meldet
Fortschritt sowie jeden Fund ueber Callbacks – so kann die Oberflaeche die
Trefferliste live fuellen. Scheitert ein Teil (beschaedigte Partitionstabelle,
unlesbares Volume), laeuft der Rest weiter; der Grund landet in
``Scanner.warnings`` statt still zu verschwinden.

``extract``/``iter_chunks`` und ``recover`` schreiben die gefundenen Dateien in
einen getrennten Ausgabeordner; die Quelle bleibt unangetastet.
"""

from __future__ import annotations

import errno
import hashlib
import itertools
import json
import os
import zlib
from dataclasses import dataclass
from typing import Callable, Iterator, Optional

from . import carver, exfat, fat, lznt1, ntfs, usn
from .models import CancelCb, Finding, ProgressCb
from .sources import ByteSource

FindingCb = Callable[[Finding], None]

# Blockgroesse beim Schreiben grosser Funde (Videos, Archive), damit nicht die
# ganze Datei im Speicher liegt.
CHUNK = 8 * 1024 * 1024

# Protokoll der bereits geretteten Funde im Ausgabeordner (fuer die Fortsetzung).
MANIFEST = ".datenrettung.json"

# Vor dem Ueberspringen wird der Anfang jeder Datei mit der Quelle verglichen.
_VERIFY_BYTES = 16 * 1024
# Fingerabdruck der Quelle: Anfang und Ende (Partitionstabellen, Bootsektoren).
_FINGERPRINT_BYTES = 1024 * 1024

# Partitionstypen, die NTFS enthalten koennen (MBR 0x07, GPT "Basic data").
_NTFS_PARTITION_TYPES = {"0x07", "a2a0d0ebe5b9334487c068b6b72699c7"}

# Laengenbegrenzung fuer Dateinamen: NTFS/ext4 erlauben 255 Zeichen bzw. Byte je
# Namen; mit Reserve fuer ".part" und Nummernzusatz.
_MAX_NAME_CHARS = 180
_MAX_NAME_BYTES = 230


@dataclass
class ScanOptions:
    use_ntfs: bool = True         # geloeschte Dateien ueber die MFT finden
    use_fat: bool = True          # FAT/exFAT-Undelete (SD-Karten, USB-Sticks)
    use_carve: bool = True        # Dateien ueber Signaturen finden
    deleted_only: bool = True     # nur geloeschte Eintraege (sonst auch vorhandene)
    max_files: Optional[int] = None  # Obergrenze fuer Carving-Treffer
    recover_partial: bool = True  # unvollstaendige Dateien (ohne Ende) mitnehmen
    validate: bool = True         # Carving-Treffer per Struktur-Pruefung bestaetigen
    ntfs_orphan_scan: bool = False   # ganzen Datentraeger nach MFT-Eintraegen absuchen
    reconstruct_partitions: bool = False  # Volumes ueber Boot-Sektor-Suche rekonstruieren
    use_usn: bool = False         # USN-Journal auswerten (Namen geloeschter Dateien)
    # Carving nur im freien Speicher erkannter Dateisysteme. Belegte Bereiche
    # enthalten vorhandene Dateien – die liefert das Dateisystem ohnehin.
    carve_free_only: bool = True


class Scanner:
    def __init__(self, source: ByteSource, options: Optional[ScanOptions] = None):
        self.source = source
        self.options = options or ScanOptions()
        self.warnings: list[str] = []

    def _warn(self, text: str) -> None:
        if text not in self.warnings:
            self.warnings.append(text)

    def scan(self, progress_cb: Optional[ProgressCb] = None,
             should_cancel: Optional[CancelCb] = None,
             on_finding: Optional[FindingCb] = None) -> list[Finding]:
        opts = self.options
        src = self.source
        self.warnings = []
        findings: list[Finding] = []
        fs_starts: set[int] = set()        # Datenanfaenge der Dateisystem-Funde

        def cancelled() -> bool:
            return bool(should_cancel and should_cancel())

        def emit(f: Finding) -> None:
            findings.append(f)
            start = _data_start(f)
            if start is not None:
                fs_starts.add(start)
            if on_finding:
                on_finding(f)

        seen_records: set[int] = set()

        def emit_ntfs(f: Finding) -> None:
            # Denselben MFT-Eintrag nicht doppelt (Boot-Scan vs. Orphan-Scan).
            rec = f.extra.get("record_offset")
            if rec is not None:
                if rec in seen_records:
                    return
                seen_records.add(rec)
            emit(f)

        # Phase 0: Partitionen und Volumes bestimmen – ueber MBR/EBR/GPT und
        # optional ueber eine Boot-Sektor-Suche (rekonstruiert verlorene Tabellen).
        try:
            partitions = ntfs.partition_entries(src)
        except Exception as exc:
            partitions = []
            self._warn(f"Partitionstabelle nicht lesbar ({exc}); es wird ab Offset 0 gesucht.")
        offsets = list(dict.fromkeys([0] + [p.offset for p in partitions if p.offset > 0]))

        try:
            encrypted = ntfs.bitlocker_volumes(src)
        except Exception:
            encrypted = []
        for entry in encrypted:
            self._warn(
                f"Die Partition bei {_fmt_offset(entry.offset)} ist mit BitLocker "
                "verschlüsselt. Über das physische Laufwerk sind nur verschlüsselte "
                "Daten lesbar. Bitte das entsperrte Laufwerk (Laufwerksbuchstabe, "
                "z. B. C:) als Quelle wählen.")

        volumes: dict[int, Optional[ntfs.BootSector]] = {}
        recon_fat_offsets: set[int] = set()
        part_sizes = {p.offset: p.size for p in partitions}
        ntfs_types = {p.offset for p in partitions if p.ptype in _NTFS_PARTITION_TYPES}
        if opts.use_ntfs or opts.use_usn:
            for off in offsets:
                try:
                    oem = src.read(off, 512)[3:11]
                except Exception:
                    continue
                if oem == b"NTFS    ":
                    volumes.setdefault(off, None)
                elif off in ntfs_types and oem not in (b"EXFAT   ", b"-FVE-FS-"):
                    # Laut Tabelle NTFS, Boot-Sektor aber zerstoert: Kopie am Ende?
                    try:
                        boot, _ = ntfs.boot_with_backup(src, off, part_sizes.get(off))
                    except ntfs.NtfsError:
                        continue
                    volumes[off] = boot
                    self._warn(f"Der Boot-Sektor der Partition bei {_fmt_offset(off)} ist "
                               "zerstört; verwendet wird die Kopie am Volume-Ende.")

        if opts.reconstruct_partitions and not cancelled():
            try:
                for vinfo in ntfs.reconstruct_volumes(
                        src, thorough=True, progress_cb=progress_cb,
                        should_cancel=should_cancel):
                    if vinfo.fs_type == "ntfs":
                        volumes[vinfo.offset] = vinfo.boot
                    else:
                        recon_fat_offsets.add(vinfo.offset)
            except Exception as exc:
                self._warn(f"Partitionsrekonstruktion abgebrochen: {exc}")

        # Phase 1: jedes NTFS-Volume ueber seine MFT durchsuchen.
        ntfs_info: dict[int, dict] = {}
        geometries: list[ntfs.VolumeGeometry] = []
        for vol_off in sorted(volumes):
            if cancelled():
                break
            try:
                boot = volumes[vol_off]
                if boot is None:
                    boot, from_backup = ntfs.boot_with_backup(src, vol_off, part_sizes.get(vol_off))
                    if from_backup:
                        self._warn(f"Der Boot-Sektor des NTFS-Volumes bei {_fmt_offset(vol_off)} "
                                   "ist beschädigt; verwendet wird die Kopie am Volume-Ende.")
            except ntfs.NtfsError as exc:
                self._warn(f"NTFS-Volume bei {_fmt_offset(vol_off)} übersprungen: {exc}.")
                continue
            volumes[vol_off] = boot
            geometries.append(ntfs.VolumeGeometry(
                vol_off, boot.total_sectors * boot.bytes_per_sector,
                boot.cluster_size, boot.record_size))
            info: dict = {}
            ntfs_info[vol_off] = info
            if not opts.use_ntfs:
                continue
            try:
                for f in ntfs.scan_ntfs(src, vol_off, progress_cb, should_cancel,
                                        deleted_only=opts.deleted_only, boot=boot,
                                        warnings=self.warnings, info=info):
                    emit_ntfs(f)
            except Exception as exc:
                self._warn(f"NTFS-Volume bei {_fmt_offset(vol_off)} nicht auswertbar: {exc}")

        # Phase 2: MFT-Eintraege ueber den ganzen Datentraeger (findet auch nach
        # Formatierung/Boot-Schaden). Jeder Eintrag bekommt die Geometrie des
        # Volumes, in dem er liegt.
        if opts.use_ntfs and opts.ntfs_orphan_scan and not cancelled():
            try:
                for f in ntfs.scan_orphan_mft(
                        src, progress_cb=progress_cb, should_cancel=should_cancel,
                        deleted_only=opts.deleted_only, volumes=geometries):
                    emit_ntfs(f)
            except Exception as exc:
                self._warn(f"Suche nach MFT-Einträgen abgebrochen: {exc}")

        # Phase 2a: USN-Journal auswerten (Namen geloeschter Dateien), an jedem
        # bekannten NTFS-Volume – auch an rekonstruierten.
        if opts.use_usn and not cancelled():
            for off in sorted(volumes):
                if cancelled() or volumes[off] is None:
                    continue
                try:
                    for f in usn.scan_usn(src, off, only_delete=opts.deleted_only,
                                          progress_cb=progress_cb,
                                          should_cancel=should_cancel,
                                          allow_carve=False, boot=volumes[off],
                                          record_hint=ntfs_info.get(off, {}).get("usn_record")):
                        emit(f)
                except Exception as exc:
                    self._warn(f"USN-Journal bei {_fmt_offset(off)} nicht lesbar: {exc}")

        # Phase 2b: FAT/exFAT-Undelete an allen Partitionsanfaengen (und an
        # rekonstruierten Volumes, falls die Tabelle fehlt). Die Belegungskarten
        # dienen spaeter dem Carving.
        alloc_maps: list[tuple[int, int, Callable[[int], Optional[bool]]]] = []
        for vol_off, boot in volumes.items():
            bitmap = ntfs_info.get(vol_off, {}).get("bitmap")
            if boot is not None and bitmap is not None:
                alloc_maps.append((vol_off, vol_off + boot.total_sectors * boot.bytes_per_sector,
                                   bitmap.is_allocated_offset))
        for off in list(dict.fromkeys(offsets + sorted(recon_fat_offsets))):
            if cancelled():
                break
            try:
                if fat.is_fat(src, off):
                    boot_fat = fat.FatBoot(src.read(off, 512), off)
                    table = fat.FatTable(src, boot_fat)
                    alloc_maps.append((off, off + boot_fat.total_sectors * boot_fat.bytes_per_sector,
                                       table.is_allocated_offset))
                    if opts.use_fat:
                        for f in fat.scan_fat(src, off, deleted_only=opts.deleted_only,
                                              progress_cb=progress_cb,
                                              should_cancel=should_cancel,
                                              warnings=self.warnings):
                            emit(f)
                elif exfat.is_exfat(src, off):
                    boot_ex = exfat.ExfatBoot(src.read(off, 512), off)
                    vol = exfat.ExfatVolume(src, boot_ex)
                    alloc_maps.append((off, off + boot_ex.volume_length * boot_ex.bytes_per_sector,
                                       vol.is_allocated_offset))
                    if opts.use_fat:
                        for f in exfat.scan_exfat(src, off, deleted_only=opts.deleted_only,
                                                  progress_cb=progress_cb,
                                                  should_cancel=should_cancel,
                                                  warnings=self.warnings):
                            emit(f)
            except Exception as exc:
                self._warn(f"FAT/exFAT-Volume bei {_fmt_offset(off)} nicht auswertbar: {exc}")

        # Phase 3: Carving (findet auch ohne intaktes Dateisystem).
        if opts.use_carve and not cancelled():
            locked = [(e.offset, e.offset + e.size) for e in encrypted if e.size]
            free_only = opts.carve_free_only

            def skip(offset: int) -> bool:
                if offset in fs_starts:
                    return True                 # schon per Dateisystem gefunden
                for lo, hi in locked:
                    if lo <= offset < hi:
                        return True             # verschluesselt: nur Zufallsdaten
                if free_only:
                    for lo, hi, allocated in alloc_maps:
                        if lo <= offset < hi:
                            return bool(allocated(offset))
                return False

            try:
                for f in carver.carve(src, progress_cb=progress_cb,
                                      should_cancel=should_cancel,
                                      max_files=opts.max_files,
                                      recover_partial=opts.recover_partial,
                                      validate=opts.validate, skip=skip):
                    emit(f)
            except Exception as exc:
                self._warn(f"Carving abgebrochen: {exc}")

        return findings


def _fmt_offset(offset: int) -> str:
    mib = offset / (1024 * 1024)
    return f"{mib:,.1f} MiB".replace(",", ".") if offset else "Anfang des Datenträgers"


def _data_start(f: Finding) -> Optional[int]:
    """Physischer Anfang der Daten eines Dateisystem-Funds (fuer Dubletten)."""
    extra = f.extra
    if f.kind == "ntfs":
        runs = extra.get("data_runs") or []
        if runs and runs[0][0] is not None:
            return extra["base_offset"] + runs[0][0] * extra["cluster_size"]
        return None
    if f.kind in ("fat", "exfat"):
        runs = extra.get("runs")
        return runs[0][0] if runs else f.offset
    return None


# -- Lesen der Funde -----------------------------------------------------------

def iter_chunks(source: ByteSource, finding: Finding,
                chunk_size: int = CHUNK) -> Iterator[bytes]:
    """Liefert die Bytes eines Funds blockweise aus der Quelle.

    So lassen sich auch grosse Funde (Videos, Archive) schreiben, ohne sie
    komplett im Speicher zu halten.
    """
    extra = finding.extra
    if finding.kind == "carve":
        yield from _iter_range(source, finding.offset, finding.size, chunk_size)
        return

    if finding.kind in ("fat", "exfat"):
        runs = extra.get("runs")
        if runs:
            yield from _iter_byte_runs(source, runs, finding.size, chunk_size)
        else:
            yield from _iter_range(source, finding.offset, finding.size, chunk_size)
        return

    # USN-Funde tragen keinen Inhalt, nur Metadaten -> als Textnotiz ausgeben.
    if finding.kind == "usn":
        lines = [
            "Datei laut USN-Journal",
            f"Name:         {extra.get('usn_name', '')}",
            f"Zeit:         {extra.get('modified') or 'unbekannt'}",
            f"Grund:        {extra.get('reason', '')}",
            f"MFT-Referenz: {extra.get('usn_ref', '')}",
        ]
        yield ("\n".join(lines) + "\n").encode("utf-8")
        return

    if finding.kind == "ntfs":
        real_size = extra.get("real_size", finding.size)
        resident = extra.get("resident_data")
        if resident is not None:
            yield resident[:real_size]
            return
        runs = extra.get("data_runs", [])
        if extra.get("compressed"):
            yield from _iter_compressed(source, runs, extra["cluster_size"],
                                        extra["base_offset"], real_size,
                                        extra.get("cu_clusters", 16), chunk_size)
            return
        yield from _iter_runs(source, runs, extra["cluster_size"], extra["base_offset"],
                              real_size, chunk_size)
        return

    raise ValueError(f"unbekannter Fundtyp: {finding.kind}")


def extract(source: ByteSource, finding: Finding) -> bytes:
    """Liest die Bytes eines Funds vollstaendig in den Speicher."""
    return b"".join(iter_chunks(source, finding))


def _iter_range(source: ByteSource, offset: int, length: int,
                chunk_size: int) -> Iterator[bytes]:
    pos = offset
    end = offset + length
    while pos < end:
        data = source.read(pos, min(chunk_size, end - pos))
        if not data:
            break
        yield data
        pos += len(data)


def _iter_byte_runs(source: ByteSource, runs, size: int, chunk_size: int) -> Iterator[bytes]:
    remaining = size
    for offset, length in runs:
        if remaining <= 0:
            break
        take = min(length, remaining)
        for data in _iter_range(source, offset, take, chunk_size):
            yield data
            remaining -= len(data)


def _iter_runs(source: ByteSource, runs, cluster_size: int, base_offset: int,
               real_size: int, chunk_size: int) -> Iterator[bytes]:
    remaining = real_size
    for lcn, count in runs:
        if remaining <= 0:
            break
        take = min(count * cluster_size, remaining)
        if lcn is None:                       # sparse: Nullen
            while take > 0:
                n = min(chunk_size, take)
                yield bytes(n)
                take -= n
                remaining -= n
        else:
            for data in _iter_range(source, base_offset + lcn * cluster_size,
                                    take, chunk_size):
                yield data
                remaining -= len(data)


def _read_clusters(source: ByteSource, lcns: list[int], cluster_size: int,
                   base_offset: int) -> bytes:
    out = bytearray()
    for _key, group in itertools.groupby(enumerate(lcns), key=lambda p: p[1] - p[0]):
        run = [lcn for _i, lcn in group]
        out += source.read(base_offset + run[0] * cluster_size, len(run) * cluster_size)
    return bytes(out)


def _iter_compressed(source: ByteSource, runs, cluster_size: int, base_offset: int,
                     real_size: int, cu_clusters: int, chunk_size: int) -> Iterator[bytes]:
    """Entpackt eine NTFS-komprimierte Datei Einheit fuer Einheit (LZNT1).

    Je Kompressionseinheit (meist 16 Cluster) gilt: alle Cluster belegt =
    unkomprimiert gespeichert, alle sparse = Nullen, sonst stehen in den
    belegten Clustern die komprimierten Daten.
    """
    def clusters():
        for lcn, count in runs:
            for k in range(count):
                yield None if lcn is None else lcn + k

    unit_bytes = cu_clusters * cluster_size
    remaining = real_size
    it = clusters()
    while remaining > 0:
        unit = list(itertools.islice(it, cu_clusters))
        if not unit:
            break
        real = [c for c in unit if c is not None]
        if not real:
            data = bytes(len(unit) * cluster_size)
        elif len(real) == len(unit):
            data = _read_clusters(source, real, cluster_size, base_offset)
        else:
            raw = _read_clusters(source, real, cluster_size, base_offset)
            try:
                data = lznt1.decompress(raw, unit_bytes)
            except lznt1.Lznt1Error:
                data = bytes(unit_bytes)      # beschaedigte Einheit: Nullen statt Abbruch
        take = min(len(data), remaining)
        yield data[:take]
        remaining -= take


# -- Wiederherstellung ---------------------------------------------------------

def finding_key(f: Finding) -> str:
    """Eindeutige Kennung eines Funds fuer die Fortsetzung."""
    return f"{f.kind}:{f.offset}:{f.size}:{f.name}"


def recover(source: ByteSource, findings: list[Finding], output_dir: str,
            progress_cb: Optional[Callable[[int, int, str], None]] = None,
            should_cancel: Optional[CancelCb] = None,
            skip_existing: bool = True) -> tuple[int, int, list[str]]:
    """Schreibt die uebergebenen Funde in ``output_dir``.

    Ist ``skip_existing`` gesetzt, werden Funde uebersprungen, die ein frueherer
    Lauf schon geschrieben hat. Welche das sind, steht in einer kleinen
    Protokolldatei im Ausgabeordner, getrennt nach Quelle (Fingerabdruck aus
    Groesse, Anfang und Ende des Datentraegers). Uebersprungen wird nur, wenn
    die vorhandene Datei noch die protokollierte Laenge hat und ihr Anfang mit
    dem Fund in der Quelle uebereinstimmt; sonst wird unter neuem Namen
    geschrieben, nie ueberschrieben. Jede Datei entsteht erst als ``.part`` und
    wird zum Schluss umbenannt; ein Abbruch hinterlaesst keine halbe Datei. Die
    Aenderungszeit wird, soweit bekannt, vom Original uebernommen.

    Rueckgabe: ``(anzahl_geschrieben, anzahl_uebersprungen, liste_der_fehler)``.
    """
    os.makedirs(output_dir, exist_ok=True)
    # Das Protokoll wird immer gefuehrt; ``skip_existing`` entscheidet nur, ob
    # es beim Ueberspringen beachtet wird.
    book = _load_manifest(output_dir)
    ident = source_identity(source)
    entry = book["quellen"].setdefault(ident, {"pfad": getattr(source, "path", ""),
                                               "fertig": {}})
    done_map: dict = entry["fertig"]
    legacy: dict = book["alt"]
    # Namen, die schon einem protokollierten Fund gehoeren (egal welcher Quelle).
    claimed = {rec["datei"].lower() for src in book["quellen"].values()
               for rec in src["fertig"].values()}
    claimed |= {name.lower() for name in legacy.values()}
    # Nur Dateien, die schon vor diesem Lauf da waren, kommen als Altbestand in
    # Frage; was dieser Lauf selbst schreibt, gilt nie als "schon erledigt".
    preexisting = _listdir_lower(output_dir) if skip_existing else set()
    used: set[str] = set()
    ok = 0
    skipped = 0
    errors: list[str] = []
    total = len(findings)
    dirty = 0

    for i, finding in enumerate(findings):
        if should_cancel and should_cancel():
            break
        key = finding_key(finding)
        rec = done_map.get(key)
        if skip_existing:
            # Zuerst der Eintrag dieser Quelle. Aendert sich der Fingerabdruck
            # (etwa bei einem eingebundenen Laufwerk, auf das Windows schreibt),
            # zaehlen auch Eintraege anderer Quellen, aber nur nach derselben
            # Inhaltspruefung.
            candidates = [rec] if rec else [src["fertig"][key] for src in book["quellen"].values()
                                            if key in src["fertig"]]
            hit = next((r for r in candidates if r["datei"].lower() not in used
                        and _recorded_file_ok(source, finding, output_dir, r)), None)
            if hit is not None:
                if hit is not rec:
                    done_map[key] = dict(hit)
                    dirty += 1
                skipped += 1
                used.add(hit["datei"].lower())
                if progress_cb:
                    progress_cb(i + 1, total, hit["datei"])
                continue
        name = _fit_name(finding.name)
        if skip_existing and not rec:
            old = legacy.get(key)
            candidate = old or name
            low = candidate.lower()
            if (low in preexisting and low not in used and (old or low not in claimed)
                    and _legacy_file_ok(source, finding, os.path.join(output_dir, candidate))):
                # Von einer frueheren Programmversion geschrieben.
                path = os.path.join(output_dir, candidate)
                done_map[key] = {"datei": candidate,
                                 "bytes": os.path.getsize(_long_path(path)),
                                 "kopf": _file_head_crc(path)}
                used.add(low)
                skipped += 1
                dirty += 1
                if progress_cb:
                    progress_cb(i + 1, total, candidate)
                continue
        target = _unique_path(output_dir, name, used)
        part = target + ".part"
        try:
            written = 0
            head = bytearray()
            with open(_long_path(part), "wb") as fh:
                for chunk in iter_chunks(source, finding, CHUNK):
                    if should_cancel and should_cancel():
                        raise _Cancelled()
                    fh.write(chunk)
                    written += len(chunk)
                    if len(head) < _VERIFY_BYTES:
                        head += chunk[:_VERIFY_BYTES - len(head)]
            os.replace(_long_path(part), _long_path(target))
            _set_times(target, finding)
            ok += 1
            done_map[key] = {"datei": os.path.basename(target), "bytes": written,
                             "kopf": zlib.crc32(bytes(head))}
            dirty += 1
        except _Cancelled:
            _remove_quietly(part)
            break
        except OSError as exc:
            _remove_quietly(part)
            if exc.errno == errno.ENOSPC or getattr(exc, "winerror", None) in (39, 112):
                errors.append("Der Zieldatenträger ist voll – Wiederherstellung abgebrochen.")
                break
            errors.append(f"{finding.name}: {exc}")
        except Exception as exc:  # einzelne Fehler nicht den Rest abbrechen lassen
            _remove_quietly(part)
            errors.append(f"{finding.name}: {exc}")
        if dirty >= 50:
            _save_manifest(output_dir, book)
            dirty = 0
        if progress_cb:
            progress_cb(i + 1, total, os.path.basename(target))

    if dirty:
        _save_manifest(output_dir, book)
    return ok, skipped, errors


def source_identity(source) -> str:
    """Fingerabdruck einer Quelle: Groesse sowie erstes und letztes MiB.

    Haengt nicht am Pfad, damit eine Fortsetzung auch dann greift, wenn Windows
    die Platte nach einem Neustart unter anderer Nummer fuehrt.
    """
    size = getattr(source, "size", None) or 0
    digest = hashlib.sha256(str(size).encode("ascii"))
    digest.update(source.read(0, _FINGERPRINT_BYTES))
    if size > _FINGERPRINT_BYTES:
        tail = max(_FINGERPRINT_BYTES, size - _FINGERPRINT_BYTES)
        digest.update(source.read(tail, size - tail))
    return digest.hexdigest()[:32]


def _source_head(source, finding: Finding) -> Optional[bytes]:
    head = bytearray()
    try:
        for chunk in iter_chunks(source, finding, _VERIFY_BYTES):
            head += chunk
            if len(head) >= _VERIFY_BYTES:
                break
    except Exception:
        return None
    return bytes(head[:_VERIFY_BYTES])


def _file_head(path: str) -> Optional[bytes]:
    try:
        with open(_long_path(path), "rb") as fh:
            return fh.read(_VERIFY_BYTES)
    except OSError:
        return None


def _file_head_crc(path: str) -> int:
    head = _file_head(path)
    return zlib.crc32(head) if head is not None else -1


def _recorded_file_ok(source, finding: Finding, output_dir: str, rec: dict) -> bool:
    """Protokollierte Datei noch vorhanden, unveraendert und passend zur Quelle?"""
    path = os.path.join(output_dir, rec["datei"])
    try:
        if os.path.getsize(_long_path(path)) != rec["bytes"]:
            return False
    except OSError:
        return False
    head = _file_head(path)
    if head is None or zlib.crc32(head) != rec["kopf"]:
        return False
    expected = _source_head(source, finding)
    return expected is not None and zlib.crc32(expected) == rec["kopf"]


def _legacy_file_ok(source, finding: Finding, path: str) -> bool:
    """Datei ohne Protokolleintrag: nur bei gleicher Groesse und gleichem Anfang."""
    if finding.kind == "usn":
        return False
    try:
        if os.path.getsize(_long_path(path)) != finding.size:
            return False
    except OSError:
        return False
    head = _file_head(path)
    return head is not None and head == _source_head(source, finding)


def _listdir_lower(path: str) -> set[str]:
    try:
        return {name.lower() for name in os.listdir(_long_path(path))}
    except OSError:
        return set()


class _Cancelled(Exception):
    pass


def _long_path(path: str) -> str:
    """Unter Windows das ``\\\\?\\``-Praefix, damit Pfade ueber 260 Zeichen gehen."""
    if os.name != "nt":
        return path
    path = os.path.abspath(path)
    if path.startswith("\\\\?\\"):
        return path
    if path.startswith("\\\\"):
        return "\\\\?\\UNC\\" + path[2:]
    return "\\\\?\\" + path


def _exists(path: str) -> bool:
    return os.path.exists(_long_path(path))


def _remove_quietly(path: str) -> None:
    try:
        os.remove(_long_path(path))
    except OSError:
        pass


def _fit_name(name: str) -> str:
    """Kuerzt zu lange Namen in der Mitte; Nummer vorn und Endung bleiben."""
    if len(name) <= _MAX_NAME_CHARS and len(name.encode("utf-8")) <= _MAX_NAME_BYTES:
        return name
    base, ext = os.path.splitext(name)
    if len(ext) > 16:
        base, ext = name, ""
    head_len = 60
    tail_len = _MAX_NAME_CHARS - head_len - 1 - len(ext)
    while True:
        candidate = f"{base[:head_len]}~{base[-tail_len:]}{ext}" if tail_len > 0 else \
            f"{base[:head_len]}{ext}"
        if len(candidate.encode("utf-8")) <= _MAX_NAME_BYTES or tail_len <= 0:
            return candidate
        tail_len -= 8


def _unique_path(output_dir: str, name: str, used: set[str]) -> str:
    """Freier Zielpfad: weicht aus, wenn der Name vergeben ist."""
    base, ext = os.path.splitext(name)
    candidate = name
    counter = 1
    while candidate.lower() in used or _exists(os.path.join(output_dir, candidate)):
        candidate = f"{base}_{counter}{ext}"
        counter += 1
    used.add(candidate.lower())
    return os.path.join(output_dir, candidate)


def _set_times(path: str, finding: Finding) -> None:
    mtime = finding.extra.get("mtime_epoch")
    if not mtime:
        return
    atime = finding.extra.get("atime_epoch") or mtime
    try:
        os.utime(_long_path(path), (atime, mtime))
    except (OSError, OverflowError, ValueError):
        pass


def _empty_manifest() -> dict:
    return {"quellen": {}, "alt": {}}


def _load_manifest(output_dir: str) -> dict:
    """Liest das Protokoll. Version 1 kannte keine Quellen; ihre Eintraege
    gelten nur noch als Altbestand und werden vor dem Ueberspringen geprueft."""
    book = _empty_manifest()
    try:
        with open(_long_path(os.path.join(output_dir, MANIFEST)), encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return book
    if not isinstance(data, dict):
        return book
    if data.get("version") == 1:
        old = data.get("fertig")
        if isinstance(old, dict):
            book["alt"] = {k: v for k, v in old.items() if isinstance(v, str)}
        return book
    alt = data.get("alt")
    if isinstance(alt, dict):
        book["alt"] = {k: v for k, v in alt.items() if isinstance(v, str)}
    sources = data.get("quellen")
    if isinstance(sources, dict):
        for ident, entry in sources.items():
            if not isinstance(entry, dict) or not isinstance(entry.get("fertig"), dict):
                continue
            done = {k: rec for k, rec in entry["fertig"].items()
                    if isinstance(rec, dict) and isinstance(rec.get("datei"), str)
                    and isinstance(rec.get("bytes"), int) and isinstance(rec.get("kopf"), int)}
            book["quellen"][ident] = {"pfad": str(entry.get("pfad", "")), "fertig": done}
    return book


def _save_manifest(output_dir: str, book: dict) -> None:
    path = os.path.join(output_dir, MANIFEST)
    tmp = path + ".tmp"
    try:
        if os.name == "nt" and os.path.exists(path):
            _set_hidden(path, False)
        with open(_long_path(tmp), "w", encoding="utf-8") as fh:
            json.dump({"version": 2, "quellen": book["quellen"], "alt": book["alt"]},
                      fh, ensure_ascii=False)
        os.replace(_long_path(tmp), _long_path(path))
        if os.name == "nt":
            _set_hidden(path, True)
    except OSError:
        pass


def _set_hidden(path: str, hidden: bool) -> None:
    try:
        import ctypes
        attrs = 0x02 if hidden else 0x80        # FILE_ATTRIBUTE_HIDDEN / NORMAL
        ctypes.windll.kernel32.SetFileAttributesW(_long_path(path), attrs)
    except Exception:
        pass
