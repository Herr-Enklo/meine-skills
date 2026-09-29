"""Regressionstests zu den Befunden des Reviews.

Jeder Test haelt einen vorher nachgestellten Fehler fest. Ein Teil nutzt kleine
Images echter Dateisysteme aus ``tests/fixtures`` (erzeugt mit ntfs-3g, mtools
und exfat-fuse, siehe ``erzeuge_fixtures.py``); die uebrigen bauen ihre Daten
selbst.

Ausfuehren:
    python -m unittest datenrettung.tests.test_befunde
"""

from __future__ import annotations

import atexit
import errno
import gzip
import hashlib
import io
import json
import ntpath
import os
import random
import shutil
import struct
import sys
import tempfile
import time
import unittest
import zipfile
from unittest import mock

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from datenrettung.recovery import ByteSource, Scanner, ScanOptions, extract  # noqa: E402
from datenrettung.recovery import carver  # noqa: E402
from datenrettung.recovery import drives as drives_mod  # noqa: E402
from datenrettung.recovery import exfat as exfat_mod  # noqa: E402
from datenrettung.recovery import fat as fat_mod  # noqa: E402
from datenrettung.recovery import lznt1  # noqa: E402
from datenrettung.recovery import ntfs as ntfs_mod  # noqa: E402
from datenrettung.recovery import scanner as scanner_mod  # noqa: E402
from datenrettung.recovery import sources as sources_mod  # noqa: E402
from datenrettung.recovery.models import Finding  # noqa: E402
from datenrettung.gui.sorting import order_indices  # noqa: E402
from datenrettung.tests import make_sample_image as msi  # noqa: E402

FIXTURES = os.path.join(_HERE, "fixtures")
with open(os.path.join(FIXTURES, "fixtures.json"), encoding="utf-8") as _fh:
    EXPECTED = json.load(_fh)

_TMP = tempfile.mkdtemp(prefix="datenrettung_test_")
atexit.register(shutil.rmtree, _TMP, True)
_UNPACKED: dict = {}


def fixture(name: str) -> str:
    """Entpackt ein Fixture-Image einmalig in ein Temp-Verzeichnis."""
    if name not in _UNPACKED:
        path = os.path.join(_TMP, name + ".img")
        with gzip.open(os.path.join(FIXTURES, name + ".img.gz")) as src, open(path, "wb") as dst:
            shutil.copyfileobj(src, dst)
        _UNPACKED[name] = path
    return _UNPACKED[name]


def write_temp(data: bytes) -> str:
    fd, path = tempfile.mkstemp(suffix=".img", dir=_TMP)
    with os.fdopen(fd, "wb") as fh:
        fh.write(data)
    return path


def _read(path: str) -> bytes:
    with open(path, "rb") as fh:
        return fh.read()


def md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def scan(path: str, **options):
    """Scannt ein Image; Rueckgabe (Funde, {md5: Fund}, Scanner)."""
    with ByteSource(path) as src:
        scanner = Scanner(src, ScanOptions(**options))
        findings = scanner.scan()
        by_md5 = {}
        for f in findings:
            by_md5.setdefault(md5(extract(src, f)), f)
    return findings, by_md5, scanner


# -- Echte Dateisysteme ----------------------------------------------------------

class EchteNtfsTests(unittest.TestCase):
    def test_geloeschte_dateien_mit_pfad_und_inhalt(self):
        _, by_md5, _ = scan(fixture("ntfs_echt"))
        for rel, digest in EXPECTED["ntfs_echt"]["deleted"].items():
            self.assertIn(digest, by_md5, f"{rel}: Inhalt nicht wiederhergestellt")
            self.assertEqual(by_md5[digest].path(), rel)

    def test_ntfs_komprimierte_datei_wird_entpackt(self):
        _, by_md5, _ = scan(fixture("ntfs_echt"))
        digest = EXPECTED["ntfs_echt"]["deleted"]["komprimiert/text.txt"]
        self.assertIn(digest, by_md5, "komprimierte Datei kam als Rohdaten heraus")
        self.assertTrue(by_md5[digest].extra.get("compressed"))

    def test_carving_nur_im_freien_speicher_und_ohne_dubletten(self):
        live = EXPECTED["ntfs_echt"]["live_jpeg"]
        deleted = EXPECTED["ntfs_echt"]["deleted"]["Fotos/geloescht.jpg"]
        findings, by_md5, _ = scan(fixture("ntfs_echt"))
        self.assertNotIn(live, by_md5, "vorhandene Datei wurde gecarvt")
        with ByteSource(fixture("ntfs_echt")) as src:
            copies = [f for f in findings if md5(extract(src, f)) == deleted]
        self.assertEqual(len(copies), 1, "geloeschtes Foto doppelt (Dateisystem + Carving)")
        _, by_md5_all, _ = scan(fixture("ntfs_echt"), carve_free_only=False)
        self.assertEqual(by_md5_all[live].kind, "carve",
                         "mit --carve-all muss auch der belegte Bereich durchsucht werden")

    def test_ueberschriebene_datei_wird_markiert(self):
        findings, _, _ = scan(fixture("ntfs_ueberschrieben"))
        match = next(f for f in findings if f.path() == "alt.txt")
        self.assertEqual(match.extra["state"], "überschrieben")

    def test_4k_sektoren_fixups_im_abstand_von_512_byte(self):
        _, by_md5, _ = scan(fixture("ntfs4k"))
        for rel, digest in EXPECTED["ntfs4k"]["deleted"].items():
            self.assertIn(digest, by_md5, f"{rel}: auf 4K-Sektoren beschaedigt")

    def test_attributliste_verteilte_runs_und_ausgelagerte_namen(self):
        findings, by_md5, _ = scan(fixture("ntfs_attrlist"))
        digest = EXPECTED["ntfs_attrlist"]["deleted"]["fragmentiert.txt"]
        self.assertIn(digest, by_md5, "stark fragmentierte Datei unvollstaendig")
        match = by_md5[digest]
        with ByteSource(fixture("ntfs_attrlist")) as src:
            boot = ntfs_mod.BootSector(src.read(0, 512))
            reader = ntfs_mod.MftReader(src, boot, 0)
            info = ntfs_mod.gather(reader.read_record(match.extra["record"]),
                                   match.extra["record"], reader)
        self.assertTrue(info.has_attribute_list, "Testdatei hat keine $ATTRIBUTE_LIST")
        self.assertGreater(len(info.data), 1, "Run-Liste nicht aus Erweiterungseintraegen")
        # ntfs-3g entfernt beim Loeschen den ausgelagerten Namen; der Inhalt muss
        # trotzdem vollstaendig kommen, unter einem Ersatznamen.
        self.assertTrue(match.path().startswith("(ohne Namen)/"), match.path())
        # Der Ordner "fill" hat so viele Eintraege, dass ntfs-3g seinen Namen in
        # einen Erweiterungseintrag verschiebt; die Pfade muessen ihn trotzdem zeigen.
        fill = [f for f in findings if f.path().endswith(".txt") and "f0" in f.path()]
        self.assertTrue(fill and all(f.path().startswith("fill/") for f in fill))


class EchteFatTests(unittest.TestCase):
    def test_fat16_geloeschter_ordner_langname_und_fragmente(self):
        _, by_md5, _ = scan(fixture("fat16"))
        want = EXPECTED["fat16"]["deleted"]
        paths = {
            "klein.txt": "_lein.txt",                         # Kleinschreibung aus Byte 0x0C
            "Urlaubsfoto vom Strand (1).jpg": "Urlaubsfoto vom Strand (1).jpg",
            "Ordner/Unterordner/tief.txt": "Ordner/Unterordner/_ief.txt",
            "fragmentiert.txt": "fragmentiert.txt",
        }
        for rel, digest in want.items():
            self.assertIn(digest, by_md5, f"{rel}: nicht oder falsch wiederhergestellt")
            self.assertEqual(by_md5[digest].path(), paths[rel])
        self.assertEqual(by_md5[want["fragmentiert.txt"]].extra["state"], "zusammengesetzt")

    def test_fat16_vorhandene_fragmentierte_datei_folgt_der_kette(self):
        _, by_md5, _ = scan(fixture("fat16"), deleted_only=False)
        digest = EXPECTED["fat16"]["live"]["lebendig.txt"]
        self.assertIn(digest, by_md5, "vorhandene Datei nicht ueber die FAT-Kette gelesen")

    def test_fat32_layout_mit_wenigen_clustern(self):
        _, by_md5, _ = scan(fixture("fat32_klein"))
        self.assertIn(EXPECTED["fat32_klein"]["deleted"]["notiz.txt"], by_md5)

    def test_exfat_geloeschter_ordner_und_fragmente(self):
        _, by_md5, _ = scan(fixture("exfat"))
        for rel, digest in EXPECTED["exfat"]["deleted"].items():
            self.assertIn(digest, by_md5, f"{rel}: nicht oder falsch wiederhergestellt")
            self.assertEqual(by_md5[digest].path(), rel)


# -- NTFS-Robustheit ----------------------------------------------------------------

def _record_offset(n: int) -> int:
    return msi.MFT_LCN * msi.CLUSTER + n * msi.RECORD_SIZE


class NtfsRobustheitTests(unittest.TestCase):
    def test_kaputter_eintrag_kostet_nicht_das_ganze_volume(self):
        img, exp = msi.build_ntfs_image()
        img = bytearray(img)
        rec1 = _record_offset(1)
        struct.pack_into("<H", img, rec1 + 0x14, 0x3E0)        # erstes Attribut fast am Ende
        struct.pack_into("<II", img, rec1 + 0x3E0, 0x30, 16)
        path = write_temp(bytes(img))
        findings, by_md5, _ = scan(path, use_carve=False)
        self.assertIn(md5(exp["data"]), by_md5)

    def test_leere_mft_runliste_faellt_auf_lineares_lesen_zurueck(self):
        img, exp = msi.build_ntfs_image()
        img = bytearray(img)
        rec0 = _record_offset(0)
        off = struct.unpack_from("<H", img, rec0 + 0x14)[0]
        runs_off = struct.unpack_from("<H", img, rec0 + off + 0x20)[0]
        img[rec0 + off + runs_off] = 0x00
        _, by_md5, _ = scan(write_temp(bytes(img)), use_carve=False)
        self.assertIn(md5(exp["data"]), by_md5)

    def test_riesige_mft_groesse_haengt_nicht(self):
        img, exp = msi.build_ntfs_image()
        img = bytearray(img)
        rec0 = _record_offset(0)
        off = struct.unpack_from("<H", img, rec0 + 0x14)[0]
        struct.pack_into("<Q", img, rec0 + off + 0x30, 0xFFFFFFFFFFFFFF00)
        start = time.monotonic()
        _, by_md5, _ = scan(write_temp(bytes(img)), use_carve=False)
        self.assertLess(time.monotonic() - start, 10)
        self.assertIn(md5(exp["data"]), by_md5)

    def test_absurde_bootsektor_werte_werden_abgelehnt(self):
        img, _ = msi.build_ntfs_image()
        for offset, value in ((0x0D, 0x81), (0x40, 0x81)):
            bad = bytearray(img[:512])
            bad[offset] = value
            with self.assertRaises(ntfs_mod.NtfsError):
                ntfs_mod.BootSector(bytes(bad))
        bad = bytearray(img[:512])
        struct.pack_into("<Q", bad, 0x30, 1 << 48)                 # MFT weit hinter dem Volume
        with self.assertRaises(ntfs_mod.NtfsError):
            ntfs_mod.BootSector(bytes(bad))

    def test_kopie_des_bootsektors_wird_genutzt(self):
        img, exp = msi.build_ntfs_image()
        disk = bytearray(img) + bytes(512)
        disk[len(img):len(img) + 512] = img[:512]                  # Kopie hinter dem letzten Sektor
        struct.pack_into("<Q", disk, 0x30, 1 << 40)                 # Original: MFT-Zeiger zerstoert
        _, by_md5, scanner = scan(write_temp(bytes(disk)), use_carve=False)
        self.assertIn(md5(exp["data"]), by_md5)
        self.assertTrue(any("Kopie" in w for w in scanner.warnings), scanner.warnings)

    def test_orphan_scan_nutzt_geometrie_des_richtigen_volumes(self):
        vol1, _ = msi.build_ntfs_image()
        vol2 = bytearray(msi.build_ntfs_image()[0])
        payload = b"INHALT DER ZWEITEN PARTITION....."
        vol2[30 * msi.CLUSTER:30 * msi.CLUSTER + len(payload)] = payload
        rec = msi._blank_record(flags=0x00)
        runs = bytes([0x11, 1, 30, 0x00])
        msi._put_attrs(rec, [
            msi._resident_attr(0x30, msi._file_name_content("alt.bin")),
            msi._nonresident_data_attr(runs, len(payload), 0),
        ])
        vol2[0x2800:0x2800 + msi.RECORD_SIZE] = rec                # ausserhalb der MFT
        part1, part2 = 2048, 4096
        disk = bytearray(part2 * 512 + len(vol2))
        disk[0x1BE + 4] = 0x07
        struct.pack_into("<II", disk, 0x1BE + 8, part1, len(vol1) // 512)
        disk[0x1CE + 4] = 0x07
        struct.pack_into("<II", disk, 0x1CE + 8, part2, len(vol2) // 512)
        struct.pack_into("<H", disk, 510, 0xAA55)
        disk[part1 * 512:part1 * 512 + len(vol1)] = vol1
        disk[part2 * 512:part2 * 512 + len(vol2)] = vol2
        _, by_md5, _ = scan(write_temp(bytes(disk)), use_carve=False, ntfs_orphan_scan=True)
        self.assertIn(md5(payload), by_md5, "Orphan-Fund mit falscher Volume-Geometrie gelesen")

    def test_logisches_laufwerk_in_erweiterter_partition(self):
        vol, exp = msi.build_ntfs_image()
        ext_lba, logical_rel = 2048, 2048
        disk = bytearray((ext_lba + logical_rel) * 512 + len(vol))
        disk[0x1BE + 4] = 0x0F                                      # erweiterte Partition
        struct.pack_into("<II", disk, 0x1BE + 8, ext_lba, logical_rel + len(vol) // 512)
        struct.pack_into("<H", disk, 510, 0xAA55)
        ebr = ext_lba * 512
        disk[ebr + 0x1BE + 4] = 0x07
        struct.pack_into("<II", disk, ebr + 0x1BE + 8, logical_rel, len(vol) // 512)
        struct.pack_into("<H", disk, ebr + 510, 0xAA55)
        disk[(ext_lba + logical_rel) * 512:] = vol
        _, by_md5, _ = scan(write_temp(bytes(disk)), use_carve=False)
        self.assertIn(md5(exp["data"]), by_md5, "logisches Laufwerk nicht gefunden")

    def test_kaputte_gpt_bricht_den_scan_nicht_ab(self):
        png = msi.make_png()
        for field, value in ((72, 0xFFFFFFFFFFFFFFF0), (84, 0xFFFFFF00)):
            disk = bytearray(64 * 1024)
            disk[0x1BE + 4] = 0xEE
            struct.pack_into("<I", disk, 0x1BE + 8, 1)
            struct.pack_into("<H", disk, 510, 0xAA55)
            disk[512:520] = b"EFI PART"
            struct.pack_into("<QII", disk, 512 + 72, 2, 128, 128)
            if field == 72:
                struct.pack_into("<Q", disk, 512 + 72, value)
            else:
                struct.pack_into("<I", disk, 512 + 84, value)
            disk[32768:32768 + len(png)] = png
            findings, _, _ = scan(write_temp(bytes(disk)))
            self.assertTrue(any(f.ext == "png" for f in findings),
                            "kaputte GPT hat den ganzen Scan abgebrochen")


# -- FAT/exFAT-Robustheit ---------------------------------------------------------

class FatExfatRobustheitTests(unittest.TestCase):
    def test_abgeschnittenes_fat32_image_wirft_nicht(self):
        img, _ = msi.build_fat32_image()
        cut = write_temp(img[:40 * 512])                            # mitten in der FAT
        with ByteSource(cut) as src:
            list(fat_mod.scan_fat(src, 0))                          # darf nicht werfen

    def test_exfat_riesige_verzeichnislaenge_wird_begrenzt(self):
        img, _ = msi.build_exfat_image()
        with ByteSource(write_temp(img)) as src:
            boot = exfat_mod.ExfatBoot(src.read(0, 512))
            walker = exfat_mod._Walker(src, boot, True, None)
            data = walker.read_directory(2, True, 1 << 40, False)
            self.assertLessEqual(len(data), exfat_mod.MAX_DIR_BYTES)

    def test_exfat_clustergroesse_ueber_32_mib_wird_abgelehnt(self):
        img, _ = msi.build_exfat_image()
        bad = bytearray(img[:512])
        bad[0x6C], bad[0x6D] = 12, 25
        with self.assertRaises(exfat_mod.ExfatError):
            exfat_mod.ExfatBoot(bytes(bad))


# -- Carving ---------------------------------------------------------------------

def _carve_all(data: bytes, **kwargs):
    path = write_temp(data)
    with ByteSource(path) as src:
        found = []
        for f in carver.carve(src, **kwargs):
            found.append((f, extract(src, f)))
        return found, src.bytes_read


class CarvingBefundTests(unittest.TestCase):
    def test_fragmentiertes_jpeg_verschluckt_nicht_das_naechste(self):
        a = msi.make_jpeg(6000, seed=1)[:4096]                     # Fragment ohne Ende
        b = msi.make_jpeg(2000, seed=2)
        found, _ = _carve_all(bytes(512) + a + b + bytes(512))
        by_off = {f.offset: (f, d) for f, d in found}
        self.assertTrue(by_off[512][0].extra["partial"])
        self.assertEqual(by_off[512][0].size, 4096)
        self.assertIn(512 + 4096, by_off, "das folgende JPEG wurde verschluckt")
        self.assertEqual(by_off[512 + 4096][1], b)

    def test_abgeschnittenes_jpeg_mit_vorschau_behaelt_seine_daten(self):
        payload = b"Exif\x00\x00" + msi.make_jpeg(50, seed=3)
        app1 = b"\xff\xe1" + struct.pack(">H", 2 + len(payload)) + payload
        head = msi.jpeg_head()
        rng = random.Random(4)
        body = head[:2] + app1 + head[2:] + bytes(rng.randrange(0, 255) for _ in range(20000))
        found, _ = _carve_all(bytes(512) + body + bytes(8192))
        main = next(f for f, _ in found if f.offset == 512)
        self.assertTrue(main.extra["partial"])
        self.assertGreaterEqual(main.size, len(body))
        self.assertLess(main.size, len(body) + 512)
        self.assertEqual([f.offset for f, _ in found if f.ext == "jpg"], [512],
                         "Vorschaubild zusaetzlich als eigene Datei gemeldet")

    def test_zip_mit_gespeichertem_zip_wird_nicht_abgeschnitten(self):
        inner = io.BytesIO()
        with zipfile.ZipFile(inner, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("word/document.xml", "<w:p>x</w:p>" * 100)
        outer = io.BytesIO()
        with zipfile.ZipFile(outer, "w") as zf:
            zf.writestr("lib/inner.jar", inner.getvalue(), compress_type=zipfile.ZIP_STORED)
            zf.writestr("Notiz.txt", "Die Notiz gehoert zum aeusseren Archiv.\n")
        data = outer.getvalue()
        found, _ = _carve_all(bytes(512) + data + bytes(512))
        zips = [(f, d) for f, d in found if f.ext == "zip"]
        self.assertEqual(len(zips), 1)
        self.assertEqual(zips[0][1], data)

    def test_pdf_mit_zeilenende_und_zwei_pdfs_hintereinander(self):
        first = msi.make_pdf() + b"\n"
        second = b"%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\r\n"
        found, _ = _carve_all(bytes(512) + first + second + bytes(512))
        pdfs = sorted(((f.offset, d) for f, d in found if f.ext == "pdf"))
        self.assertEqual([d for _o, d in pdfs], [first, second])

    def test_rtf_maskierter_backslash_vor_klammer(self):
        rtf = b"{\\rtf1 Pfad C:\\\\{\\b fett} und \\{ literal \\} Ende}"
        found, _ = _carve_all(bytes(512) + rtf + b"}}}" + bytes(512))
        rtfs = [(f, d) for f, d in found if f.ext == "rtf"]
        self.assertEqual(rtfs[0][1], rtf)
        self.assertFalse(rtfs[0][0].extra["partial"])

    def test_gzip_exakt_und_keine_fehltreffer_in_zufallsdaten(self):
        import gzip as gz
        packed = gz.compress(b"Rechnung 2023\n" * 5000)
        found, _ = _carve_all(bytes(512) + packed + os.urandom(4096) + bytes(512))
        gzs = [d for f, d in found if f.ext == "gz"]
        self.assertEqual(gzs, [packed])
        noise = bytearray(random.Random(5).randbytes(8 * 1024 * 1024))
        found, _ = _carve_all(bytes(noise))
        self.assertEqual([f for f, _ in found if f.ext == "gz"], [])
        self.assertLessEqual(sum(1 for f, _ in found if f.ext == "jpg"), 1)

    def test_7z_und_sqlite_mit_exakter_groesse(self):
        import sqlite3
        import zlib
        body = b"7z-Inhalt " * 50
        tail = b"NEXTHDR"
        start_hdr = struct.pack("<QQI", len(body), len(tail), zlib.crc32(tail))
        sevenz = (b"7z\xbc\xaf\x27\x1c\x00\x04" + struct.pack("<I", zlib.crc32(start_hdr))
                  + start_hdr + body + tail)
        db_path = os.path.join(_TMP, "t.sqlite")
        con = sqlite3.connect(db_path)
        con.execute("create table t(x)")
        con.executemany("insert into t values (?)", [("Zeile %d" % i,) for i in range(500)])
        con.commit()
        con.close()
        with open(db_path, "rb") as fh:
            db = fh.read()
        found, _ = _carve_all(bytes(512) + sevenz + bytes(1024) + db + bytes(4096))
        by_ext = {f.ext: d for f, d in found}
        self.assertEqual(by_ext.get("7z"), sevenz)
        self.assertEqual(by_ext.get("sqlite"), db)

    def test_kopf_am_rand_eines_leeren_blocks_wird_gefunden(self):
        ico = struct.pack("<HHH", 0, 1, 1) + struct.pack("<BBBBHHII", 16, 16, 0, 0, 1, 32, 40, 22) \
            + b"\xaa" * 40
        data = bytearray(4 * 65536)
        pos = 65536 - 2                                            # 00 00 im leeren Block
        data[pos:pos + len(ico)] = ico
        found, _ = _carve_all(bytes(data))
        self.assertIn(pos, [f.offset for f, _ in found if f.ext == "ico"])

    def test_footer_suche_liest_nicht_megabytes_je_kandidat(self):
        png = msi.make_png()
        data = bytearray()
        for _ in range(2000):
            data += png + bytes(512 - len(png) % 512)
        found, bytes_read = _carve_all(bytes(data))
        self.assertEqual(sum(1 for f, _ in found if f.ext == "png"), 2000)
        self.assertLess(bytes_read, 400 * len(data),
                        f"{bytes_read / len(data):.0f}-fach gelesen")


# -- Scanner -----------------------------------------------------------------------

class ScannerBefundTests(unittest.TestCase):
    def test_bitlocker_wird_gemeldet_und_nicht_gecarvt(self):
        png = msi.make_png()
        part = 2048
        size = 1024 * 1024
        disk = bytearray(part * 512 + size + 65536)
        disk[0x1BE + 4] = 0x07
        struct.pack_into("<II", disk, 0x1BE + 8, part, size // 512)
        struct.pack_into("<H", disk, 510, 0xAA55)
        disk[part * 512 + 3:part * 512 + 11] = b"-FVE-FS-"
        inside = part * 512 + 65536
        outside = part * 512 + size + 4096
        disk[inside:inside + len(png)] = png
        disk[outside:outside + len(png)] = png
        findings, _, scanner = scan(write_temp(bytes(disk)))
        self.assertTrue(any("BitLocker" in w for w in scanner.warnings), scanner.warnings)
        offsets = [f.offset for f in findings if f.ext == "png"]
        self.assertEqual(offsets, [outside])

    def test_usn_journal_nutzt_den_eintrag_aus_dem_mft_scan(self):
        from datenrettung.recovery import usn as usn_mod
        img, exp = msi.build_ntfs_image(usn="direct")
        path = write_temp(img)
        with ByteSource(path) as src:
            info: dict = {}
            list(ntfs_mod.scan_ntfs(src, 0, info=info))
            self.assertIn("usn_record", info)
            # Ohne zweiten MFT-Durchlauf (record_count = 0) nur ueber den Hinweis.
            with mock.patch.object(ntfs_mod.MftReader, "record_count", return_value=0):
                found = list(usn_mod.scan_usn(src, 0, allow_carve=False,
                                              record_hint=info["usn_record"]))
        self.assertEqual([f.extra["usn_name"] for f in found], [exp["usn_deleted"]])


# -- Wiederherstellung --------------------------------------------------------------

class RecoverBefundTests(unittest.TestCase):
    def _source(self):
        img, expected = msi.build_carving_image()
        return write_temp(img), expected

    def test_fortsetzung_ist_unabhaengig_von_reihenfolge_und_namen(self):
        path, expected = self._source()
        out = tempfile.mkdtemp(dir=_TMP)
        a = Finding("carve", "PNG", "png", "bild.png", expected[0]["offset"], len(expected[0]["data"]))
        b = Finding("carve", "JPG", "png", "bild.png", expected[1]["offset"], len(expected[1]["data"]))
        with ByteSource(path) as src:
            self.assertEqual(scanner_mod.recover(src, [b], out)[:2], (1, 0))
            ok, skipped, _ = scanner_mod.recover(src, [a, b], out)
        self.assertEqual((ok, skipped), (1, 1), "erster Fund faelschlich als vorhanden gewertet")
        contents = sorted(_read(os.path.join(out, n))
                          for n in os.listdir(out) if n != scanner_mod.MANIFEST)
        self.assertEqual(contents, sorted([expected[0]["data"], expected[1]["data"]]))

    def test_lange_namen_werden_gekuerzt_statt_zu_scheitern(self):
        path, expected = self._source()
        out = tempfile.mkdtemp(dir=_TMP)
        name = "000002_" + "Ordner mit Umlauten äöü_" * 20 + ".xlsx"
        f = Finding("carve", "X", "xlsx", name, expected[0]["offset"], len(expected[0]["data"]))
        with ByteSource(path) as src:
            ok, _, errors = scanner_mod.recover(src, [f], out)
        self.assertEqual((ok, errors), (1, []))
        written = [n for n in os.listdir(out) if n != scanner_mod.MANIFEST][0]
        self.assertLessEqual(len(written.encode("utf-8")), 240)
        self.assertTrue(written.startswith("000002_") and written.endswith(".xlsx"))

    def test_aenderungszeit_wird_uebernommen(self):
        img, exp = msi.build_ntfs_image()
        path = write_temp(img)
        out = tempfile.mkdtemp(dir=_TMP)
        with ByteSource(path) as src:
            findings = Scanner(src, ScanOptions(use_carve=False)).scan()
            scanner_mod.recover(src, findings, out)
        target = os.path.join(out, findings[0].name)
        self.assertEqual(time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(os.stat(target).st_mtime)),
                         exp["modified"])

    def test_voller_zieldatentraeger_bricht_mit_klarer_meldung_ab(self):
        path, expected = self._source()
        out = tempfile.mkdtemp(dir=_TMP)
        findings = [Finding("carve", "X", "png", f"{i}.png", e["offset"], len(e["data"]))
                    for i, e in enumerate(expected)]
        real_open = open

        def full_open(file, mode="r", *args, **kwargs):
            if "w" in mode and str(file).endswith(".part"):
                raise OSError(errno.ENOSPC, "No space left on device")
            return real_open(file, mode, *args, **kwargs)

        with ByteSource(path) as src, mock.patch("builtins.open", full_open):
            ok, _, errors = scanner_mod.recover(src, findings, out)
        self.assertEqual(ok, 0)
        self.assertEqual(len(errors), 1)
        self.assertIn("voll", errors[0])

    def test_dateien_einer_frueheren_version_werden_erkannt(self):
        path, expected = self._source()
        out = tempfile.mkdtemp(dir=_TMP)
        f = Finding("carve", "X", "png", "alt.png", expected[0]["offset"], len(expected[0]["data"]))
        with open(os.path.join(out, "alt.png"), "wb") as fh:          # ohne Protokoll
            fh.write(expected[0]["data"])
        with ByteSource(path) as src:
            ok, skipped, _ = scanner_mod.recover(src, [f], out)
        self.assertEqual((ok, skipped), (0, 1))


# -- Quelle, Laufwerke, LZNT1, Sortierung ----------------------------------------------

class SourceBefundTests(unittest.TestCase):
    def test_defekter_bereich_wird_uebersprungen_statt_sektorweise_gelesen(self):
        path = write_temp(bytes(16 * 1024 * 1024))
        bad_lo, bad_hi = 4 * 1024 * 1024, 12 * 1024 * 1024
        real_read, real_lseek = os.read, os.lseek
        pos = {"v": 0}
        calls = {"n": 0}

        def flseek(fd, p, how):
            pos["v"] = real_lseek(fd, p, how)
            return pos["v"]

        def fread(fd, n):
            calls["n"] += 1
            p = pos["v"]
            if p < bad_hi and p + n > bad_lo:
                raise OSError(5, "Input/output error")
            data = real_read(fd, n)
            pos["v"] = p + len(data)
            return data

        with mock.patch.object(sources_mod.os, "read", fread), \
                mock.patch.object(sources_mod.os, "lseek", flseek):
            with ByteSource(path) as src:
                total = sum(len(d) for _o, d in src.stream())
                self.assertEqual(total, 16 * 1024 * 1024)
                self.assertLess(calls["n"], 2000, "defekter Bereich Sektor fuer Sektor gelesen")
                self.assertGreater(src.skipped_sectors, 0)

    def test_lesen_hinter_dem_ende_liefert_nichts(self):
        path = write_temp(bytes(4096))
        with ByteSource(path) as src:
            self.assertEqual(src.read(8192, 512), b"")
            self.assertEqual(len(src.read(4000, 512)), 96)


class DrivesBefundTests(unittest.TestCase):
    def test_ausgabeordner_auf_der_quelle_wird_erkannt(self):
        with mock.patch.object(drives_mod.os, "path", ntpath), \
                mock.patch.object(drives_mod, "windows_disk_letters", return_value=["D", "E"]):
            check = drives_mod._output_on_source_windows
            self.assertIsNotNone(check("\\\\.\\D:", "D:\\Gerettet"))
            self.assertIsNone(check("\\\\.\\D:", "E:\\Gerettet"))
            self.assertIsNotNone(check("\\\\.\\PhysicalDrive1", "E:\\Gerettet"))
            self.assertIsNone(check("\\\\.\\PhysicalDrive1", "F:\\Gerettet"))
            self.assertIsNone(check("\\\\.\\D:", "\\\\server\\freigabe\\x"))

    def test_image_datei_als_quelle_ist_unkritisch(self):
        self.assertIsNone(drives_mod.output_on_source("disk.img", _TMP))


class Lznt1Tests(unittest.TestCase):
    def test_rueckverweis_und_auffuellen(self):
        token = ((8 - 1) << 12) | (16 - 3)                          # 8 zurueck, 16 lang
        chunk = b"\x00abcdefgh" + b"\x01" + struct.pack("<H", token)
        data = struct.pack("<H", 0x8000 | (len(chunk) - 1)) + chunk
        self.assertEqual(lznt1.decompress(data, 24), b"abcdefgh" * 3)
        self.assertEqual(lznt1.decompress(data, 5000)[24:], bytes(5000 - 24))

    def test_unkomprimierter_block(self):
        raw = bytes(range(256)) * 16
        data = struct.pack("<H", 0x0000 | (len(raw) - 1)) + raw
        self.assertEqual(lznt1.decompress(data, 4096), raw)

    def test_kaputter_rueckverweis_wird_erkannt(self):
        chunk = b"\x01" + struct.pack("<H", 0xF000)                 # Verweis am Blockanfang
        data = struct.pack("<H", 0x8000 | (len(chunk) - 1)) + chunk
        with self.assertRaises(lznt1.Lznt1Error):
            lznt1.decompress(data, 4096)


class SortierungBefundTests(unittest.TestCase):
    def test_herkunft_numerisch_und_zustand_nach_verlaesslichkeit(self):
        fs = [Finding("carve", "X", "bin", "a", 0x10000, 1, {"state": "unvollständig"}),
              Finding("carve", "X", "bin", "b", 0x2000, 1, {"state": "vollständig"}),
              Finding("carve", "X", "bin", "c", 0x100, 1, {"state": "überschrieben"})]
        self.assertEqual(order_indices(fs, "quelle", False), [2, 1, 0])
        self.assertEqual(order_indices(fs, "zustand", False), [1, 0, 2])


if __name__ == "__main__":
    unittest.main(verbosity=2)
