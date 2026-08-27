"""Orchestrierung: Scan (NTFS + Carving) und Wiederherstellung.

Der ``Scanner`` fuehrt die gewaehlten Engines nacheinander aus und meldet
Fortschritt sowie jeden Fund ueber Callbacks – so kann die Oberflaeche die
Trefferliste live fuellen. ``extract`` und ``recover`` schreiben die gefundenen
Dateien in einen getrennten Ausgabeordner; die Quelle bleibt unangetastet.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Callable, Optional

from . import carver, fat, ntfs, usn
from .models import Finding
from .sources import ByteSource

try:                              # exFAT wird separat ergaenzt; optional laden
    from . import exfat as _EXFAT
except Exception:                 # pragma: no cover
    _EXFAT = None

ProgressCb = Callable[[str, float, int], None]
CancelCb = Callable[[], bool]
FindingCb = Callable[[Finding], None]


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

        # Phase 0: Volumes bestimmen – erst ueber die Partitionstabelle, optional
        # zusaetzlich ueber eine Boot-Sektor-Suche (rekonstruiert auch verlorene
        # oder beschaedigte Tabellen).
        first_boot = None
        recon_fat_offsets: set[int] = set()   # rekonstruierte FAT/exFAT-Volumes
        if self.options.use_ntfs:
            # Offset -> vorab rekonstruierter Boot-Sektor (oder None).
            volumes: dict[int, object] = {}

            try:
                for off in ntfs.find_ntfs_volumes(self.source):
                    volumes.setdefault(off, None)
            except Exception:
                pass

            if self.options.reconstruct_partitions:
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
            for vol_off in sorted(volumes):
                if should_cancel and should_cancel():
                    break
                try:
                    boot = volumes[vol_off] or ntfs.BootSector(self.source.read(vol_off, 512))
                    if first_boot is None:
                        first_boot = (boot.cluster_size, vol_off)
                    for f in ntfs.scan_ntfs(self.source, vol_off, progress_cb,
                                            should_cancel,
                                            deleted_only=self.options.deleted_only,
                                            boot=boot):
                        emit_ntfs(f)
                except ntfs.NtfsError:
                    continue
                except Exception:
                    # Ein beschaedigtes Volume darf den restlichen Scan nicht stoppen.
                    continue

        # Phase 2: NTFS-Eintraege ueber den ganzen Datentraeger (optional, findet
        # auch nach Formatierung/Boot-Schaden). Cluster-Groesse und Basis vom
        # gefundenen Volume uebernehmen, sonst uebliche Vorgaben.
        if self.options.use_ntfs and self.options.ntfs_orphan_scan:
            if not (should_cancel and should_cancel()):
                cluster_size, base = first_boot or (4096, 0)
                try:
                    for f in ntfs.scan_orphan_mft(
                            self.source, cluster_size=cluster_size, base_offset=base,
                            progress_cb=progress_cb, should_cancel=should_cancel,
                            deleted_only=self.options.deleted_only):
                        emit_ntfs(f)
                except Exception:
                    pass

        # Phase 2a: USN-Journal auswerten (Namen geloeschter Dateien). Nur ueber
        # die MFT (guenstig) an jedem gefundenen NTFS-Volume.
        if self.options.use_usn and not (should_cancel and should_cancel()):
            try:
                usn_offsets = ntfs.find_ntfs_volumes(self.source)
            except Exception:
                usn_offsets = []
            for off in usn_offsets:
                if should_cancel and should_cancel():
                    break
                try:
                    for f in usn.scan_usn(self.source, off,
                                          only_delete=self.options.deleted_only,
                                          progress_cb=progress_cb,
                                          should_cancel=should_cancel,
                                          allow_carve=False):
                        emit(f)
                except Exception:
                    continue

        # Phase 2b: FAT/exFAT-Undelete an allen Partitionsanfaengen (und an
        # rekonstruierten Volumes, falls die Tabelle fehlt).
        if self.options.use_fat and not (should_cancel and should_cancel()):
            fat_offsets = list(dict.fromkeys(
                ntfs.partition_offsets(self.source) + sorted(recon_fat_offsets)))
            for off in fat_offsets:
                if should_cancel and should_cancel():
                    break
                try:
                    if fat.is_fat(self.source, off):
                        for f in fat.scan_fat(self.source, off,
                                              deleted_only=self.options.deleted_only,
                                              progress_cb=progress_cb,
                                              should_cancel=should_cancel):
                            emit(f)
                    elif _EXFAT and _EXFAT.is_exfat(self.source, off):
                        for f in _EXFAT.scan_exfat(self.source, off,
                                                   deleted_only=self.options.deleted_only,
                                                   progress_cb=progress_cb,
                                                   should_cancel=should_cancel):
                            emit(f)
                except Exception:
                    continue

        # Phase 3: Carving (findet auch ohne intaktes Dateisystem).
        if self.options.use_carve:
            if should_cancel and should_cancel():
                return findings
            for f in carver.carve(self.source, progress_cb=progress_cb,
                                   should_cancel=should_cancel,
                                   max_files=self.options.max_files,
                                   recover_partial=self.options.recover_partial,
                                   validate=self.options.validate):
                emit(f)

        return findings


def extract(source: ByteSource, finding: Finding) -> bytes:
    """Liest die Bytes eines Funds aus der Quelle."""
    # Carving sowie FAT/exFAT-Undelete liefern einen zusammenhaengenden Bereich.
    if finding.kind in ("carve", "fat", "exfat"):
        return source.read(finding.offset, finding.size)

    # USN-Funde tragen keinen Inhalt, nur Metadaten -> als Textnotiz ausgeben.
    if finding.kind == "usn":
        ex = finding.extra
        lines = [
            "Geloeschte Datei laut USN-Journal",
            f"Name:         {ex.get('usn_name', '')}",
            f"Zeit:         {ex.get('modified') or 'unbekannt'}",
            f"Grund:        {ex.get('reason', '')}",
            f"MFT-Referenz: {ex.get('usn_ref', '')}",
        ]
        return ("\n".join(lines) + "\n").encode("utf-8")

    if finding.kind == "ntfs":
        extra = finding.extra
        real_size = extra.get("real_size", finding.size)
        resident = extra.get("resident_data")
        if resident is not None:
            return resident[:real_size]
        runs = extra.get("data_runs", [])
        cluster_size = extra["cluster_size"]
        base_offset = extra["base_offset"]
        return _read_runs(source, runs, cluster_size, base_offset, real_size)

    raise ValueError(f"unbekannter Fundtyp: {finding.kind}")


def _read_runs(source: ByteSource, runs, cluster_size: int,
               base_offset: int, real_size: int) -> bytes:
    out = bytearray()
    for lcn, count in runs:
        if len(out) >= real_size:
            break
        span = count * cluster_size
        if lcn is None:
            out += b"\x00" * span            # sparse: Nullen
        else:
            phys = base_offset + lcn * cluster_size
            out += source.read(phys, span)
    return bytes(out[:real_size])


def recover(source: ByteSource, findings: list[Finding], output_dir: str,
            progress_cb: Optional[Callable[[int, int, str], None]] = None,
            should_cancel: Optional[CancelCb] = None,
            skip_existing: bool = True) -> tuple[int, int, list[str]]:
    """Schreibt die uebergebenen Funde in ``output_dir``.

    Ist ``skip_existing`` gesetzt, werden Funde uebersprungen, deren Datei schon
    im Ausgabeordner liegt. Damit laesst sich ein abgebrochener Lauf einfach
    fortsetzen, ohne erneut zu scannen und ohne Duplikate zu erzeugen.

    Rueckgabe: ``(anzahl_geschrieben, anzahl_uebersprungen, liste_der_fehler)``.
    """
    os.makedirs(output_dir, exist_ok=True)
    # Dateien, die schon vor diesem Lauf existierten (fuer die Fortsetzung).
    preexisting = set(os.listdir(output_dir)) if skip_existing else set()
    ok = 0
    skipped = 0
    errors: list[str] = []
    total = len(findings)
    used: set[str] = set()

    for i, finding in enumerate(findings):
        if should_cancel and should_cancel():
            break
        if skip_existing and finding.name in preexisting:
            skipped += 1
            if progress_cb:
                progress_cb(i + 1, total, finding.name)
            continue
        target = _unique_path(output_dir, finding.name, used)
        try:
            data = extract(source, finding)
            with open(target, "wb") as fh:
                fh.write(data)
            ok += 1
        except Exception as exc:  # einzelne Fehler nicht den Rest abbrechen lassen
            errors.append(f"{finding.name}: {exc}")
        if progress_cb:
            progress_cb(i + 1, total, os.path.basename(target))

    return ok, skipped, errors


def _unique_path(output_dir: str, name: str, used: set[str]) -> str:
    base, ext = os.path.splitext(name)
    candidate = name
    counter = 1
    while candidate.lower() in used or os.path.exists(os.path.join(output_dir, candidate)):
        candidate = f"{base}_{counter}{ext}"
        counter += 1
    used.add(candidate.lower())
    return os.path.join(output_dir, candidate)
