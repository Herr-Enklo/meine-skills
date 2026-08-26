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

from unittest import mock  # noqa: E402

from datenrettung.recovery import ByteSource, Scanner, ScanOptions, extract  # noqa: E402
from datenrettung.recovery import scanner as scanner_mod  # noqa: E402
from datenrettung.recovery import ntfs as ntfs_mod  # noqa: E402
from datenrettung.recovery import sources as sources_mod  # noqa: E402
from datenrettung.tests.make_sample_image import (  # noqa: E402
    build_carving_image, build_ntfs_image, make_png,
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


class BadSectorTests(unittest.TestCase):
    def test_defekter_sektor_beendet_scan_nicht(self):
        # Zwei PNGs, dazwischen ein defekter Sektor. Frueher beendete der erste
        # Lesefehler den Scan stillschweigend; jetzt wird der Sektor ueberbrueckt
        # und beide Dateien werden gefunden.
        png = make_png()
        img = bytearray(2_000_000)
        img[100_000:100_000 + len(png)] = png
        img[1_500_000:1_500_000 + len(png)] = png
        path = _write_temp(bytes(img))
        self.addCleanup(os.remove, path)

        bad, bad_end = 1_000_000, 1_000_512
        real_read, real_lseek = os.read, os.lseek
        pos = {"v": 0}

        def flseek(fd, p, how):
            r = real_lseek(fd, p, how)
            pos["v"] = r
            return r

        def fread(fd, n):
            p = pos["v"]
            if p < bad_end and p + n > bad:      # Anfrage schneidet den defekten Sektor
                raise OSError(5, "Input/output error")
            d = real_read(fd, n)
            pos["v"] = p + len(d)
            return d

        with mock.patch.object(sources_mod.os, "read", fread), \
                mock.patch.object(sources_mod.os, "lseek", flseek):
            with ByteSource(path) as src:
                findings = Scanner(src, ScanOptions(use_ntfs=False)).scan()
                offsets = sorted(f.offset for f in findings if f.ext == "png")
                self.assertEqual(offsets, [100_000, 1_500_000],
                                 "trotz defektem Sektor muessen beide PNGs gefunden werden")
                self.assertGreaterEqual(src.bad_sectors, 1,
                                        "defekter Sektor muss gezaehlt werden")


class ContainerExtTests(unittest.TestCase):
    def test_ftyp_marke_bestimmt_endung(self):
        box = b"\x00\x00\x00\x20ftypheic\x00\x00\x00\x00mif1heic" + b"\x11" * 128
        img = b"\x00" * 512 + box + b"\x00" * 512
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_ntfs=False)).scan()
            match = next((f for f in findings if f.offset == 512), None)
            self.assertIsNotNone(match, "ftyp-Box nicht gefunden")
            self.assertEqual(match.ext, "heic")

    def test_riff_marke_bestimmt_wav(self):
        import struct
        payload = b"fmt " + b"\x00" * 40
        size_field = 4 + len(payload)                 # RIFF-Groesse = Datei - 8
        body = b"RIFF" + struct.pack("<I", size_field) + b"WAVE" + payload
        img = b"\x00" * 512 + body + b"\x00" * 512
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_ntfs=False)).scan()
            match = next((f for f in findings if f.offset == 512), None)
            self.assertIsNotNone(match, "RIFF-Container nicht gefunden")
            self.assertEqual(match.ext, "wav")
            self.assertEqual(match.size, len(body))


class NewImageFormatTests(unittest.TestCase):
    def _make_ico(self):
        import struct
        data = b"\xAA" * 40
        entry = struct.pack("<BBBBHHII", 16, 16, 0, 0, 1, 32, len(data), 22)
        return b"\x00\x00\x01\x00" + struct.pack("<H", 1) + entry + data

    def test_neue_bildformate(self):
        ico = self._make_ico()
        avif = b"\x00\x00\x00\x20ftypavif\x00\x00\x00\x00avifmif1" + b"\x22" * 200
        jp2 = b"\x00\x00\x00\x0cjP  \r\n\x87\n" + b"\x33" * 200
        raf = b"FUJIFILMCCD-RAW" + b"\x44" * 200
        rw2 = b"II\x55\x00" + b"\x55" * 200

        blobs = [("ico", ico), ("avif", avif), ("jp2", jp2), ("raf", raf), ("rw2", rw2)]
        img = bytearray(b"\x00" * 512)
        offsets = {}
        for ext, blob in blobs:
            offsets[ext] = len(img)
            img += blob
            img += b"\x00" * 800

        path = _write_temp(bytes(img))
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_ntfs=False)).scan()
            by_ext = {}
            for f in findings:
                by_ext.setdefault(f.ext, []).append(f)
            for ext in ("ico", "avif", "jp2", "raf", "rw2"):
                self.assertIn(ext, by_ext, f"{ext} nicht gefunden")
                match = next((f for f in by_ext[ext] if f.offset == offsets[ext]), None)
                self.assertIsNotNone(match, f"{ext} nicht am erwarteten Offset")
            # ICO hat eine berechenbare Groesse und muss byte-genau stimmen.
            ico_hit = next(f for f in by_ext["ico"] if f.offset == offsets["ico"])
            self.assertEqual(extract(src, ico_hit), ico)


class PartialTests(unittest.TestCase):
    def test_jpeg_ohne_footer_wird_teilweise_gerettet(self):
        from datenrettung.recovery import carver
        start = b"\xff\xd8\xff\xe0" + b"\x01" * 3000     # JPEG-Header, kein FF D9
        img = b"\x00" * 512 + start + b"\x00" * 512
        path = _write_temp(img)
        self.addCleanup(os.remove, path)

        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_ntfs=False)).scan()
            match = next((f for f in findings if f.ext == "jpg" and f.offset == 512), None)
            self.assertIsNotNone(match, "unvollstaendiges JPEG nicht gerettet")
            self.assertTrue(match.extra.get("partial"))

        with ByteSource(path) as src2:
            without = list(carver.carve(src2, recover_partial=False))
            self.assertFalse(any(f.offset == 512 and f.ext == "jpg" for f in without),
                             "ohne Teil-Rettung darf der Header-only-Treffer fehlen")


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


class OrphanMftTests(unittest.TestCase):
    def test_orphan_scan_findet_datei_trotz_kaputtem_boot(self):
        img, exp = build_ntfs_image()
        broken = bytearray(img)
        broken[3:11] = b"XXXXXXXX"                 # NTFS-Kennung zerstoeren
        path = _write_temp(bytes(broken))
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            self.assertEqual(ntfs_mod.find_ntfs_volumes(src), [],
                             "Boot-Scan sollte hier nichts finden")
            opts = ScanOptions(use_ntfs=True, use_carve=False, ntfs_orphan_scan=True)
            findings = Scanner(src, opts).scan()
            match = next((f for f in findings if exp["name"] in f.name), None)
            self.assertIsNotNone(match, "Orphan-Scan hat die geloeschte Datei nicht gefunden")
            self.assertEqual(extract(src, match), exp["data"])


class ReconstructTests(unittest.TestCase):
    def test_findet_volume_ohne_partitionstabelle(self):
        # NTFS-Volume bei 1 MiB, aber keine Partitionstabelle (MBR = Nullen).
        vol, exp = build_ntfs_image()
        off = 1024 * 1024
        disk = bytearray(off + len(vol) + 4096)
        disk[off:off + len(vol)] = vol
        path = _write_temp(bytes(disk))
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            self.assertEqual(ntfs_mod.find_ntfs_volumes(src), [],
                             "ohne Tabelle darf die normale Erkennung nichts finden")
            vols = ntfs_mod.reconstruct_volumes(src, thorough=True)
            offs = {v.offset for v in vols if v.fs_type == "ntfs"}
            self.assertIn(off, offs, f"Volume nicht rekonstruiert: {vols}")

            opts = ScanOptions(use_ntfs=True, use_carve=False, reconstruct_partitions=True)
            findings = Scanner(src, opts).scan()
            match = next((f for f in findings if exp["name"] in f.name), None)
            self.assertIsNotNone(match, "Datei nach Rekonstruktion nicht gefunden")
            self.assertEqual(extract(src, match), exp["data"])

    def test_rekonstruiert_aus_backup_boot_sektor(self):
        # Primaeren Boot-Sektor zerstoeren, Kopie ans Volume-Ende schreiben.
        vol, exp = build_ntfs_image()
        original_boot = bytes(vol[0:512])
        vol = bytearray(vol)
        vol[0:512] = b"\x00" * 512                  # primaerer Boot-Sektor weg
        vol[63 * 512:64 * 512] = original_boot       # Kopie im letzten Sektor
        off = 1024 * 1024
        disk = bytearray(off + len(vol) + 4096)
        disk[off:off + len(vol)] = vol
        path = _write_temp(bytes(disk))
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            vols = ntfs_mod.reconstruct_volumes(src, thorough=True)
            backup = next((v for v in vols if v.fs_type == "ntfs" and v.offset == off), None)
            self.assertIsNotNone(backup, f"Backup-Rekonstruktion fehlgeschlagen: {vols}")
            self.assertEqual(backup.origin, "backup")

            opts = ScanOptions(use_ntfs=True, use_carve=False, reconstruct_partitions=True)
            findings = Scanner(src, opts).scan()
            match = next((f for f in findings if exp["name"] in f.name), None)
            self.assertIsNotNone(match, "Datei aus Backup-Boot-Sektor nicht gefunden")
            self.assertEqual(extract(src, match), exp["data"])


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
            ok, skipped, errors = scanner_mod.recover(src, findings, out_dir)
            self.assertGreaterEqual(ok, 1)
            self.assertEqual(errors, [])
            written = os.listdir(out_dir)
            self.assertTrue(any(exp["name"] in name for name in written),
                            f"Ausgabe fehlt, vorhanden: {written}")

    def test_wiederherstellung_ist_fortsetzbar(self):
        img, expected = build_carving_image()
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        out_dir = tempfile.mkdtemp()
        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_ntfs=False)).scan()
            self.assertGreaterEqual(len(findings), 4)

            # Erster Lauf: nach zwei verarbeiteten Funden abbrechen.
            calls = {"n": 0}

            def cancel():
                calls["n"] += 1
                return calls["n"] > 2

            ok1, skip1, err1 = scanner_mod.recover(src, findings, out_dir,
                                                   should_cancel=cancel)
            self.assertEqual(err1, [])
            self.assertEqual(ok1, 2)

            # Zweiter Lauf ohne Abbruch: setzt fort, ueberspringt Vorhandenes.
            ok2, skip2, err2 = scanner_mod.recover(src, findings, out_dir)
            self.assertEqual(err2, [])
            self.assertEqual(skip2, ok1, "zweiter Lauf muss die schon geschriebenen ueberspringen")
            written = os.listdir(out_dir)
            self.assertEqual(len(written), len(findings),
                             f"keine Duplikate erwartet: {written}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
