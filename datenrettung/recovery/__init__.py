"""Datenrettung: Engine zum Auffinden und Wiederherstellen von Dateien.

Das Paket kapselt die gesamte Low-Level-Logik unabhaengig von der Oberflaeche:

- ``sources``   – lesender Zugriff auf ein Image oder ein physisches Laufwerk
- ``drives``    – Auflisten verfuegbarer Laufwerke (Windows/Linux/macOS)
- ``signatures``– Datei-Signaturen fuer das File-Carving
- ``carver``    – Carving-Engine (findet Dateien anhand ihrer Signatur)
- ``ntfs``      – Parser fuer NTFS/MFT (findet geloeschte Dateien inkl. Namen),
                  Partitionstabellen (MBR/EBR/GPT) und Partitionsrekonstruktion
- ``lznt1``     – Entpacken NTFS-komprimierter Dateien
- ``usn``       – USN-Change-Journal ($UsnJrnl)
- ``fat``       – FAT12/16/32-Undelete
- ``exfat``     – exFAT-Undelete
- ``scanner``   – orchestriert einen Scan und die Wiederherstellung

Alle Zugriffe auf die Quelle erfolgen ausschliesslich lesend.
"""

from .sources import ByteSource
from .scanner import Scanner, ScanOptions, Finding, extract, iter_chunks

__all__ = [
    "ByteSource",
    "Scanner",
    "ScanOptions",
    "Finding",
    "extract",
    "iter_chunks",
]
