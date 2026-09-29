"""LZNT1-Dekompression fuer NTFS-komprimierte Dateien.

NTFS komprimiert Dateien in Einheiten von meist 16 Clustern (``compression
unit``). Passt eine Einheit komprimiert in weniger Cluster, stehen dort die
LZNT1-Daten, der Rest der Einheit ist "sparse". Die Daten bestehen aus
Bloecken zu hoechstens 4096 Byte Ausgabe; jeder Block beginnt mit einem
2-Byte-Kopf (Bit 15 = komprimiert, Bits 0-11 = Laenge der Blockdaten - 1).
Komprimierte Bloecke bestehen aus Gruppen von acht Zeichen: ein Flag-Byte,
dann je Bit ein Literal (1 Byte) oder ein Rueckverweis (2 Byte), dessen
Aufteilung in Abstand und Laenge von der aktuellen Position im Block abhaengt.

Eigene Umsetzung nach der oeffentlichen Formatbeschreibung [MS-XCA] 2.5.
"""

from __future__ import annotations

BLOCK = 4096


class Lznt1Error(ValueError):
    pass


def decompress(data: bytes, out_size: int) -> bytes:
    """Entpackt ``data`` zu hoechstens ``out_size`` Bytes.

    Ein Block, der kuerzer als 4096 Byte entpackt, wird mit Nullen aufgefuellt
    (so verhaelt sich NTFS). Fehlt am Ende Ausgabe, wird ebenfalls mit Nullen
    aufgefuellt. Beschaedigte Daten fuehren zu ``Lznt1Error``.
    """
    out = bytearray()
    pos = 0
    n = len(data)
    while pos + 2 <= n and len(out) < out_size:
        header = data[pos] | (data[pos + 1] << 8)
        if header == 0:
            break                                   # Ende der Daten
        block_end = pos + (header & 0x0FFF) + 3
        if block_end > n:
            raise Lznt1Error("Block ueber das Datenende hinaus")
        pos += 2
        block_start = len(out)
        if not header & 0x8000:
            chunk = data[pos:block_end]
            out += chunk
            out += bytes(BLOCK - len(chunk)) if len(chunk) < BLOCK else b""
            pos = block_end
            continue
        while pos < block_end:
            flags = data[pos]
            pos += 1
            for bit in range(8):
                if pos >= block_end:
                    break
                if not (flags >> bit) & 1:
                    out.append(data[pos])
                    pos += 1
                    continue
                if pos + 2 > block_end:
                    raise Lznt1Error("Rueckverweis unvollstaendig")
                token = data[pos] | (data[pos + 1] << 8)
                pos += 2
                in_block = len(out) - block_start
                if in_block <= 0:
                    raise Lznt1Error("Rueckverweis am Blockanfang")
                shift = 0
                i = in_block - 1
                while i >= 0x10:
                    i >>= 1
                    shift += 1
                back = (token >> (12 - shift)) + 1
                length = (token & (0x0FFF >> shift)) + 3
                if back > in_block or in_block + length > BLOCK:
                    raise Lznt1Error("Rueckverweis ausserhalb des Blocks")
                src = len(out) - back
                if length <= back:
                    out += out[src:src + length]
                else:
                    for k in range(length):          # ueberlappende Kopie
                        out.append(out[src + k])
        filled = len(out) - block_start
        if filled < BLOCK:
            out += bytes(BLOCK - filled)
    if len(out) < out_size:
        out += bytes(out_size - len(out))
    return bytes(out[:out_size])
