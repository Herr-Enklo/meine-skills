"""Erzeugt die Test-Images mit echten Dateisystemen (einmalig, nicht in den Tests).

Die Images entstehen mit den Werkzeugen, die auch im Alltag Dateisysteme
schreiben: ntfs-3g (NTFS), mtools (FAT, loescht wie DOS/Windows) und exfat-fuse
(exFAT). Anschliessend werden Dateien geloescht. Die Tests pruefen dann, ob die
Datenrettung Namen, Pfade und Inhalte wiederfindet.

Voraussetzungen: Linux, root, mkntfs/ntfs-3g, mtools, mkfs.vfat, mkfs.exfat,
exfat-fuse, losetup. Aufruf:

    sudo python3 erzeuge_fixtures.py

Ergebnis: ``*.img.gz`` und ``fixtures.json`` (erwartete Inhalte) in diesem Ordner.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(HERE)))
from tests.make_sample_image import make_jpeg  # noqa: E402

ENV = dict(os.environ, MTOOLS_SKIP_CHECK="1")
WORDS = ("Daten Rettung Datei Ordner Sicherung Bild Brief Rechnung Vertrag Notiz "
         "Kalkulation Entwurf Stand Anlage Seite Kapitel Zeile Liste").split()


def sh(*cmd, check=True):
    return subprocess.run(cmd, check=check, capture_output=True, env=ENV)


def text(n: int, seed: int) -> bytes:
    """Gut komprimierbarer, aber eindeutiger Text (haelt die Fixtures klein)."""
    rng = random.Random(seed)
    out = []
    size = 0
    line = 0
    while size < n:
        line += 1
        words = " ".join(rng.choice(WORDS) for _ in range(8))
        row = f"{seed:04d}-{line:06d} {words} äöü\n"
        out.append(row)
        size += len(row.encode())
    return "".join(out).encode()[:n]


def blocks(n: int, seed: int, block: int = 4096) -> bytes:
    """Je Block eindeutiger Kopf plus Fuellmuster: stark komprimierbar, aber jede
    Verwechslung oder Umordnung von Clustern aendert die Pruefsumme."""
    out = bytearray()
    i = 0
    while len(out) < n:
        head = f"<{seed:04d}:{i:07d}>".encode()
        out += head + b"." * (block - len(head))
        i += 1
    return bytes(out[:n])


def md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


class Mounted:
    """Haengt ein Image ueber FUSE ein (ntfs-3g direkt, exFAT ueber loop)."""

    def __init__(self, img: str, kind: str, options: str = ""):
        self.img, self.kind, self.options = img, kind, options
        self.mnt = tempfile.mkdtemp()
        self.loop = None

    def __enter__(self):
        if self.kind == "ntfs":
            args = ["ntfs-3g"] + (["-o", self.options] if self.options else []) + [self.img, self.mnt]
            sh(*args)
        else:
            self.loop = sh("losetup", "-f", "--show", self.img).stdout.decode().strip()
            sh("mount.exfat-fuse", self.loop, self.mnt)
        return self

    def path(self, rel: str) -> str:
        return os.path.join(self.mnt, rel)

    def write(self, rel: str, data: bytes) -> None:
        p = self.path(rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "wb") as fh:
            fh.write(data)
        os.sync()

    def fill_disk(self, byte: int = 0xCC) -> None:
        fd = os.open(self.path("fuellung.bin"), os.O_WRONLY | os.O_CREAT)
        for size in (1 << 20, 65536, 4096, 512):
            buf = bytes([byte]) * size
            while True:
                try:
                    if os.write(fd, buf) < size:
                        break
                except OSError:
                    break
        os.close(fd)
        os.sync()

    def __exit__(self, *exc):
        os.sync()
        sh("umount", self.mnt, check=False)
        if self.loop:
            sh("losetup", "-d", self.loop, check=False)
        os.rmdir(self.mnt)


def fragment(m: Mounted, count: int, hole: int, prefix: str = "fill") -> None:
    """Viele kleine Dateien anlegen, den Rest des Platzes belegen und dann jede
    zweite Datei loeschen: frei sind danach nur noch die Luecken."""
    for i in range(count):
        m.write(f"{prefix}/f{i:05d}.txt", blocks(hole, 9000 + i))
    m.fill_disk(0x00)
    for i in range(0, count, 2):
        os.remove(m.path(f"{prefix}/f{i:05d}.txt"))
    os.sync()


def save(img: str, name: str) -> None:
    with open(img, "rb") as src, gzip.open(os.path.join(HERE, name + ".img.gz"), "wb", 9) as dst:
        shutil.copyfileobj(src, dst)
    os.remove(img)


def build_ntfs(tmp: str) -> dict:
    img = os.path.join(tmp, "ntfs.img")
    sh("truncate", "-s", "16M", img)
    sh("mkntfs", "-Q", "-F", "-c", "4096", img)
    files = {
        "klein.txt": text(300, 1),
        "Ordner/Unterordner/tief.txt": text(5000, 2),
        "komprimiert/text.txt": text(150_000, 3),
        "Fotos/geloescht.jpg": make_jpeg(3000),
    }
    live_jpeg = make_jpeg(2500, seed=7)
    with Mounted(img, "ntfs", "compression") as m:
        os.makedirs(m.path("komprimiert"))
        sh("setfattr", "-h", "-v", "0x00000800", "-n", "system.ntfs_attrib_be",
           m.path("komprimiert"))
        for rel, data in files.items():
            m.write(rel, data)
        m.write("Fotos/vorhanden.jpg", live_jpeg)
        for top in ("klein.txt", "Ordner", "komprimiert", "Fotos/geloescht.jpg"):
            p = m.path(top)
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    save(img, "ntfs_echt")
    return {"deleted": {k: md5(v) for k, v in files.items()},
            "live_jpeg": md5(live_jpeg)}


def build_ntfs_overwritten(tmp: str) -> dict:
    img = os.path.join(tmp, "ntfs_ueberschrieben.img")
    sh("truncate", "-s", "8M", img)
    sh("mkntfs", "-Q", "-F", "-c", "4096", img)
    data = text(60_000, 4)
    with Mounted(img, "ntfs") as m:
        m.write("alt.txt", data)
        os.remove(m.path("alt.txt"))
        m.fill_disk(0xCC)
    save(img, "ntfs_ueberschrieben")
    return {"deleted": {"alt.txt": md5(data)}}


def build_ntfs4k(tmp: str) -> dict:
    img = os.path.join(tmp, "ntfs4k.img")
    sh("truncate", "-s", "16M", img)
    sh("mkntfs", "-Q", "-F", "-s", "4096", "-c", "4096", img)
    files = {"resident.txt": text(2000, 5), "gross.txt": text(40_000, 6)}
    with Mounted(img, "ntfs") as m:
        for rel, data in files.items():
            m.write(rel, data)
        for rel in files:
            os.remove(m.path(rel))
    save(img, "ntfs4k")
    return {"deleted": {k: md5(v) for k, v in files.items()}}


def build_ntfs_attrlist(tmp: str) -> dict:
    """Eine Datei, die nur noch in 4-KiB-Luecken passt: sie zerfaellt in so viele
    Stuecke, dass ihre Run-Liste ueber eine $ATTRIBUTE_LIST auf
    Erweiterungseintraege verteilt wird. Der Ordner mit den Fuellern wird so
    gross, dass ntfs-3g dessen $FILE_NAME ebenfalls auslagert."""
    img = os.path.join(tmp, "ntfs_attrlist.img")
    sh("truncate", "-s", "128M", img)
    sh("mkntfs", "-Q", "-F", "-c", "4096", img)
    data = blocks(4_000_000, 8)
    with Mounted(img, "ntfs") as m:
        fragment(m, 3000, 4096)
        m.write("fragmentiert.txt", data)       # passt nur noch in die Luecken
        os.remove(m.path("fragmentiert.txt"))
    save(img, "ntfs_attrlist")
    return {"deleted": {"fragmentiert.txt": md5(data)}}


def build_fat16(tmp: str) -> dict:
    img = os.path.join(tmp, "fat16.img")
    sh("truncate", "-s", "32M", img)
    sh("mkfs.vfat", "-F", "16", "-s", "4", "-n", "FAT16", img)

    def mcopy(rel: str, data: bytes) -> None:
        parts = rel.split("/")[:-1]
        for k in range(1, len(parts) + 1):
            sh("mmd", "-i", img, "::/" + "/".join(parts[:k]), check=False)
        local = os.path.join(tmp, "x")
        with open(local, "wb") as fh:
            fh.write(data)
        sh("mcopy", "-o", "-i", img, local, "::/" + rel)

    files = {
        "klein.txt": text(300, 11),
        "Urlaubsfoto vom Strand (1).jpg": make_jpeg(4000, seed=12),
        "Ordner/Unterordner/tief.txt": text(5000, 13),
    }
    for rel, data in files.items():
        mcopy(rel, data)
    for i in range(60):
        mcopy(f"fill/f{i:03d}.txt", text(2048, 9100 + i))
    for i in range(0, 60, 2):
        sh("mdel", "-i", img, f"::/fill/f{i:03d}.txt")
    frag = text(40_000, 14)
    mcopy("fragmentiert.txt", frag)                  # landet in den Luecken
    live = text(30_000, 15)
    for i in range(60, 90):
        mcopy(f"fill/f{i:03d}.txt", text(2048, 9100 + i))
    for i in range(60, 90, 2):
        sh("mdel", "-i", img, f"::/fill/f{i:03d}.txt")
    mcopy("lebendig.txt", live)                       # vorhanden und fragmentiert
    sh("mdel", "-i", img, "::/klein.txt")
    sh("mdel", "-i", img, "::/Urlaubsfoto vom Strand (1).jpg")
    sh("mdel", "-i", img, "::/fragmentiert.txt")
    sh("mdeltree", "-i", img, "::/Ordner")
    save(img, "fat16")
    files["fragmentiert.txt"] = frag
    return {"deleted": {k: md5(v) for k, v in files.items()}, "live": {"lebendig.txt": md5(live)}}


def build_fat32_small(tmp: str) -> dict:
    img = os.path.join(tmp, "fat32_klein.img")
    sh("truncate", "-s", "64M", img)
    sh("mkfs.vfat", "-F", "32", "-s", "8", "-n", "KLEIN", img)
    data = text(3000, 16)
    local = os.path.join(tmp, "x")
    with open(local, "wb") as fh:
        fh.write(data)
    sh("mcopy", "-i", img, local, "::/notiz.txt")
    sh("mdel", "-i", img, "::/notiz.txt")
    save(img, "fat32_klein")
    return {"deleted": {"notiz.txt": md5(data)}}


def build_exfat(tmp: str) -> dict:
    img = os.path.join(tmp, "exfat.img")
    sh("truncate", "-s", "32M", img)
    sh("mkfs.exfat", "-c", "4K", img)
    files = {
        "klein.txt": text(300, 21),
        "Ordner/Unterordner/tief.txt": text(5000, 22),
    }
    frag = text(60_000, 23)
    with Mounted(img, "exfat") as m:
        for rel, data in files.items():
            m.write(rel, data)
        fragment(m, 40, 4096)
        m.write("fragmentiert.txt", frag)       # passt nur noch in die Luecken
        os.remove(m.path("klein.txt"))
        shutil.rmtree(m.path("Ordner"))
        os.remove(m.path("fragmentiert.txt"))
    save(img, "exfat")
    files["fragmentiert.txt"] = frag
    return {"deleted": {k: md5(v) for k, v in files.items()}}


def main() -> None:
    tmp = tempfile.mkdtemp()
    expected = {
        "ntfs_echt": build_ntfs(tmp),
        "ntfs_ueberschrieben": build_ntfs_overwritten(tmp),
        "ntfs4k": build_ntfs4k(tmp),
        "ntfs_attrlist": build_ntfs_attrlist(tmp),
        "fat16": build_fat16(tmp),
        "fat32_klein": build_fat32_small(tmp),
        "exfat": build_exfat(tmp),
    }
    with open(os.path.join(HERE, "fixtures.json"), "w", encoding="utf-8") as fh:
        json.dump(expected, fh, indent=2, ensure_ascii=False)
    shutil.rmtree(tmp)
    for name in sorted(os.listdir(HERE)):
        if name.endswith(".gz"):
            print(f"{name:<32} {os.path.getsize(os.path.join(HERE, name)) / 1024:8.1f} KiB")


if __name__ == "__main__":
    main()
