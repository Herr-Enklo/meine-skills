"""Orchestrierung: Scan (NTFS + Carving) und Wiederherstellung.

Der ``Scanner`` fuehrt die gewaehlten Engines nacheinander aus und meldet
Fortschritt sowie jeden Fund ueber Callbacks – so kann die Oberflaeche die
Trefferliste live fuellen. ``extract`` und ``recover`` schreiben die gefundenen
Dateien in einen getrennten Ausgabeordner; die Quelle bleibt unangetastet.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Callable, Iterator, Optional

from . import carver, exfat, fat, ntfs, usn
from .models import CancelCb, Finding, ProgressCb
from .sources import ByteSource

FindingCb = Callable[[Finding], None]

# Blockgroesse beim Schreiben grosser Funde (Videos, Archive), damit nicht die
# ganze Datei im Speicher liegt.
CHUNK = 8 * 1024 * 1024


@dataclass
class ScanOptions:
    use_ntfs: bool = True         # geloeschte Dateien ueber die MFT finden
    use_fat: bool = True          # FAT/exFAT-Undelete (SD-Karten, USB-Sticks)
    use_carve: bool = True        # Dateien ueber Signaturen finden
    deleted_only: bool = True     # bei NTFS nur geloeschte Eintraege
    max_files: Optional[int] = None  # Obergrenze fuer Carving-Treffer
    recover_partial: bool = True  # unvollstaendige Dateien (ohne Footer) mitnehmen
    validate: bool = True         # Carving-Treffer per Struktur-Pruefung bestaetigen
    ntfs_orphan_scan: bool = False   # ganzen Datentraeger nach MFT-Eintraegen absuchen
    reconstruct_partitions: bool = False  # Volumes ueber Boot-Sektor-Suche rekonstruieren
    use_usn: bool = False         # USN-Journal auswerten (Namen geloeschter Dateien)


class Scanner:
    def __init__(self, source: ByteSource, options: Optional[ScanOptions] = None):
        self.source = source
        self.options = options or ScanOptions()

    def scan(self, progress_cb: Optional[ProgressCb] = None,
             should_cancel: Optional[CancelCb] = None,
             on_finding: Optional[FindingCb] = None) -> list[Finding]:
        findings: list[Finding] = []

        def emit(f: Finding) -> None:
            findings.append(f)
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

        opts = self.options

        def cancelled() -> bool:
            return bool(should_cancel and should_cancel())

        # Phase 0: Volumes bestimmen – erst ueber die Partitionstabelle, optional
        # zusaetzlich ueber eine Boot-Sektor-Suche (rekonstruiert auch verlorene
        # oder beschaedigte Tabellen). Die Rekonstruktion nuetzt allen
        # dateisystembasierten Verfahren, nicht nur NTFS.
        first_boot: Optional[tuple[ntfs.BootSector, int]] = None
        recon_fat_offsets: set[int] = set()   # rekonstruierte FAT/exFAT-Volumes
        # Offset -> vorab rekonstruierter Boot-Sektor (oder None).
        volumes: dict[int, Optional[ntfs.BootSector]] = {}

        if opts.use_ntfs or opts.use_usn:
            try:
                for off in ntfs.find_ntfs_volumes(self.source):
                    volumes.setdefault(off, None)
            except Exception:
                pass

        if opts.reconstruct_partitions and (opts.use_ntfs or opts.use_usn or opts.use_fat):
            try:
                for vinfo in ntfs.reconstruct_volumes(
                        self.source, thorough=True, progress_cb=progress_cb,
                        should_cancel=should_cancel):
                    if vinfo.fs_type == "ntfs":
                        volumes[vinfo.offset] = vinfo.boot
                    else:
                        recon_fat_offsets.add(vinfo.offset)
            except Exception:
                pass

        # Phase 1: jedes NTFS-Volume ueber seine MFT durchsuchen.
        if opts.use_ntfs:
            for vol_off in sorted(volumes):
                if cancelled():
                    break
                try:
                    boot = volumes[vol_off] or ntfs.BootSector(self.source.read(vol_off, 512))
                    volumes[vol_off] = boot
                    if first_boot is None:
                        first_boot = (boot, vol_off)
                    for f in ntfs.scan_ntfs(self.source, vol_off, progress_cb,
                                            should_cancel,
                                            deleted_only=opts.deleted_only,
                                            boot=boot):
                        emit_ntfs(f)
                except ntfs.NtfsError:
                    continue
                except Exception:
                    # Ein beschaedigtes Volume darf den restlichen Scan nicht stoppen.
                    continue

        # Phase 2: NTFS-Eintraege ueber den ganzen Datentraeger (optional, findet
        # auch nach Formatierung/Boot-Schaden). Geometrie vom gefundenen Volume
        # uebernehmen, sonst uebliche Vorgaben (4-KiB-Cluster, 1-KiB-Eintraege).
        if opts.use_ntfs and opts.ntfs_orphan_scan and not cancelled():
            if first_boot is not None:
                boot, base = first_boot
                geometry = dict(cluster_size=boot.cluster_size, base_offset=base,
                                record_size=boot.record_size,
                                bytes_per_sector=boot.bytes_per_sector)
            else:
                geometry = dict(cluster_size=4096, base_offset=0,
                                record_size=1024, bytes_per_sector=512)
            try:
                for f in ntfs.scan_orphan_mft(
                        self.source, progress_cb=progress_cb,
                        should_cancel=should_cancel,
                        deleted_only=opts.deleted_only, **geometry):
                    emit_ntfs(f)
            except Exception:
                pass

        # Phase 2a: USN-Journal auswerten (Namen geloeschter Dateien). Nur ueber
        # die MFT (guenstig) an jedem bekannten NTFS-Volume – auch an
        # rekonstruierten mit Boot-Sektor aus der Kopie.
        if opts.use_usn and not cancelled():
            for off in sorted(volumes):
                if cancelled():
                    break
                try:
                    for f in usn.scan_usn(self.source, off,
                                          only_delete=opts.deleted_only,
                                          progress_cb=progress_cb,
                                          should_cancel=should_cancel,
                                          allow_carve=False,
                                          boot=volumes[off]):
                        emit(f)
                except Exception:
                    continue

        # Phase 2b: FAT/exFAT-Undelete an allen Partitionsanfaengen (und an
        # rekonstruierten Volumes, falls die Tabelle fehlt).
        if opts.use_fat and not cancelled():
            fat_offsets = list(dict.fromkeys(
                ntfs.partition_offsets(self.source) + sorted(recon_fat_offsets)))
            for off in fat_offsets:
                if cancelled():
                    break
                try:
                    if fat.is_fat(self.source, off):
                        for f in fat.scan_fat(self.source, off,
                                              deleted_only=opts.deleted_only,
                                              progress_cb=progress_cb,
                                              should_cancel=should_cancel):
                            emit(f)
                    elif exfat.is_exfat(self.source, off):
                        for f in exfat.scan_exfat(self.source, off,
                                                  deleted_only=opts.deleted_only,
                                                  progress_cb=progress_cb,
                                                  should_cancel=should_cancel):
                            emit(f)
                except Exception:
                    continue

        # Phase 3: Carving (findet auch ohne intaktes Dateisystem).
        if opts.use_carve and not cancelled():
            for f in carver.carve(self.source, progress_cb=progress_cb,
                                  should_cancel=should_cancel,
                                  max_files=opts.max_files,
                                  recover_partial=opts.recover_partial,
                                  validate=opts.validate):
                emit(f)

        return findings


def iter_chunks(source: ByteSource, finding: Finding,
                chunk_size: int = CHUNK) -> Iterator[bytes]:
    """Liefert die Bytes eines Funds blockweise aus der Quelle.

    So lassen sich auch grosse Funde (Videos, Archive) schreiben, ohne sie
    komplett im Speicher zu halten.
    """
    # Carving sowie FAT/exFAT-Undelete liefern einen zusammenhaengenden Bereich.
    if finding.kind in ("carve", "fat", "exfat"):
        yield from _iter_range(source, finding.offset, finding.size, chunk_size)
        return

    # USN-Funde tragen keinen Inhalt, nur Metadaten -> als Textnotiz ausgeben.
    if finding.kind == "usn":
        ex = finding.extra
        lines = [
            "Datei laut USN-Journal",
            f"Name:         {ex.get('usn_name', '')}",
            f"Zeit:         {ex.get('modified') or 'unbekannt'}",
            f"Grund:        {ex.get('reason', '')}",
            f"MFT-Referenz: {ex.get('usn_ref', '')}",
        ]
        yield ("\n".join(lines) + "\n").encode("utf-8")
        return

    if finding.kind == "ntfs":
        extra = finding.extra
        real_size = extra.get("real_size", finding.size)
        resident = extra.get("resident_data")
        if resident is not None:
            yield resident[:real_size]
            return
        yield from _iter_runs(source, extra.get("data_runs", []),
                              extra["cluster_size"], extra["base_offset"],
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
                yield b"\x00" * n
                take -= n
                remaining -= n
        else:
            for data in _iter_range(source, base_offset + lcn * cluster_size,
                                    take, chunk_size):
                yield data
                remaining -= len(data)


def recover(source: ByteSource, findings: list[Finding], output_dir: str,
            progress_cb: Optional[Callable[[int, int, str], None]] = None,
            should_cancel: Optional[CancelCb] = None,
            skip_existing: bool = True) -> tuple[int, int, list[str]]:
    """Schreibt die uebergebenen Funde in ``output_dir``.

    Ist ``skip_existing`` gesetzt, werden Funde uebersprungen, deren Datei schon
    im Ausgabeordner liegt. Damit laesst sich ein abgebrochener Lauf einfach
    fortsetzen, ohne erneut zu scannen und ohne Duplikate zu erzeugen. Jede
    Datei wird erst unter ``.part`` geschrieben und zum Schluss umbenannt –
    ein Abbruch mitten in einer grossen Datei hinterlaesst so keine
    unvollstaendige Datei, die spaeter faelschlich als fertig gilt.

    Rueckgabe: ``(anzahl_geschrieben, anzahl_uebersprungen, liste_der_fehler)``.
    """
    os.makedirs(output_dir, exist_ok=True)
    # Dateien, die schon vor diesem Lauf existierten (fuer die Fortsetzung).
    preexisting = {n.lower() for n in os.listdir(output_dir)} if skip_existing else set()
    ok = 0
    skipped = 0
    errors: list[str] = []
    total = len(findings)
    # Wie oft derselbe Name in diesem Lauf schon vergeben wurde. Der k-te Fund
    # gleichen Namens bekommt immer denselben Zielnamen (``name_k``), damit die
    # Fortsetzung ihn eindeutig wiedererkennt.
    name_count: dict[str, int] = {}

    for i, finding in enumerate(findings):
        if should_cancel and should_cancel():
            break
        k = name_count.get(finding.name.lower(), 0)
        name_count[finding.name.lower()] = k + 1
        target_name = _numbered(finding.name, k)
        if skip_existing and target_name.lower() in preexisting:
            skipped += 1
            if progress_cb:
                progress_cb(i + 1, total, target_name)
            continue
        target = _unique_path(output_dir, target_name)
        part = target + ".part"
        try:
            with open(part, "wb") as fh:
                for chunk in iter_chunks(source, finding, CHUNK):
                    if should_cancel and should_cancel():
                        raise _Cancelled()
                    fh.write(chunk)
            os.replace(part, target)
            ok += 1
        except _Cancelled:
            _remove_quietly(part)
            break
        except Exception as exc:  # einzelne Fehler nicht den Rest abbrechen lassen
            _remove_quietly(part)
            errors.append(f"{finding.name}: {exc}")
        if progress_cb:
            progress_cb(i + 1, total, os.path.basename(target))

    return ok, skipped, errors


class _Cancelled(Exception):
    pass


def _remove_quietly(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass


def _numbered(name: str, k: int) -> str:
    if k == 0:
        return name
    base, ext = os.path.splitext(name)
    return f"{base}_{k}{ext}"


def _unique_path(output_dir: str, name: str) -> str:
    """Freier Zielpfad: weicht nur aus, wenn die Datei schon existiert."""
    base, ext = os.path.splitext(name)
    candidate = name
    counter = 1
    while os.path.exists(os.path.join(output_dir, candidate)):
        candidate = f"{base}_dup{counter}{ext}"
        counter += 1
    return os.path.join(output_dir, candidate)
