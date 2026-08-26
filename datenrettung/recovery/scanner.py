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

from . import carver, ntfs
from .models import Finding
from .sources import ByteSource

ProgressCb = Callable[[str, float, int], None]
CancelCb = Callable[[], bool]
FindingCb = Callable[[Finding], None]


@dataclass
class ScanOptions:
    use_ntfs: bool = True         # geloeschte Dateien ueber die MFT finden
    use_carve: bool = True        # Dateien ueber Signaturen finden
    deleted_only: bool = True     # bei NTFS nur geloeschte Eintraege
    max_files: Optional[int] = None  # Obergrenze fuer Carving-Treffer


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

        # Phase 1: NTFS/MFT (liefert Originalnamen).
        if self.options.use_ntfs:
            try:
                volumes = ntfs.find_ntfs_volumes(self.source)
            except Exception:
                volumes = []
            for vol_off in volumes:
                if should_cancel and should_cancel():
                    break
                try:
                    for f in ntfs.scan_ntfs(self.source, vol_off, progress_cb,
                                            should_cancel,
                                            deleted_only=self.options.deleted_only):
                        emit(f)
                except ntfs.NtfsError:
                    continue
                except Exception:
                    # Ein beschaedigtes Volume darf den restlichen Scan nicht stoppen.
                    continue

        # Phase 2: Carving (findet auch ohne intaktes Dateisystem).
        if self.options.use_carve:
            if should_cancel and should_cancel():
                return findings
            for f in carver.carve(self.source, progress_cb=progress_cb,
                                   should_cancel=should_cancel,
                                   max_files=self.options.max_files):
                emit(f)

        return findings


def extract(source: ByteSource, finding: Finding) -> bytes:
    """Liest die Bytes eines Funds aus der Quelle."""
    if finding.kind == "carve":
        return source.read(finding.offset, finding.size)

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
            should_cancel: Optional[CancelCb] = None) -> tuple[int, list[str]]:
    """Schreibt die uebergebenen Funde in ``output_dir``.

    Rueckgabe: ``(anzahl_erfolgreich, liste_der_fehler)``.
    """
    os.makedirs(output_dir, exist_ok=True)
    ok = 0
    errors: list[str] = []
    total = len(findings)
    used: set[str] = set()

    for i, finding in enumerate(findings):
        if should_cancel and should_cancel():
            break
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

    return ok, errors


def _unique_path(output_dir: str, name: str, used: set[str]) -> str:
    base, ext = os.path.splitext(name)
    candidate = name
    counter = 1
    while candidate.lower() in used or os.path.exists(os.path.join(output_dir, candidate)):
        candidate = f"{base}_{counter}{ext}"
        counter += 1
    used.add(candidate.lower())
    return os.path.join(output_dir, candidate)
