"""Tests fuer die Recovery-Engine (Carving + NTFS).

Ausfuehren:
    python -m unittest datenrettung.tests.test_engine
oder direkt:
    python datenrettung/tests/test_engine.py
"""

from __future__ import annotations

import os
import sys
import tempfile
import unittest

# Projektwurzel (Ordner ueber 'datenrettung') in den Pfad legen, damit das
# Paket auch beim direkten Aufruf gefunden wird.
_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from datenrettung.recovery import ByteSource, Scanner, ScanOptions, extract  # noqa: E402
from datenrettung.recovery import scanner as scanner_mod  # noqa: E402
from datenrettung.recovery import ntfs as ntfs_mod  # noqa: E402
from datenrettung.tests.make_sample_image import (  # noqa: E402
    build_carving_image, build_ntfs_image,
)


def _write_temp(data: bytes) -> str:
    fd, path = tempfile.mkstemp(suffix=".dd")
    with os.fdopen(fd, "wb") as fh:
        fh.write(data)
    return path


class CarvingTests(unittest.TestCase):
    def test_findet_alle_eingebetteten_dateien(self):
        img, expected = build_carving_image()
        path = _write_temp(img)
        self.addCleanup(os.remove, path)

        with ByteSource(path) as src:
            scanner = Scanner(src, ScanOptions(use_ntfs=False, use_carve=True))
            findings = scanner.scan()
            by_ext = {}
            for f in findings:
                by_ext.setdefault(f.ext, []).append(f)

            for exp in expected:
                ext = exp["ext"]
                self.assertIn(ext, by_ext, f"{ext} nicht gefunden")
                # Fund mit passendem Startoffset suchen.
                match = next((f for f in by_ext[ext] if f.offset == exp["offset"]), None)
                self.assertIsNotNone(match, f"{ext} an Offset {exp['offset']} fehlt")
                data = extract(src, match)
                self.assertEqual(
                    data, exp["data"],
                    f"{ext}: Inhalt weicht ab (erwartet {len(exp['data'])}, "
                    f"erhalten {len(data)} Bytes)")

    def test_zip_ist_gueltig_und_lesbar(self):
        import io
        import zipfile
        img, expected = build_carving_image()
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_ntfs=False)).scan()
            zip_finding = next(f for f in findings if f.ext == "zip")
            data = extract(src, zip_finding)
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                self.assertEqual(zf.testzip(), None)
                self.assertIn("hallo.txt", zf.namelist())


def _make_bmp() -> bytes:
    import struct
    width = height = 2
    row = b"\x00\x00\xff" * width
    pad = (-len(row)) % 4
    pixels = (row + b"\x00" * pad) * height
    dib = struct.pack("<IiiHHIIiiII", 40, width, height, 1, 24, 0,
                      len(pixels), 2835, 2835, 0, 0)
    offset = 14 + 40
    size = offset + len(pixels)
    header = b"BM" + struct.pack("<IHHI", size, 0, 0, offset)
    return header + dib + pixels


class FalsePositiveTests(unittest.TestCase):
    def test_zufallsdaten_ertraenken_das_carving_nicht(self):
        import random
        rng = random.Random(20260826)
        noise = bytearray(rng.randbytes(4 * 1024 * 1024))
        bmp = _make_bmp()
        pos = 1_000_000
        noise[pos:pos + len(bmp)] = bmp

        path = _write_temp(bytes(noise))
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_ntfs=False, use_carve=True)).scan()
            # Die echte BMP muss dabei sein …
            bmp_hit = next((f for f in findings if f.ext == "bmp" and f.offset == pos), None)
            self.assertIsNotNone(bmp_hit, "echte BMP nicht gefunden")
            self.assertEqual(extract(src, bmp_hit), bmp)
            # … aber die Trefferzahl darf nicht explodieren.
            self.assertLess(len(findings), 100,
                            f"zu viele Fehltreffer: {len(findings)}")


class NtfsTests(unittest.TestCase):
    def test_findet_geloeschte_datei_mit_namen_und_inhalt(self):
        img, exp = build_ntfs_image()
        path = _write_temp(img)
        self.addCleanup(os.remove, path)

        with ByteSource(path) as src:
            volumes = ntfs_mod.find_ntfs_volumes(src)
            self.assertIn(0, volumes, "NTFS-Volume bei Offset 0 nicht erkannt")

            findings = Scanner(src, ScanOptions(use_ntfs=True, use_carve=False)).scan()
            names = [f.name for f in findings]
            match = next((f for f in findings if exp["name"] in f.name), None)
            self.assertIsNotNone(match, f"geloeschte Datei nicht gefunden, hatte: {names}")
            self.assertEqual(match.size, len(exp["data"]))
            data = extract(src, match)
            self.assertEqual(data, exp["data"])

    def test_ntfs_partition_mit_mbr_offset(self):
        # Realistischer Fall: NTFS-Volume liegt hinter einer MBR-Partitionstabelle,
        # also nicht bei Offset 0. Prueft Partitionserkennung + Offset-Rechnung.
        import struct
        vol, exp = build_ntfs_image()
        start_lba = 2048                       # 1 MiB Vorlauf
        offset = start_lba * 512
        disk = bytearray(offset + len(vol) + 4096)
        # MBR: Partitionseintrag 0, Typ 0x07 (NTFS), Start-LBA 2048.
        disk[0x1BE + 4] = 0x07
        struct.pack_into("<I", disk, 0x1BE + 8, start_lba)
        struct.pack_into("<H", disk, 510, 0xAA55)
        disk[offset:offset + len(vol)] = vol

        path = _write_temp(bytes(disk))
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            volumes = ntfs_mod.find_ntfs_volumes(src)
            self.assertIn(offset, volumes,
                          f"NTFS-Partition bei Offset {offset} nicht erkannt: {volumes}")
            findings = Scanner(src, ScanOptions(use_ntfs=True, use_carve=False)).scan()
            match = next((f for f in findings if exp["name"] in f.name), None)
            self.assertIsNotNone(match, "geloeschte Datei in Partition nicht gefunden")
            self.assertEqual(extract(src, match), exp["data"])

    def test_boot_sektor_kennzahlen(self):
        img, _ = build_ntfs_image()
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            boot = ntfs_mod.BootSector(src.read(0, 512))
            self.assertEqual(boot.bytes_per_sector, 512)
            self.assertEqual(boot.sectors_per_cluster, 1)
            self.assertEqual(boot.cluster_size, 512)
            self.assertEqual(boot.record_size, 1024)
            self.assertEqual(boot.mft_cluster, 4)


class UnitTests(unittest.TestCase):
    def test_parse_data_runs_einfach(self):
        # 0x11 = 1 Byte Laenge, 1 Byte Offset; Laenge 8, LCN 4.
        runs = ntfs_mod.parse_data_runs(bytes([0x11, 0x08, 0x04, 0x00]))
        self.assertEqual(runs, [(4, 8)])

    def test_parse_data_runs_mehrfach_mit_negativem_offset(self):
        # Run 1: Laenge 8 @ LCN 4. Run 2: Laenge 4, Offset -1 (0xFF) -> LCN 3.
        data = bytes([0x11, 0x08, 0x04, 0x11, 0x04, 0xFF, 0x00])
        runs = ntfs_mod.parse_data_runs(data)
        self.assertEqual(runs, [(4, 8), (3, 4)])

    def test_parse_data_runs_sparse(self):
        # off_size 0 -> sparse Bereich (LCN None).
        data = bytes([0x01, 0x05, 0x00])
        runs = ntfs_mod.parse_data_runs(data)
        self.assertEqual(runs, [(None, 5)])

    def test_recover_schreibt_dateien(self):
        img, exp = build_ntfs_image()
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        out_dir = tempfile.mkdtemp()
        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_ntfs=True, use_carve=False)).scan()
            ok, errors = scanner_mod.recover(src, findings, out_dir)
            self.assertGreaterEqual(ok, 1)
            self.assertEqual(errors, [])
            written = os.listdir(out_dir)
            self.assertTrue(any(exp["name"] in name for name in written),
                            f"Ausgabe fehlt, vorhanden: {written}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
