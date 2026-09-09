"""Parser fuer Empirum-Setup.inf-Dateien.

Eine Setup.inf ist eine INF-Datei: ``[Sektion]``-Koepfe, darunter Zeilen.
In Metadaten-Sektionen ([Application], [Environment], [Strings:07] ...)
stehen ``Schluessel=Wert``-Paare. In Skript-Sektionen ([Product],
[Set:...], [RebootRequired] ...) stehen Befehle, die Setup.exe der Reihe
nach ausfuehrt. [Reg:...]-, [Shell:...]-, [Ini:...]- und [Security:...]-
Sektionen enthalten deklarative Zeilen.

Der Parser bewahrt alles: Reihenfolge, Kommentare, Leerzeilen, Zeilennummern,
Zeichenkodierung (Windows-1252 oder UTF-8) und Zeilenenden (CRLF). Damit
kann der Editor eine Datei byteerhaltend zurueckschreiben.
"""

from __future__ import annotations

import codecs
import os
import re
from dataclasses import dataclass, field
from typing import Iterator

# Sektionen, deren Zeilen Befehle sind (alles ohne bekannten Praefix zaehlt
# ebenfalls als Skript-Sektion, z. B. [Product], [RebootRequired]).
SCRIPT_PREFIXES = ("set",)
DECLARATIVE_PREFIXES = ("reg", "shell", "ini", "security", "odbc", "bat", "config.sys")
STRING_PREFIXES = ("strings", "sysstrings")

# Metadaten-Sektionen ohne Praefix, die Schluessel=Wert enthalten.
METADATA_SECTIONS = {
    "setupinfo", "vardefinfo", "setup", "requirements", "application",
    "environment", "encryption", "disks", "options", "optiondependencies",
    "optiongroups", "processes", "prompts",
}

_SECTION_RE = re.compile(r"^\s*\[([^\]]+)\]\s*$")


@dataclass
class Line:
    """Eine Zeile der Datei mit ihrer Nummer (1-basiert)."""

    number: int
    raw: str

    @property
    def text(self) -> str:
        return self.raw.strip()

    @property
    def is_blank(self) -> bool:
        return not self.raw.strip()

    @property
    def is_comment(self) -> bool:
        t = self.raw.lstrip()
        return t.startswith(";") or t.startswith("//")

    @property
    def is_content(self) -> bool:
        return not (self.is_blank or self.is_comment)

    def key_value(self) -> tuple[str, str] | None:
        """``Schluessel = Wert`` aufteilen; None, wenn kein ``=`` vorkommt."""
        if not self.is_content or "=" not in self.raw:
            return None
        key, _, value = self.raw.partition("=")
        key = key.strip()
        if not key:
            return None
        return key, value.strip()


@dataclass
class Section:
    name: str
    header_line: int
    lines: list[Line] = field(default_factory=list)

    @property
    def key(self) -> str:
        return self.name.strip().lower()

    @property
    def prefix(self) -> str:
        """Teil vor dem Doppelpunkt, kleingeschrieben (``set``, ``reg`` ...)."""
        if ":" in self.name:
            return self.name.split(":", 1)[0].strip().lower()
        return ""

    @property
    def base(self) -> str:
        """Teil nach dem Doppelpunkt (bzw. der ganze Name)."""
        if ":" in self.name:
            return self.name.split(":", 1)[1].strip()
        return self.name.strip()

    @property
    def is_script(self) -> bool:
        p = self.prefix
        if p in SCRIPT_PREFIXES:
            return True
        if p in DECLARATIVE_PREFIXES or p in STRING_PREFIXES:
            return False
        return self.key not in METADATA_SECTIONS

    @property
    def is_declarative(self) -> bool:
        return self.prefix in DECLARATIVE_PREFIXES

    @property
    def is_strings(self) -> bool:
        return self.prefix in STRING_PREFIXES

    @property
    def is_metadata(self) -> bool:
        return self.key in METADATA_SECTIONS or self.is_strings

    def content_lines(self) -> list[Line]:
        return [ln for ln in self.lines if ln.is_content]

    def items(self) -> list[tuple[str, str, Line]]:
        """Alle ``Schluessel=Wert``-Zeilen in Dateireihenfolge."""
        out = []
        for ln in self.lines:
            kv = ln.key_value()
            if kv:
                out.append((kv[0], kv[1], ln))
        return out

    def get(self, key: str, default: str | None = None) -> str | None:
        """Wert zu einem Schluessel (Gross-/Kleinschreibung egal).

        Kommt ein Schluessel mehrfach vor, gewinnt die letzte Zeile; so
        verhaelt sich auch die Windows-INI-Logik.
        """
        wanted = key.strip().lower()
        value = default
        for k, v, _ in self.items():
            if k.lower() == wanted:
                value = v
        return value

    def set(self, key: str, value: str) -> None:
        """Wert setzen; vorhandene Zeile ersetzen, sonst anhaengen."""
        wanted = key.strip().lower()
        for ln in self.lines:
            kv = ln.key_value()
            if kv and kv[0].lower() == wanted:
                ln.raw = f"{kv[0]}={value}"
                return
        # vor abschliessende Leerzeilen einfuegen
        idx = len(self.lines)
        while idx > 0 and self.lines[idx - 1].is_blank:
            idx -= 1
        self.lines.insert(idx, Line(0, f"{key}={value}"))

    def last_line_number(self) -> int:
        return self.lines[-1].number if self.lines else self.header_line


class InfFile:
    """Eine geparste Setup.inf."""

    def __init__(self) -> None:
        self.path: str | None = None
        self.encoding: str = "cp1252"
        self.newline: str = "\r\n"
        self.bom: bool = False
        self.prolog: list[Line] = []
        self.sections: list[Section] = []

    # -- Zugriff --------------------------------------------------------

    def find(self, name: str) -> Section | None:
        wanted = name.strip().lower()
        for sec in self.sections:
            if sec.key == wanted:
                return sec
        return None

    def find_all(self, name: str) -> list[Section]:
        wanted = name.strip().lower()
        return [s for s in self.sections if s.key == wanted]

    def resolve(self, name: str) -> Section | None:
        """Sektion finden, auch wenn das ``Set:``-Praefix fehlt.

        ``If ... Then "Repair"`` darf sowohl ``[Repair]`` als auch
        ``[Set:Repair]`` meinen.
        """
        name = name.strip().strip('"')
        sec = self.find(name)
        if sec is None and ":" not in name:
            sec = self.find("Set:" + name)
        return sec

    def value(self, section: str, key: str, default: str | None = None) -> str | None:
        sec = self.find(section)
        if sec is None:
            return default
        return sec.get(key, default)

    def script_sections(self) -> list[Section]:
        return [s for s in self.sections if s.is_script]

    def line_at(self, number: int) -> Line | None:
        for ln in self.all_lines():
            if ln.number == number:
                return ln
        return None

    def section_of_line(self, number: int) -> Section | None:
        for sec in self.sections:
            if sec.header_line <= number <= sec.last_line_number():
                return sec
        return None

    def all_lines(self) -> Iterator[Line]:
        yield from self.prolog
        for sec in self.sections:
            yield Line(sec.header_line, f"[{sec.name}]")
            yield from sec.lines

    # -- Text ------------------------------------------------------------

    def text(self) -> str:
        """Datei als Text (mit ``\\n``); Zeilennummern werden neu vergeben."""
        out: list[str] = []
        for ln in self.prolog:
            out.append(ln.raw)
        for sec in self.sections:
            out.append(f"[{sec.name}]")
            for ln in sec.lines:
                out.append(ln.raw)
        return "\n".join(out) + ("\n" if out else "")

    def renumber(self) -> None:
        n = 1
        for ln in self.prolog:
            ln.number = n
            n += 1
        for sec in self.sections:
            sec.header_line = n
            n += 1
            for ln in sec.lines:
                ln.number = n
                n += 1

    def save(self, path: str | None = None, encoding: str | None = None) -> None:
        path = path or self.path
        if not path:
            raise ValueError("Kein Pfad zum Speichern angegeben")
        encoding = encoding or self.encoding
        text = self.text().replace("\n", self.newline)
        data = text.encode(encoding, errors="replace")
        if self.bom and encoding.lower().replace("-", "") == "utf8":
            data = codecs.BOM_UTF8 + data
        with open(path, "wb") as fh:
            fh.write(data)
        self.path = path
        self.encoding = encoding


# -- Einlesen --------------------------------------------------------------

def decode_bytes(data: bytes) -> tuple[str, str, bool]:
    """Bytes dekodieren. Liefert (Text, Kodierung, hatte_BOM).

    Reihenfolge: UTF-8-BOM, sonst strenges UTF-8, sonst Windows-1252.
    Empirum-Pakete sind traditionell Windows-1252; neuere Editoren
    speichern UTF-8. Beides muss verlustfrei zurueckgeschrieben werden.
    """
    if data.startswith(codecs.BOM_UTF8):
        return data[len(codecs.BOM_UTF8):].decode("utf-8", errors="replace"), "utf-8", True
    if data.startswith(codecs.BOM_UTF16_LE) or data.startswith(codecs.BOM_UTF16_BE):
        return data.decode("utf-16"), "utf-16", True
    try:
        return data.decode("utf-8"), "utf-8", False
    except UnicodeDecodeError:
        return data.decode("cp1252", errors="replace"), "cp1252", False


def parse_inf(text: str) -> InfFile:
    inf = InfFile()
    if "\r\n" in text:
        inf.newline = "\r\n"
    elif "\n" in text:
        inf.newline = "\n"
    current: Section | None = None
    for number, raw in enumerate(text.splitlines(), start=1):
        m = _SECTION_RE.match(raw)
        if m:
            current = Section(name=m.group(1).strip(), header_line=number)
            inf.sections.append(current)
            continue
        line = Line(number, raw)
        if current is None:
            inf.prolog.append(line)
        else:
            current.lines.append(line)
    return inf


def load_inf(path: str) -> InfFile:
    with open(path, "rb") as fh:
        data = fh.read()
    text, encoding, bom = decode_bytes(data)
    inf = parse_inf(text)
    inf.path = os.path.abspath(path)
    inf.encoding = encoding
    inf.bom = bom
    return inf


# -- Hilfsfunktionen fuer Zeilen -------------------------------------------

def split_top_level(text: str, sep: str = ",") -> list[str]:
    """An ``sep`` teilen, aber nicht innerhalb von Anfuehrungszeichen
    oder Klammern. Die Teile werden nicht getrimmt."""
    parts: list[str] = []
    depth = 0
    quote = False
    buf: list[str] = []
    for ch in text:
        if ch == '"':
            quote = not quote
            buf.append(ch)
        elif quote:
            buf.append(ch)
        elif ch == "(":
            depth += 1
            buf.append(ch)
        elif ch == ")":
            depth = max(0, depth - 1)
            buf.append(ch)
        elif ch == sep and depth == 0:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    parts.append("".join(buf))
    return parts


def unquote(text: str) -> str:
    t = text.strip()
    if len(t) >= 2 and t[0] == '"' and t[-1] == '"':
        return t[1:-1]
    return t
