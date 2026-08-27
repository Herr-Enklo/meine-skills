"""Gemeinsame Datentypen der Engine.

In einem eigenen Modul, damit Carver, NTFS-Parser und Scanner denselben
``Finding``-Typ nutzen koennen, ohne sich gegenseitig zu importieren.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Finding:
    """Ein wiederherstellbarer Fund.

    ``kind`` bestimmt, wie die Bytes spaeter extrahiert werden:

    - ``"carve"`` – zusammenhaengender Bereich ``[offset, offset+size)``.
    - ``"ntfs"``  – aus dem Dateisystem, entweder ``resident`` im MFT-Eintrag
      oder ueber ``data_runs`` (Cluster-Liste) verteilt.
    """

    kind: str                 # "carve" oder "ntfs"
    type_name: str            # Anzeigename des Typs, z.B. "JPEG-Bild"
    ext: str                  # Dateiendung ohne Punkt
    name: str                 # vorgeschlagener Dateiname fuer die Ausgabe
    offset: int               # Startposition auf der Quelle (informativ)
    size: int                 # Groesse in Bytes
    # Zusatzdaten fuer die Extraktion, abhaengig von ``kind``:
    #   carve: (keine)
    #   ntfs : resident_data | data_runs, cluster_size, base_offset, real_size
    extra: dict = field(default_factory=dict)

    def describe_source(self) -> str:
        if self.kind == "carve":
            return f"Carving @ 0x{self.offset:X}"
        if self.kind == "fat":
            return "FAT"
        if self.kind == "exfat":
            return "exFAT"
        if self.kind == "usn":
            return "USN-Journal"
        if self.extra.get("resident_data") is not None:
            return "NTFS (im MFT-Eintrag)"
        return "NTFS (Cluster)"

    def modified(self) -> str:
        """Aenderungszeit fuer die Anzeige, oder leer."""
        return self.extra.get("modified") or ""

    def path(self) -> str:
        """Vollstaendiger Pfad, falls rekonstruiert, sonst der Name."""
        return self.extra.get("path") or self.name
