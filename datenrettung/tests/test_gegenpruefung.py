"""Regressionstests zu den sieben Befunden der Gegenpruefung nach PR #32.

Jeder Test haelt einen nachgestellten Fehler fest; die Nummern entsprechen der
Reihenfolge im Pruefbericht. Speicherpruefungen laufen in einem Kindprozess
mit begrenztem Adressraum (nur unter POSIX, dort gibt es ``resource``).

Ausfuehren:
    python -m unittest datenrettung.tests.test_gegenpruefung
"""

from __future__ import annotations

import importlib.util
import io
import json
import ntpath
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
import zipfile
import zlib
from unittest import mock

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from datenrettung.recovery import ByteSource, Scanner, ScanOptions, extract  # noqa: E402
from datenrettung.recovery import carver, drives, exfat, fat, signatures  # noqa: E402
from datenrettung.recovery import scanner as scanner_mod  # noqa: E402
from datenrettung.tests.make_sample_image import (  # noqa: E402
    build_exfat_image, build_fat_image, build_ntfs_image, make_png)

# Speichergrenzen fuer Kindprozesse gibt es nur unter POSIX.
HAVE_RESOURCE = importlib.util.find_spec("resource") is not None


def _read(path: str) -> bytes:
    with open(path, "rb") as fh:
        return fh.read()


def _outputs(out_dir: str) -> dict:
    return {n: _read(os.path.join(out_dir, n)) for n in sorted(os.listdir(out_dir))
            if n != scanner_mod.MANIFEST}


def _two_ntfs_volumes(content_a: bytes, content_b: bytes) -> bytes:
    """MBR mit zwei NTFS-Volumes, beide mit derselben geloeschten Datei."""
    a, _ = build_ntfs_image("gleich.txt", content_a)
    b, _ = build_ntfs_image("gleich.txt", content_b)
    first, second = 4096, 4096 + len(a)
    disk = bytearray(second + len(b))
    disk[510:512] = b"\x55\xaa"
    for n, (off, image) in enumerate(((first, a), (second, b))):
        at = 0x1BE + n * 16
        disk[at + 4] = 0x07
        struct.pack_into("<II", disk, at + 8, off // 512, len(image) // 512)
        disk[off:off + len(image)] = image
    return bytes(disk)


def _run_limited(code: str, limit_mb: int = 192) -> dict:
    """Fuehrt ``code`` in einem Kindprozess mit begrenztem Speicher aus.

    Der Code muss als letzte Zeile ein JSON-Objekt ausgeben.
    """
    prelude = (
        "import resource, sys\n"
        f"sys.path.insert(0, {_ROOT!r})\n"
        f"resource.setrlimit(resource.RLIMIT_AS, ({limit_mb} << 20, {limit_mb} << 20))\n"
    )
    result = subprocess.run([sys.executable, "-c", prelude + code], capture_output=True,
                            text=True, timeout=60)
    if result.returncode != 0:
        raise AssertionError(f"Kindprozess fehlgeschlagen:\n{result.stderr[-2000:]}")
    return json.loads(result.stdout.strip().splitlines()[-1])


class TempDirTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="datenrettung_gegen_")
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def write(self, name: str, data: bytes) -> str:
        path = os.path.join(self.tmp, name)
        with open(path, "wb") as fh:
            fh.write(data)
        return path

    def fs_findings(self, src):
        return Scanner(src, ScanOptions(use_carve=False, use_fat=False)).scan()


# 1 -------------------------------------------------------------------------

class GleicheNamenTests(TempDirTest):
    def test_gleicher_name_und_groesse_zweier_volumes_werden_beide_geschrieben(self):
        path = self.write("zwei.img", _two_ntfs_volumes(b"AAAA", b"BBBB"))
        out = os.path.join(self.tmp, "ziel")
        with ByteSource(path) as src:
            findings = self.fs_findings(src)
            self.assertEqual(len(findings), 2)
            self.assertEqual(findings[0].name, findings[1].name)
            ok, skipped, errors = scanner_mod.recover(src, findings, out)
            self.assertEqual((ok, skipped, errors), (2, 0, []))
            self.assertEqual(sorted(_outputs(out).values()), [b"AAAA", b"BBBB"])
            # Fortsetzung erkennt beide wieder und schreibt nichts doppelt.
            self.assertEqual(scanner_mod.recover(src, findings, out), (0, 2, []))
        self.assertEqual(len(_outputs(out)), 2)


# 2 -------------------------------------------------------------------------

class ZielschutzTests(unittest.TestCase):
    SOURCES = (r"\\.\C:", r"\\.\PhysicalDrive0", r"\\?\C:")

    def check(self, out_dir, final_volume=None, letter_volume=None, disks=None):
        with mock.patch.object(drives.os, "path", ntpath), \
                mock.patch.object(drives, "windows_disk_letters", return_value=["C"]), \
                mock.patch.object(drives, "_win_final_volume", return_value=final_volume), \
                mock.patch.object(drives, "_win_volume_of_letter", return_value=letter_volume), \
                mock.patch.object(drives, "_win_volume_disks", return_value=disks), \
                mock.patch.object(drives, "_existing_ancestor", drives._strip_prefix):
            # Die Ordnersuche ist abgeklemmt: unter Windows wuerde sie fuer
            # \\server\freigabe sonst eine echte Netzwerkabfrage ausloesen.
            return [drives._output_on_source_windows(s, out_dir) for s in self.SOURCES]

    def test_erweiterter_pfad_wird_wie_normaler_behandelt(self):
        for out in (r"C:\Gerettet", r"\\?\C:\Gerettet", r"\\.\C:\Gerettet", r"c:\gerettet"):
            self.assertTrue(all(self.check(out)), out)

    def test_anderes_laufwerk_und_netzpfad_bleiben_frei(self):
        for out in (r"D:\Gerettet", r"\\?\D:\Gerettet", r"\\server\freigabe",
                    r"\\?\UNC\server\freigabe"):
            self.assertEqual(self.check(out), [None, None, None], out)

    def test_windows_volume_aufloesung_schlaegt_die_pfadsyntax(self):
        vol_c = "\\\\?\\Volume{c0c0c0c0-0000-0000-0000-000000000001}\\"
        vol_d = "\\\\?\\Volume{d0d0d0d0-0000-0000-0000-000000000002}\\"
        # Junction oder eingehaengtes Volume: der Pfad sagt D:, Windows sagt C:.
        hits = self.check(r"D:\Verweis_auf_C", final_volume=vol_c, letter_volume=vol_c,
                          disks={0})
        self.assertTrue(all(hits))
        # Umgekehrt: Pfad sagt C:, liegt aber auf einem anderen Volume/einer
        # anderen Platte (z.B. in C:\ eingehaengte zweite Platte).
        hits = self.check(r"C:\Mount\Platte2", final_volume=vol_d, letter_volume=vol_c,
                          disks={1})
        self.assertEqual(hits, [None, None, None])


# 3 -------------------------------------------------------------------------

class ProtokollQuelleTests(TempDirTest):
    def recover(self, path, out):
        with ByteSource(path) as src:
            return scanner_mod.recover(src, self.fs_findings(src), out)

    def test_andere_quelle_mit_gleicher_geometrie_wird_geschrieben(self):
        a, _ = build_ntfs_image("gleich.txt", b"AAAA")
        b, _ = build_ntfs_image("gleich.txt", b"BBBB")
        path_a, path_b = self.write("a.img", a), self.write("b.img", b)
        out = os.path.join(self.tmp, "ziel")
        self.assertEqual(self.recover(path_a, out), (1, 0, []))
        self.assertEqual(self.recover(path_b, out), (1, 0, []))
        self.assertEqual(sorted(_outputs(out).values()), [b"AAAA", b"BBBB"])
        # Beide Quellen setzen danach sauber fort.
        self.assertEqual(self.recover(path_a, out), (0, 1, []))
        self.assertEqual(self.recover(path_b, out), (0, 1, []))

    def test_geaenderter_fingerabdruck_bei_gleichem_inhalt_setzt_fort(self):
        # Ein eingebundenes Laufwerk aendert sich zwischen zwei Laeufen an
        # Stellen, die mit dem Fund nichts zu tun haben.
        a, _ = build_ntfs_image("gleich.txt", b"AAAA")
        path_a = self.write("a.img", a)
        out = os.path.join(self.tmp, "ziel")
        self.assertEqual(self.recover(path_a, out), (1, 0, []))
        changed = bytearray(a)
        changed[-1] ^= 0xFF
        path_changed = self.write("a_spaeter.img", bytes(changed))
        with ByteSource(path_a) as one, ByteSource(path_changed) as two:
            self.assertNotEqual(scanner_mod.source_identity(one),
                                scanner_mod.source_identity(two))
        self.assertEqual(self.recover(path_changed, out), (0, 1, []))
        self.assertEqual(list(_outputs(out).values()), [b"AAAA"])

    def test_veraenderte_zieldatei_wird_nicht_als_erledigt_gezaehlt(self):
        a, _ = build_ntfs_image("gleich.txt", b"AAAA")
        path_a = self.write("a.img", a)
        out = os.path.join(self.tmp, "ziel")
        self.recover(path_a, out)
        name = next(iter(_outputs(out)))
        with open(os.path.join(out, name), "wb") as fh:
            fh.write(b"XXXX")                         # gleiche Laenge, anderer Inhalt
        self.assertEqual(self.recover(path_a, out), (1, 0, []))
        self.assertEqual(sorted(_outputs(out).values()), [b"AAAA", b"XXXX"])

    def test_protokoll_der_version_1_wird_nur_nach_pruefung_uebernommen(self):
        a, _ = build_ntfs_image("gleich.txt", b"AAAA")
        path_a = self.write("a.img", a)
        out = os.path.join(self.tmp, "ziel")
        with ByteSource(path_a) as src:
            finding = self.fs_findings(src)[0]
        os.makedirs(out)
        key = scanner_mod.finding_key(finding)
        with open(os.path.join(out, scanner_mod.MANIFEST), "w", encoding="utf-8") as fh:
            json.dump({"version": 1, "fertig": {key: "alt.txt"}}, fh)
        with open(os.path.join(out, "alt.txt"), "wb") as fh:
            fh.write(b"BBBB")                         # stammt von einer anderen Quelle
        self.assertEqual(self.recover(path_a, out), (1, 0, []))
        with open(os.path.join(out, "alt.txt"), "wb") as fh:
            fh.write(b"AAAA")
        shutil.rmtree(out)
        os.makedirs(out)
        with open(os.path.join(out, scanner_mod.MANIFEST), "w", encoding="utf-8") as fh:
            json.dump({"version": 1, "fertig": {key: "alt.txt"}}, fh)
        with open(os.path.join(out, "alt.txt"), "wb") as fh:
            fh.write(b"AAAA")                         # passt: wird uebernommen
        self.assertEqual(self.recover(path_a, out), (0, 1, []))


# 4 -------------------------------------------------------------------------

def _exfat_with_corrupt_sibling() -> bytes:
    image, _ = build_exfat_image()
    image = bytearray(image)
    root = 8 * 512
    image[root + 96:root + 192] = image[root:root + 96]     # zweite, gueltige Datei
    struct.pack_into("<Q", image, root + 32 + 24, 512 << 30)  # erste: 512 GiB
    return bytes(image)


def _fat_with_corrupt_sibling() -> bytes:
    image, _ = build_fat_image()
    image = bytearray(image)
    root = 2 * 512
    image[root + 32:root + 64] = image[root:root + 32]      # zweite, gueltige Datei
    struct.pack_into("<I", image, root + 0x1C, 0xFFFFFFFF)  # erste: 4 GiB
    return bytes(image)


class _MemorySource:
    def __init__(self, data: bytes):
        self.data, self.size = data, len(data)

    def read(self, offset: int, length: int) -> bytes:
        return self.data[offset:offset + length]


def _scan_corrupt(kind: str) -> dict:
    """Scannt das Volume mit dem beschaedigten Eintrag; Ergebnis als dict."""
    if kind == "exfat":
        data, scan = _exfat_with_corrupt_sibling(), exfat.scan_exfat
    else:
        data, scan = _fat_with_corrupt_sibling(), fat.scan_fat
    warnings: list = []
    found = list(scan(_MemorySource(data), warnings=warnings))
    return {"sizes": [f.size for f in found], "warnings": warnings}


class GroessenfeldTests(unittest.TestCase):
    """Unter POSIX im Kindprozess mit 192 MiB Adressraum: Kaeme der Fehler
    zurueck, scheitert nur dieser Test, statt den ganzen Lauf zu sprengen."""

    def scan(self, kind: str) -> dict:
        if HAVE_RESOURCE:
            return _run_limited(
                "import json\n"
                "from datenrettung.tests.test_gegenpruefung import _scan_corrupt\n"
                f"print(json.dumps(_scan_corrupt({kind!r}), ensure_ascii=False))\n")
        return _scan_corrupt(kind)

    def test_exfat_unmoegliche_groesse_ueberspringt_nur_den_eintrag(self):
        result = self.scan("exfat")
        self.assertEqual(result["sizes"], [len(b"exFAT geloeschte Datei.\n")])
        self.assertTrue(any("beschädigte Dateieinträge" in w for w in result["warnings"]),
                        result["warnings"])

    def test_fat_unmoegliche_groesse_ueberspringt_nur_den_eintrag(self):
        result = self.scan("fat")
        self.assertEqual(result["sizes"], [len(b"FAT geloeschte Datei.\n")])
        self.assertTrue(any("beschädigte Dateieinträge" in w for w in result["warnings"]),
                        result["warnings"])


# 5 -------------------------------------------------------------------------

class Zip64Tests(TempDirTest):
    def test_zip64_nur_wegen_eintragszahl_wird_ganz_gerettet(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            for i in range(65536):
                zf.writestr(f"{i}.txt", b"")
        data = buf.getvalue()
        # Gegenprobe: das Archiv braucht wirklich ZIP64 (Locator vor dem EOCD).
        self.assertEqual(data[-42:-38], b"PK\x06\x07")
        path = self.write("zip64.img", data + bytes(4096))
        sig = next(s for s in signatures.SIGNATURES if s.ext == "zip")
        with ByteSource(path) as src:
            found = list(carver.carve(src, signatures=[sig], max_files=1,
                                      recover_partial=False))
            self.assertEqual(len(found), 1)
            self.assertEqual(found[0].size, len(data))
            self.assertFalse(found[0].extra["partial"])
            with zipfile.ZipFile(io.BytesIO(extract(src, found[0]))) as zf:
                self.assertEqual(len(zf.infolist()), 65536)

    def test_platzhalter_ohne_locator_gilt_nicht(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("a.txt", b"hallo")
        data = bytearray(buf.getvalue())
        eocd = data.rfind(b"PK\x05\x06")
        struct.pack_into("<H", data, eocd + 10, 0xFFFF)       # Eintragszahl: Platzhalter
        read = lambda o, n: bytes(data[o:o + n])              # noqa: E731
        self.assertFalse(signatures._zip_eocd_valid(read, 0, eocd))


# 6 -------------------------------------------------------------------------

def _exfat_fragmented_bitmap() -> bytes:
    """exFAT mit 4100 Clustern; die Bitmap (513 Byte) liegt in Cluster 3 und 5."""
    template, _ = build_exfat_image()
    image = bytearray(4140 * 512)
    image[:512] = template[:512]
    struct.pack_into("<Q", image, 0x48, 4140)             # Volume-Laenge
    struct.pack_into("<I", image, 0x54, 33)               # FAT-Laenge
    struct.pack_into("<I", image, 0x58, 40)               # Cluster-Heap
    struct.pack_into("<I", image, 0x5C, 4100)             # Cluster-Anzahl
    bitmap_entry = bytearray(32)
    bitmap_entry[0] = 0x81
    struct.pack_into("<I", bitmap_entry, 0x14, 3)
    struct.pack_into("<Q", bitmap_entry, 0x18, 513)
    image[40 * 512:40 * 512 + 32] = bitmap_entry          # Wurzel = Cluster 2
    fat_off = 4 * 512
    struct.pack_into("<I", image, fat_off + 2 * 4, 0xFFFFFFFF)   # Wurzel
    struct.pack_into("<I", image, fat_off + 3 * 4, 5)            # Bitmap 3 -> 5
    struct.pack_into("<I", image, fat_off + 5 * 4, 0xFFFFFFFF)
    image[41 * 512] = 0b1011            # Cluster 2, 3, 5 belegt (Bits 0, 1, 3)
    image[42 * 512] = 0                 # Cluster 4: fremde Daten, sehen frei aus
    image[43 * 512] = 0x01              # Bitmap-Byte 512 (Cluster 4098): belegt
    png = make_png()
    offset = (40 + 4098 - 2) * 512
    image[offset:offset + len(png)] = png
    return bytes(image)


class ExfatBitmapTests(TempDirTest):
    def test_bitmap_folgt_ihrer_fat_kette(self):
        path = self.write("exfat.img", _exfat_fragmented_bitmap())
        with ByteSource(path) as src:
            vol = exfat.ExfatVolume(src, exfat.ExfatBoot(src.read(0, 512)))
            self.assertTrue(vol.is_allocated(4098))
            self.assertFalse(vol.is_allocated(4))
            found = Scanner(src, ScanOptions(use_ntfs=False, use_fat=False)).scan()
            self.assertEqual([f for f in found if f.ext == "png"], [])

    def test_aktive_fat_bei_zwei_fats(self):
        boot = bytearray(build_exfat_image()[0][:512])
        base = exfat.ExfatBoot(bytes(boot)).fat_offset()
        boot[0x6E] = 2                                     # zwei FATs
        struct.pack_into("<H", boot, 0x6A, 0x0001)         # ActiveFat = 1
        second = exfat.ExfatBoot(bytes(boot))
        self.assertEqual(second.active_fat, 1)
        self.assertEqual(second.fat_offset(), base + second.fat_length * 512)


# 7 -------------------------------------------------------------------------

class DeklarierteGroesseTests(TempDirTest):
    def carve(self, data, partial):
        path = self.write("quelle.img", data)
        with ByteSource(path) as src:
            return list(carver.carve(src, recover_partial=partial))

    def _truncated_7z(self) -> bytes:
        start_hdr = struct.pack("<QQI", 4096, 8, 0)
        return (b"7z\xbc\xaf\x27\x1c\x00\x04" + struct.pack("<I", zlib.crc32(start_hdr))
                + start_hdr + b"X" * 32)

    def _truncated_wav(self) -> bytes:
        body = b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, 8000, 8000, 1, 8) + b"data"
        return b"RIFF" + struct.pack("<I", 100000) + body + struct.pack("<I", 99956) + bytes(64)

    def test_abgeschnittenes_7z_ist_unvollstaendig(self):
        data = self._truncated_7z()
        self.assertEqual(self.carve(data, partial=False), [])
        found = self.carve(data, partial=True)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0].size, len(data))
        self.assertTrue(found[0].extra["partial"])
        self.assertEqual(found[0].extra["state"], "unvollständig")

    def test_abgeschnittenes_wav_ist_unvollstaendig(self):
        data = self._truncated_wav()
        self.assertEqual(self.carve(data, partial=False), [])
        found = self.carve(data, partial=True)
        self.assertEqual(len(found), 1)
        self.assertTrue(found[0].extra["partial"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
