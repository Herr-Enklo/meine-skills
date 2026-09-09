"""Syntaxhervorhebung und Codevervollstaendigung fuer das Textfeld.

Arbeitet zeilenweise mit regulaeren Ausdruecken auf einem ``tk.Text``.
Farben sind fuer helle Oberflaechen gewaehlt.
"""

from __future__ import annotations

import re
import tkinter as tk

from empirum.commands import completion_words, command_names, FUNCTIONS

TAGS = {
    "section": {"foreground": "#0b3d91", "font": ("Consolas", 10, "bold")},
    "comment": {"foreground": "#7a7a7a"},
    "command": {"foreground": "#1a3fa8", "font": ("Consolas", 10, "bold")},
    "keyword": {"foreground": "#7b1fa2", "font": ("Consolas", 10, "bold")},
    "call": {"foreground": "#1b7f3b", "font": ("Consolas", 10, "bold")},
    "variable": {"foreground": "#8a2be2"},
    "string": {"foreground": "#a31515"},
    "flag": {"foreground": "#00796b"},
    "uninstall": {"foreground": "#e65100", "font": ("Consolas", 10, "bold")},
    "function": {"foreground": "#006064"},
    "number": {"foreground": "#2e7d32"},
    "key": {"foreground": "#444444"},
    "current": {"background": "#fff59d"},
    "executed": {"background": "#e8f5e9"},
    "error": {"background": "#ffcdd2"},
    "found": {"background": "#bbdefb"},
}

_COMMANDS = "|".join(re.escape(c) for c in command_names())
_FUNCS = "|".join(re.escape(f) for f in FUNCTIONS)
_RULES = [
    ("variable", re.compile(r"%[^%\s][^%]*%|%%")),
    ("string", re.compile(r'"[^"]*"')),
    ("function", re.compile(rf"\b({_FUNCS})\b(?=\s*\()", re.IGNORECASE)),
    ("keyword", re.compile(r"\b(If|Then|Else|EndIf|For)\b", re.IGNORECASE)),
    ("flag", re.compile(r"\b(DONTDELETE|DELETE|WINDOWS64|WINDOWS32|MACHINE|CLIENT|ADMIN|SHARED|ALWAYS|COPYALWAYS|"
                        r"NORMAL|OPTIONAL|USEFILENAME|DIRECTORY|NOSIZEWARNING|SETUP|SHAREDDLL|KILLPROCESS|ABORT|CONTINUE)\b")),
    ("number", re.compile(r"\b0x[0-9A-Fa-f]{8}\b|(?<![\w.])\d+(?![\w.])")),
]
_COMMAND_RE = re.compile(rf"^(\s*-?\s*)({_COMMANDS})\b", re.IGNORECASE)


def configure_tags(text: tk.Text) -> None:
    for name, opts in TAGS.items():
        text.tag_configure(name, **opts)
    text.tag_raise("found")
    text.tag_raise("current")
    text.tag_raise("error")


def highlight_all(text: tk.Text) -> None:
    last = int(text.index("end-1c").split(".")[0])
    for tag in ("section", "comment", "command", "keyword", "call", "variable", "string", "flag",
                "uninstall", "function", "number", "key"):
        text.tag_remove(tag, "1.0", "end")
    for line in range(1, last + 1):
        highlight_line(text, line, clear=False)


def highlight_line(text: tk.Text, line: int, clear: bool = True) -> None:
    start = f"{line}.0"
    end = f"{line}.end"
    content = text.get(start, end)
    if clear:
        for tag in ("section", "comment", "command", "keyword", "call", "variable", "string", "flag",
                    "uninstall", "function", "number", "key"):
            text.tag_remove(tag, start, end)
    stripped = content.lstrip()
    offset = len(content) - len(stripped)
    if not stripped:
        return
    if stripped.startswith(";") or stripped.startswith("//"):
        text.tag_add("comment", start, end)
        return
    if stripped.startswith("[") and stripped.rstrip().endswith("]"):
        text.tag_add("section", start, end)
        return
    body = stripped
    if body.startswith("-"):
        text.tag_add("uninstall", f"{line}.{offset}", f"{line}.{offset + 1}")
    if body.lstrip("-").lstrip().startswith("#"):
        text.tag_add("call", start, end)
        for m in re.finditer(r"\b(DONTDELETE|DELETE|WINDOWS64|WINDOWS32|MACHINE|CLIENT|ADMIN|SHARED)\b", content):
            text.tag_add("flag", f"{line}.{m.start()}", f"{line}.{m.end()}")
        return
    m = _COMMAND_RE.match(content)
    if m:
        text.tag_add("command", f"{line}.{m.start(2)}", f"{line}.{m.end(2)}")
    elif "=" in content and not re.match(r"^\s*-?\s*(If|For)\b", content, re.IGNORECASE) \
            and not re.match(r"^\s*\d+:", content):
        key_end = content.index("=")
        text.tag_add("key", f"{line}.{offset}", f"{line}.{key_end}")
    for tag, rx in _RULES:
        for mm in rx.finditer(content):
            text.tag_add(tag, f"{line}.{mm.start()}", f"{line}.{mm.end()}")


class Completer:
    """Kleines Vervollstaendigungsfenster (Strg+Leertaste)."""

    def __init__(self, text: tk.Text, extra_words=None) -> None:
        self.text = text
        self.extra_words = extra_words or (lambda: [])
        self.popup: tk.Toplevel | None = None
        self.listbox: tk.Listbox | None = None
        self.prefix_start = ""
        text.bind("<Control-space>", self.open)
        text.bind("<Control-Key-space>", self.open)

    def _current_word(self) -> tuple[str, str]:
        line, col = map(int, self.text.index("insert").split("."))
        content = self.text.get(f"{line}.0", f"{line}.{col}")
        m = re.search(r"[%#A-Za-z0-9_.:\-]*$", content)
        word = m.group(0) if m else ""
        return word, f"{line}.{col - len(word)}"

    def open(self, event=None):
        self.close()
        word, start = self._current_word()
        self.prefix_start = start
        words = sorted(set(completion_words()) | set(self.extra_words()), key=str.lower)
        low = word.lower().lstrip("%#")
        matches = [w for w in words if low and w.lower().lstrip("%#").startswith(low)] or words
        if not matches:
            return "break"
        self.popup = tk.Toplevel(self.text)
        self.popup.wm_overrideredirect(True)
        try:
            x, y, _, h = self.text.bbox("insert")
        except TypeError:
            x, y, h = 0, 0, 16
        self.popup.geometry(f"+{self.text.winfo_rootx() + x}+{self.text.winfo_rooty() + y + h}")
        self.listbox = tk.Listbox(self.popup, height=min(12, len(matches)), width=44, font=("Consolas", 10))
        self.listbox.pack()
        for w in matches:
            self.listbox.insert("end", w)
        self.listbox.selection_set(0)
        self.listbox.focus_set()
        self.listbox.bind("<Return>", self.accept)
        self.listbox.bind("<Tab>", self.accept)
        self.listbox.bind("<Double-Button-1>", self.accept)
        self.listbox.bind("<Escape>", lambda e: self.close())
        self.listbox.bind("<FocusOut>", lambda e: self.close())
        return "break"

    def accept(self, event=None):
        if not self.listbox:
            return "break"
        sel = self.listbox.curselection()
        if sel:
            word = self.listbox.get(sel[0])
            self.text.delete(self.prefix_start, "insert")
            self.text.insert("insert", word)
        self.close()
        self.text.focus_set()
        return "break"

    def close(self) -> None:
        if self.popup is not None:
            self.popup.destroy()
            self.popup = None
            self.listbox = None
