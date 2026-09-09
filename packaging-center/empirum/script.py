"""Zerlegt die Zeilen einer Skript-Sektion in Anweisungen.

Eine Zeile ist eine von:

* ``#Sektion, FLAGS``         Sektionsaufruf (``#!`` erzwingt Wiederholung)
* ``If ... Then "S" [Else "S"] EndIf``
* ``For Var,Start,Ende,Schritt,Sektion``
* ``1:Quelle, Ziel, FLAGS, Groesse``   Kopierzeile
* ``Befehl Argumente``        alles andere; unbekannte Befehle sind
                              Programmaufrufe (z. B. ``Cmd /C ...``)

Ein fuehrendes ``-`` markiert die Zeile fuer die Deinstallation. Der
Parser expandiert keine Variablen; das macht der Interpreter zur Laufzeit.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .inf import Line, Section, split_top_level, unquote

_CALL_RE = re.compile(r"^#(!?)\s*([^,]+?)\s*(?:,\s*(.*))?$")
_IF_RE = re.compile(
    r"^If\s+(?P<expr>.+?)\s+Then\s+(?P<then>\"[^\"]*\"|\S+)"
    r"(?:\s+Else\s+(?P<else>\"[^\"]*\"|\S+))?\s*(?P<endif>EndIf)?\s*$",
    re.IGNORECASE,
)
_FOR_RE = re.compile(r"^For\s+(.+)$", re.IGNORECASE)
_COPY_RE = re.compile(r"^(\d+):(.*)$")
_OPERATORS = ("==", "!=", "<>", ">=", "<=", "<", ">", "=")

KNOWN_COMMANDS = {
    "call", "callhidden", "callasync", "echo", "sleep", "addmeter", "errorlogmsg", "exit",
    "abort", "abortsilent", "abortreboot", "set", "replaceenv", "increment", "decrement",
    "setreboot", "systemshutdown", "killprocess", "askkillprocesses",
    "waituntilprocessexists", "waitwhileprocessexists", "copy", "del", "delete", "deltree",
    "mkdir", "rmdir", "rename", "prompt", "startservice", "stopservice", "msiexec",
    "reboot", "message", "msgbox", "log",
}

# Programme, die in Skripten haeufig ohne "Call" stehen
KNOWN_PROGRAMS = {
    "cmd", "cmd.exe", "msiexec", "msiexec.exe", "reg", "reg.exe", "certutil", "sc", "taskkill",
    "schtasks", "powershell", "powershell.exe", "pwsh", "net", "wmic", "regsvr32", "rundll32",
    "xcopy", "robocopy", "cscript", "wscript", "netsh", "icacls", "dism", "setx", "start",
}


@dataclass
class Condition:
    lhs: str
    op: str
    rhs: str

    def __str__(self) -> str:
        return f"{self.lhs} {self.op} {self.rhs}"


@dataclass
class Statement:
    line: Line
    section: Section
    uninstall: bool = False        # Zeile begann mit "-"
    kind: str = "command"          # call | if | for | copy | command | reg | shell | ini | security | empty
    text: str = ""                 # Zeile ohne "-"
    # call
    target: str = ""
    flags: list[str] = field(default_factory=list)
    force: bool = False
    # if
    conditions: list[Condition] = field(default_factory=list)
    operators: list[str] = field(default_factory=list)   # zwischen den Bedingungen: "|" oder "&"
    then_target: str = ""
    else_target: str = ""
    # for
    for_var: str = ""
    for_start: str = ""
    for_end: str = ""
    for_step: str = ""
    # copy
    disk: str = ""
    src: str = ""
    dst: str = ""
    size: str = ""
    # command
    name: str = ""
    args: str = ""
    # reg
    root: str = ""
    key: str = ""
    value: str = ""
    reg_flags: str = ""
    data: str = ""
    delete: bool = False
    # shell
    fields: list[str] = field(default_factory=list)
    error: str = ""

    @property
    def number(self) -> int:
        return self.line.number

    def describe(self) -> str:
        return self.text


def parse_statement(line: Line, section: Section) -> Statement:
    text = line.raw.strip()
    st = Statement(line=line, section=section)
    if not text or line.is_comment:
        st.kind = "empty"
        return st
    if text.startswith("-"):
        st.uninstall = True
        text = text[1:].strip()
    st.text = text
    if section.is_declarative:
        _parse_declarative(st, section.prefix, text)
        return st
    if text.startswith("#"):
        m = _CALL_RE.match(text)
        if not m:
            st.kind = "call"
            st.error = "Sektionsaufruf nicht lesbar"
            return st
        st.kind = "call"
        st.force = m.group(1) == "!"
        st.target = m.group(2).strip().strip('"')
        st.flags = [f.upper() for f in (m.group(3) or "").replace(",", " ").split()]
        return st
    low = text.lower()
    if low.startswith("if ") or low == "if":
        _parse_if(st, text)
        return st
    if low.startswith("for ") and "," in text:
        _parse_for(st, text)
        return st
    m = _COPY_RE.match(text)
    if m and not low.startswith(("set ", "call ", "callhidden ")):
        _parse_copy(st, m)
        return st
    # Befehl
    parts = text.split(None, 1)
    st.kind = "command"
    st.name = parts[0].lower()
    st.args = parts[1] if len(parts) > 1 else ""
    # "Increment (V, 1)" / "DECREMENT(%V%,1)" -> Name kann direkt an der Klammer haengen
    m2 = re.match(r"^(increment|decrement)\s*\((.*)\)\s*$", text, re.IGNORECASE)
    if m2:
        st.name = m2.group(1).lower()
        st.args = m2.group(2)
    return st


def _parse_if(st: Statement, text: str) -> None:
    st.kind = "if"
    m = _IF_RE.match(text)
    if not m:
        st.error = "If-Zeile nicht lesbar (Form: If <Bedingung> Then \"Sektion\" [Else \"Sektion\"] EndIf)"
        return
    st.then_target = m.group("then").strip().strip('"')
    st.else_target = (m.group("else") or "").strip().strip('"')
    if not m.group("endif"):
        st.error = "EndIf fehlt"
    expr = m.group("expr")
    terms, ops = _split_logical(expr)
    st.operators = ops
    for term in terms:
        st.conditions.append(_parse_condition(term.strip()))


def _split_logical(expr: str) -> tuple[list[str], list[str]]:
    """An ``|`` und ``&`` (ausserhalb von Anfuehrungszeichen und Klammern) teilen."""
    terms: list[str] = []
    ops: list[str] = []
    depth = 0
    quote = False
    buf: list[str] = []
    for ch in expr:
        if ch == '"':
            quote = not quote
        elif not quote:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth = max(0, depth - 1)
            elif ch in "|&" and depth == 0:
                terms.append("".join(buf))
                ops.append(ch)
                buf = []
                continue
        buf.append(ch)
    terms.append("".join(buf))
    return terms, ops


def _parse_condition(term: str) -> Condition:
    depth = 0
    quote = False
    i = 0
    while i < len(term):
        ch = term[i]
        if ch == '"':
            quote = not quote
        elif not quote:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth = max(0, depth - 1)
            elif depth == 0:
                for op in _OPERATORS:
                    if term.startswith(op, i):
                        lhs = term[:i].strip()
                        rhs = term[i + len(op):].strip()
                        return Condition(lhs, "==" if op == "=" else op, rhs)
        i += 1
    # Funktion ohne Vergleich: wahr, wenn "1"
    return Condition(term.strip(), "==", '"1"')


def _parse_for(st: Statement, text: str) -> None:
    st.kind = "for"
    body = _FOR_RE.match(text).group(1)
    parts = [p.strip() for p in split_top_level(body, ",")]
    if len(parts) < 5:
        st.error = "For braucht: Variable,Start,Ende,Schritt,Sektion"
        return
    st.for_var, st.for_start, st.for_end, st.for_step = parts[0], parts[1], parts[2], parts[3]
    st.target = ",".join(parts[4:]).strip().strip('"')


def _parse_copy(st: Statement, m: re.Match) -> None:
    st.kind = "copy"
    st.disk = m.group(1)
    parts = split_top_level(m.group(2), ",")
    st.src = unquote(parts[0]) if parts else ""
    st.dst = unquote(parts[1]) if len(parts) > 1 else ""
    st.flags = [f.upper() for f in (parts[2] if len(parts) > 2 else "").split()]
    st.size = parts[3].strip() if len(parts) > 3 else ""


def _parse_declarative(st: Statement, prefix: str, text: str) -> None:
    if text.startswith("#"):
        # Auch in Reg-Sektionen kann ein Sektionsaufruf stehen
        m = _CALL_RE.match(text)
        st.kind = "call"
        if m:
            st.force = m.group(1) == "!"
            st.target = m.group(2).strip().strip('"')
            st.flags = [f.upper() for f in (m.group(3) or "").replace(",", " ").split()]
        else:
            st.error = "Sektionsaufruf nicht lesbar"
        return
    if prefix == "reg":
        st.kind = "reg"
        st.delete = st.uninstall
        st.uninstall = False
        parts = [unquote(p) for p in split_top_level(text, ",")]
        if len(parts) < 2:
            st.error = "Registryzeile braucht mindestens Wurzel und Schluessel"
            return
        st.root = parts[0].strip().upper()
        st.key = parts[1].strip()
        st.value = parts[2].strip() if len(parts) > 2 else ""
        st.reg_flags = parts[3].strip() if len(parts) > 3 else ""
        st.data = ",".join(parts[4:]).strip() if len(parts) > 4 else ""
        if len(parts) > 4:
            st.data = unquote(parts[4]) if len(parts) == 5 else ",".join(parts[4:]).strip()
        return
    if prefix == "shell":
        st.kind = "shell"
        st.fields = [unquote(p) for p in split_top_level(text, ",")]
        if len(st.fields) < 2:
            st.error = "Verknuepfungszeile braucht mindestens Pfad und Ziel"
        return
    if prefix == "ini":
        st.kind = "ini"
        st.fields = [unquote(p) for p in split_top_level(text, ",")]
        return
    st.kind = prefix
    st.fields = [unquote(p) for p in split_top_level(text, ",")]


def parse_section(section: Section) -> list[Statement]:
    return [parse_statement(ln, section) for ln in section.lines]


def is_known_command(name: str) -> bool:
    return name.lower() in KNOWN_COMMANDS


def looks_like_program(name: str) -> bool:
    n = name.lower().strip('"')
    if n in KNOWN_PROGRAMS:
        return True
    return "\\" in n or "/" in n or n.endswith((".exe", ".cmd", ".bat", ".msi", ".vbs", ".ps1")) or n.startswith("%")
