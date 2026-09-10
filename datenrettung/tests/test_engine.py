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
from datenrettung.recovery import usn as usn_mod  # noqa: E402
from datenrettung.recovery.models import Finding  # noqa: E402
from datenrettung.gui.sorting import order_iids  # noqa: E402
from datenrettung.tests.make_sample_image import (  # noqa: E402
    build_carving_image, build_ntfs_image, build_fat_image, build_fat32_image,
    build_exfat_image, make_png, make_pdf, make_usn_record,
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


class ValidationTests(unittest.TestCase):
    def test_verstuemmeltes_png_wird_verworfen(self):
        from datenrettung.recovery import carver
        good = make_png()
        # Gueltige Signatur und Footer, aber kaputter IHDR-Chunk (falsche CRC).
        bad = (b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\x0dJUNK" + b"\x00" * 40
               + b"IEND\xaeB`\x82")
        img = bytearray(b"\x00" * 512)
        good_off = len(img)
        img += good + b"\x00" * 700
        bad_off = len(img)
        img += bad + b"\x00" * 700
        path = _write_temp(bytes(img))
        self.addCleanup(os.remove, path)

        with ByteSource(path) as src:
            withval = Scanner(src, ScanOptions(use_ntfs=False)).scan()
            offs = {f.offset for f in withval if f.ext == "png"}
            self.assertIn(good_off, offs, "gueltiges PNG muss gefunden werden")
            self.assertNotIn(bad_off, offs, "kaputtes PNG muss verworfen werden")

        with ByteSource(path) as src2:
            without = [f for f in carver.carve(src2, validate=False)
                       if f.ext == "png"]
            offs2 = {f.offset for f in without}
            self.assertIn(bad_off, offs2, "ohne Validierung wuerde es durchrutschen")


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

    def test_zeitstempel_und_pfad_werden_rekonstruiert(self):
        img, exp = build_ntfs_image()
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_ntfs=True, use_carve=False)).scan()
            match = next((f for f in findings if exp["name"] in f.name), None)
            self.assertIsNotNone(match)
            self.assertEqual(match.extra.get("path"), exp["path"])
            self.assertEqual(match.extra.get("modified"), exp["modified"])

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


class FatTests(unittest.TestCase):
    def test_fat_undelete_mit_name_zeit_und_inhalt(self):
        img, exp = build_fat_image()
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_ntfs=False, use_carve=False)).scan()
            match = next((f for f in findings if f.kind == "fat"), None)
            self.assertIsNotNone(match, "geloeschte FAT-Datei nicht gefunden")
            self.assertEqual(match.extra.get("path"), exp["name"])
            self.assertEqual(match.extra.get("modified"), exp["modified"])
            self.assertEqual(extract(src, match), exp["data"])


class ExfatTests(unittest.TestCase):
    def test_exfat_undelete_mit_name_zeit_und_inhalt(self):
        img, exp = build_exfat_image()
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_ntfs=False, use_carve=False)).scan()
            match = next((f for f in findings if f.kind == "exfat"), None)
            self.assertIsNotNone(match, "geloeschte exFAT-Datei nicht gefunden")
            self.assertEqual(match.extra.get("path"), exp["name"])
            self.assertEqual(match.extra.get("modified"), exp["modified"])
            self.assertEqual(extract(src, match), exp["data"])


def _make_usn(name, reason, timestamp, ref=100, parent=5):
    import struct
    name16 = name.encode("utf-16-le")
    name_off = 0x3C
    rec_len = (name_off + len(name16) + 7) & ~7
    rec = bytearray(rec_len)
    struct.pack_into("<I", rec, 0, rec_len)
    struct.pack_into("<H", rec, 4, 2)          # MajorVersion
    struct.pack_into("<Q", rec, 0x08, ref)
    struct.pack_into("<Q", rec, 0x10, parent)
    struct.pack_into("<Q", rec, 0x20, timestamp)
    struct.pack_into("<I", rec, 0x28, reason)
    struct.pack_into("<H", rec, 0x38, len(name16))
    struct.pack_into("<H", rec, 0x3A, name_off)
    rec[name_off:name_off + len(name16)] = name16
    return bytes(rec)


def _filetime(year, month, day, hour=0, minute=0, second=0):
    import datetime
    epoch = datetime.datetime(1601, 1, 1, tzinfo=datetime.timezone.utc)
    dt = datetime.datetime(year, month, day, hour, minute, second,
                           tzinfo=datetime.timezone.utc)
    return int((dt - epoch).total_seconds() * 10_000_000)


class UsnTests(unittest.TestCase):
    CREATE = 0x00000100 | 0x80000000
    DELETE = 0x00000200 | 0x80000000
    MOD_FT = _filetime(2021, 6, 15, 12, 0, 0)   # -> "2021-06-15 12:00:00"

    def test_parser_filtert_loeschungen(self):
        buf = (_make_usn("neu.txt", self.CREATE, self.MOD_FT)
               + _make_usn("weg.txt", self.DELETE, self.MOD_FT, ref=101))
        only_del = list(usn_mod.parse_usn_records(buf, only_delete=True))
        self.assertEqual([r["name"] for r in only_del], ["weg.txt"])
        alle = list(usn_mod.parse_usn_records(buf, only_delete=False))
        self.assertEqual(len(alle), 2)

    def test_scan_usn_carving(self):
        rec = _make_usn("geloescht.docx", self.DELETE, self.MOD_FT, ref=202)
        img = b"\x00" * 1024 + rec + b"\x00" * 700
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            findings = list(usn_mod.scan_usn(src, 0, only_delete=True))
            match = next((f for f in findings if f.kind == "usn"), None)
            self.assertIsNotNone(match, "USN-Datensatz nicht herausgeschnitten")
            self.assertEqual(match.extra.get("usn_name"), "geloescht.docx")
            self.assertEqual(match.extra.get("modified"), "2021-06-15 12:00:00")
            text = extract(src, match)
            self.assertIn(b"geloescht.docx", text)


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


class SortingTests(unittest.TestCase):
    def _findings(self):
        return [
            Finding("carve", "PNG-Bild", "png", "b.png", 0, 500),
            Finding("carve", "JPEG-Bild", "jpg", "a.jpg", 0, 1_500_000),
            Finding("carve", "GIF-Bild", "gif", "c.gif", 0, 40),
        ]

    def test_groesse_wird_numerisch_sortiert(self):
        f = self._findings()
        iids = ["0", "1", "2"]
        # Aufsteigend nach Groesse: 40, 500, 1.5M -> Indizes 2, 0, 1.
        self.assertEqual(order_iids(f, iids, "groesse", reverse=False), ["2", "0", "1"])
        self.assertEqual(order_iids(f, iids, "groesse", reverse=True), ["1", "0", "2"])

    def test_name_wird_alphabetisch_sortiert(self):
        f = self._findings()
        self.assertEqual(order_iids(f, ["0", "1", "2"], "name", reverse=False),
                         ["1", "0", "2"])  # a.jpg, b.png, c.gif

    def test_ueberlaufzeile_wird_ignoriert(self):
        f = self._findings()
        order = order_iids(f, ["0", "1", "2", "overflow"], "groesse", reverse=False)
        self.assertEqual(order, ["2", "0", "1"])


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

            # Erster Lauf: abbrechen, sobald zwei Dateien fertig geschrieben sind.
            def cancel():
                done = [n for n in os.listdir(out_dir) if not n.endswith(".part")]
                return len(done) >= 2

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


def _carve_single(path: str, offset: int, ext: str):
    """Hilfsfunktion: den Carving-Fund mit ``ext`` an ``offset`` samt Bytes holen."""
    with ByteSource(path) as src:
        findings = Scanner(src, ScanOptions(use_ntfs=False, use_fat=False)).scan()
        match = next((f for f in findings if f.ext == ext and f.offset == offset), None)
        data = extract(src, match) if match else None
    return match, data, findings


def _jpeg_with_thumbnail(app1_len: int | None = None) -> bytes:
    """JPEG mit eingebettetem EXIF-Vorschaubild (eigenes FF D8 ... FF D9)."""
    import struct
    inner = (b"\xff\xd8\xff\xdb\x00\x04\x00\x00" + b"\xff\xda\x00\x02"
             + b"\x11" * 50 + b"\xff\xd9")
    payload = b"Exif\x00\x00" + inner
    length = app1_len if app1_len is not None else 2 + len(payload)
    app1 = b"\xff\xe1" + struct.pack(">H", length) + payload
    scan = b"\xff\xda\x00\x02" + b"\x22" * 300 + b"\xff\x00" + b"\xff\xd3" + b"\x33" * 100
    return b"\xff\xd8" + app1 + scan + b"\xff\xd9"


class CarvingBoundaryTests(unittest.TestCase):
    """Dateiende-Bestimmung: Verschachtelung, mehrfache Footer, footerlose Typen."""

    def test_jpeg_mit_exif_vorschau_wird_komplett_gerettet(self):
        jpg = _jpeg_with_thumbnail()
        path = _write_temp(b"\x00" * 512 + jpg + b"\x00" * 512)
        self.addCleanup(os.remove, path)
        match, data, findings = _carve_single(path, 512, "jpg")
        self.assertIsNotNone(match, "JPEG nicht gefunden")
        self.assertEqual(data, jpg, "JPEG endet am Vorschaubild statt am echten Ende")
        # Das Vorschaubild darf nicht als eigene Datei auftauchen.
        self.assertEqual(sum(1 for f in findings if f.ext == "jpg"), 1)

    def test_jpeg_mit_kaputter_segmentlaenge_nutzt_verschachtelte_suche(self):
        jpg = _jpeg_with_thumbnail(app1_len=0xFFFF)     # Laengenfeld zerstoert
        path = _write_temp(b"\x00" * 512 + jpg + b"\x00" * 512)
        self.addCleanup(os.remove, path)
        match, data, _ = _carve_single(path, 512, "jpg")
        self.assertIsNotNone(match)
        self.assertEqual(data, jpg)

    def test_pdf_mit_inkrementellem_update_nimmt_letztes_eof(self):
        pdf = (make_pdf() + b"\n4 0 obj<< /Type /Page >>endobj\nxref\n0 1\n"
               b"trailer<< /Root 1 0 R /Prev 9 >>\nstartxref\n120\n%%EOF")
        path = _write_temp(b"\x00" * 512 + pdf + b"\x00" * 512)
        self.addCleanup(os.remove, path)
        match, data, _ = _carve_single(path, 512, "pdf")
        self.assertIsNotNone(match)
        self.assertEqual(data, pdf, "PDF wurde am ersten %%EOF abgeschnitten")

    def test_rtf_endet_an_der_aeussersten_klammer(self):
        rtf = (b"{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}"
               b"\\{maskiert\\} Hallo {\\b fett} Welt}")
        path = _write_temp(b"\x00" * 512 + rtf + b"\x00" * 512)
        self.addCleanup(os.remove, path)
        match, data, _ = _carve_single(path, 512, "rtf")
        self.assertIsNotNone(match)
        self.assertEqual(data, rtf, "RTF wurde an einer inneren Klammer abgeschnitten")

    def test_footerloser_typ_endet_am_naechsten_gleichen_header(self):
        first = b"II\x2a\x00" + b"\x01" * 996
        second = b"II\x2a\x00" + b"\x02" * 500
        path = _write_temp(b"\x00" * 512 + first + second + b"\x00" * 512)
        self.addCleanup(os.remove, path)
        match, data, findings = _carve_single(path, 512, "tif")
        self.assertIsNotNone(match)
        self.assertEqual(data, first, "erste TIFF muss vor der zweiten enden")
        self.assertTrue(any(f.ext == "tif" and f.offset == 512 + len(first)
                            for f in findings), "zweite TIFF fehlt")

    def test_blockweises_lesen_liefert_dieselben_bytes(self):
        img, expected = build_carving_image()
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_ntfs=False, use_fat=False)).scan()
            for f in findings:
                chunks = list(scanner_mod.iter_chunks(src, f, chunk_size=100))
                self.assertTrue(all(len(c) <= 100 for c in chunks))
                self.assertEqual(b"".join(chunks), extract(src, f))


class Fat32Tests(unittest.TestCase):
    def test_fat32_wurzel_und_langer_name_geloeschter_datei(self):
        img, exp = build_fat32_image()
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_ntfs=False, use_carve=False)).scan()
            match = next((f for f in findings if f.kind == "fat"), None)
            self.assertIsNotNone(match, "FAT32-Wurzelverzeichnis wurde nicht gelesen")
            self.assertEqual(match.extra.get("fs"), "fat32")
            self.assertEqual(match.extra.get("path"), exp["name"],
                             "langer Name der geloeschten Datei ging verloren")
            self.assertEqual(match.extra.get("modified"), exp["modified"])
            self.assertEqual(extract(src, match), exp["data"])

    def test_rekonstruktion_ignoriert_backup_boot_sektoren(self):
        fat_img, fat_exp = build_fat32_image()
        ex_img, _ = build_exfat_image(with_backup=True)
        for img, label in ((fat_img, "FAT32"), (ex_img, "exFAT")):
            path = _write_temp(img)
            self.addCleanup(os.remove, path)
            with ByteSource(path) as src:
                vols = ntfs_mod.reconstruct_volumes(src, thorough=True)
                offs = sorted(v.offset for v in vols)
                self.assertEqual(offs, [0],
                                 f"{label}: Backup-Boot-Sektor als Volume gemeldet: {vols}")


class GptTests(unittest.TestCase):
    def test_gpt_auf_4kn_laufwerk_wird_mit_sektorgroesse_umgerechnet(self):
        import struct
        ss = 4096
        vol, exp = build_ntfs_image()
        first_lba = 8
        vol_off = first_lba * ss
        disk = bytearray(vol_off + len(vol) + ss)
        # Schutz-MBR mit GPT-Eintrag (Typ 0xEE).
        disk[0x1BE + 4] = 0xEE
        struct.pack_into("<I", disk, 0x1BE + 8, 1)
        struct.pack_into("<H", disk, 510, 0xAA55)
        # GPT-Header in LBA 1 (= 4096), Eintraege ab LBA 2.
        disk[ss:ss + 8] = b"EFI PART"
        struct.pack_into("<Q", disk, ss + 72, 2)
        struct.pack_into("<I", disk, ss + 80, 1)
        struct.pack_into("<I", disk, ss + 84, 128)
        entry = 2 * ss
        disk[entry:entry + 16] = b"\x01" * 16                   # Typ-GUID != 0
        struct.pack_into("<Q", disk, entry + 32, first_lba)
        disk[vol_off:vol_off + len(vol)] = vol
        path = _write_temp(bytes(disk))
        self.addCleanup(os.remove, path)

        with ByteSource(path, sector_size=512) as src:
            self.assertEqual(ntfs_mod.find_ntfs_volumes(src), [],
                             "mit 512er-Sektoren liegt der GPT-Header woanders")
        with ByteSource(path, sector_size=ss) as src:
            self.assertEqual(ntfs_mod.find_ntfs_volumes(src), [vol_off])
            findings = Scanner(src, ScanOptions(use_ntfs=True, use_carve=False)).scan()
            match = next((f for f in findings if exp["name"] in f.name), None)
            self.assertIsNotNone(match, "Datei in der GPT-Partition nicht gefunden")
            self.assertEqual(extract(src, match), exp["data"])


class UsnJournalTests(unittest.TestCase):
    def _check(self, usn_mode: str):
        img, exp = build_ntfs_image(usn=usn_mode)
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            # Nur ueber die MFT, kein Carving-Rueckfall erlaubt.
            findings = list(usn_mod.scan_usn(src, 0, only_delete=True, allow_carve=False))
            names = [f.extra.get("usn_name") for f in findings]
            self.assertEqual(names, [exp["usn_deleted"]],
                             f"{usn_mode}: $J nicht ueber die MFT gelesen: {names}")
            self.assertEqual(findings[0].extra.get("modified"), exp["modified"])
            # Ueber den Scanner (Phase 2a) kommt derselbe Fund.
            opts = ScanOptions(use_ntfs=True, use_carve=False, use_fat=False, use_usn=True)
            via_scanner = [f for f in Scanner(src, opts).scan() if f.kind == "usn"]
            self.assertEqual([f.extra.get("usn_name") for f in via_scanner],
                             [exp["usn_deleted"]])

    def test_journal_ueber_mft_direkt(self):
        self._check("direct")

    def test_journal_ueber_attribute_list(self):
        self._check("attrlist")

    def test_alle_eintraege_mit_art_der_aenderung(self):
        img, exp = build_ntfs_image(usn="direct")
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            findings = list(usn_mod.scan_usn(src, 0, only_delete=False, allow_carve=False))
            by_name = {f.extra["usn_name"]: f for f in findings}
            self.assertEqual(set(by_name), {"alt.txt", "weg.docx"})
            self.assertEqual(by_name["alt.txt"].type_name, "USN-Journal (Aenderung)")
            self.assertEqual(by_name["weg.docx"].type_name, "USN-Journal (geloescht)")

    def test_reason_text_kennt_rename_und_unbekannte_bits(self):
        self.assertEqual(usn_mod.reason_text(0x1000 | 0x2000), "RENAME_OLD_NAME|RENAME_NEW_NAME")
        self.assertEqual(usn_mod.reason_text(0x200 | 0x80000000), "FILE_DELETE|CLOSE")
        self.assertIn("0x", usn_mod.reason_text(0x40000000))

    def test_carving_liefert_datensatz_an_blockgrenze_nur_einmal(self):
        # Datensatz komplett im Ueberlappungsbereich (letzte 4 KiB des ersten
        # 8-MiB-Blocks): frueher doppelt geliefert.
        ft = _filetime(2021, 6, 15, 12, 0, 0)
        rec = make_usn_record("doppelt.txt", 0x200 | 0x80000000, ft, ref=77)
        pos = 8 * 1024 * 1024 - 2000
        img = bytearray(8 * 1024 * 1024 + 4096)
        img[pos:pos + len(rec)] = rec
        path = _write_temp(bytes(img))
        self.addCleanup(os.remove, path)
        with ByteSource(path) as src:
            recs = list(usn_mod._carve(src, True, None, None))
            self.assertEqual(len(recs), 1, f"Datensatz mehrfach geliefert: {recs}")
            self.assertEqual(recs[0]["offset"], pos)

    def test_ungerade_namenslaenge_wird_verworfen(self):
        ft = _filetime(2021, 6, 15)
        rec = bytearray(make_usn_record("x.txt", 0x200, ft))
        import struct
        struct.pack_into("<H", rec, 0x38, 9)                   # 10 -> 9 (ungerade)
        self.assertIsNone(usn_mod._parse_one(bytes(rec), 0))


class RecoverTests(unittest.TestCase):
    def test_abbruch_mitten_in_datei_hinterlaesst_keine_teildatei(self):
        img, _ = build_carving_image()
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        out_dir = tempfile.mkdtemp()
        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_ntfs=False, use_fat=False)).scan()
            calls = {"n": 0}

            def cancel():
                calls["n"] += 1
                return calls["n"] >= 3           # beim zweiten Block der ersten Datei

            with mock.patch.object(scanner_mod, "CHUNK", 64):
                ok, skipped, errors = scanner_mod.recover(src, findings, out_dir,
                                                          should_cancel=cancel)
            self.assertEqual((ok, skipped, errors), (0, 0, []))
            self.assertEqual(os.listdir(out_dir), [], "Teildatei blieb liegen")

            # Fortsetzung schreibt alles, ohne etwas zu ueberspringen.
            ok2, skipped2, _ = scanner_mod.recover(src, findings, out_dir)
            self.assertEqual((ok2, skipped2), (len(findings), 0))
            self.assertFalse(any(n.endswith(".part") for n in os.listdir(out_dir)))

    def test_gleiche_namen_werden_bei_fortsetzung_wiedererkannt(self):
        img, expected = build_carving_image()
        path = _write_temp(img)
        self.addCleanup(os.remove, path)
        out_dir = tempfile.mkdtemp()
        same = [Finding("carve", "PNG-Bild", "png", "bild.png", e["offset"], len(e["data"]))
                for e in expected[:2]]
        with ByteSource(path) as src:
            ok, skipped, _ = scanner_mod.recover(src, same, out_dir)
            self.assertEqual((ok, skipped), (2, 0))
            self.assertEqual(sorted(os.listdir(out_dir)), ["bild.png", "bild_1.png"])
            # Zweiter Lauf: beide bekannt -> beide uebersprungen, kein bild_2.
            ok, skipped, _ = scanner_mod.recover(src, same, out_dir)
            self.assertEqual((ok, skipped), (0, 2))
            self.assertEqual(sorted(os.listdir(out_dir)), ["bild.png", "bild_1.png"])
            # Dritter gleichnamiger Fund kommt dazu -> nur der wird geschrieben.
            third = Finding("carve", "PNG-Bild", "png", "bild.png",
                            expected[2]["offset"], len(expected[2]["data"]))
            ok, skipped, _ = scanner_mod.recover(src, same + [third], out_dir)
            self.assertEqual((ok, skipped), (1, 2))
            self.assertIn("bild_2.png", os.listdir(out_dir))


if __name__ == "__main__":
    unittest.main(verbosity=2)
