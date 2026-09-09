"""Empirum Package Editor (Nachbau).

Links der Baum "Alle Abschnitte", rechts die Setup.inf in zwei Ansichten:

* Normalansicht: Schluessel/Wert-Tabelle fuer Metadaten-Sektionen,
  Anweisungsliste fuer Skript-Sektionen (Doppelklick bearbeitet).
* Erweiterte Ansicht (Strg+W): Textansicht mit Syntaxhervorhebung,
  Zeilennummern, Haltepunkten und Vervollstaendigung (Strg+Leertaste).

Unten: Protokoll, Variablen, Aktionen, Pruefung, Aufrufstapel.
Werkzeugleiste: DEBUG (F5), EINZELSCHRITT (F12), Weiter, Stopp, Pruefen (F7).

Der Testlauf laeuft in einem Hintergrund-Thread; die Oberflaeche holt sich
Ereignisse ueber eine Warteschlange und haelt den Interpreter fuer
Einzelschritt und Haltepunkte an.
"""

from __future__ import annotations

import os
import queue
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog

from empirum import load_inf, parse_inf, validate, Runner, RunOptions, SimulationBackend, WindowsBackend, Status
from empirum.inf import InfFile, Section
from empirum.script import parse_section, parse_statement
from empirum.package import import_reg_file, TEMPLATE_DIR, list_templates
from empirum.backend import parse_reg_flags
from empirum.runner import LogEntry
from empirum.pipeline import run_roundtrip, RoundtripResult

from gui.highlight import configure_tags, highlight_all, highlight_line, Completer
from gui.dialogs import (DebugStartDialog, EnvironmentDialog, RegistryAssumptionsDialog, ExitCodeDialog,
                         AskKillDialog, ReferenceWindow, FindDialog, AutoRunDialog, load_settings, save_settings)

MONO = ("Consolas", 10)


def _is_admin() -> bool:
    """Unter Windows: laeuft der Prozess mit Administratorrechten?"""
    if os.name != "nt":
        return True
    try:
        import ctypes
        return bool(ctypes.windll.shell32.IsUserAnAdmin())  # type: ignore[attr-defined]
    except Exception:
        return True

GROUP_ORDER = [
    ("Paketinformation", ("setupinfo", "vardefinfo", "setup", "requirements")),
    ("Anwendung", ("application", "environment", "encryption", "processes", "prompts")),
    ("Texte", ("strings:", "sysstrings:")),
    ("Optionen und Dateien", ("disks", "options", "optiondependencies", "optiongroups", "installer", "product")),
    ("Skript (Set:)", ("set:",)),
    ("Registry (Reg:)", ("reg:",)),
    ("Verknuepfungen (Shell:)", ("shell:",)),
    ("INI, Sicherheit, Sonstiges", ("ini:", "security:", "odbc:", "bat:")),
]


class EditorWindow(tk.Toplevel):
    def __init__(self, master, path: str | None = None, settings: dict | None = None,
                 on_close=None):
        super().__init__(master)
        self.settings = settings if settings is not None else load_settings()
        self.on_close = on_close
        self.inf: InfFile = parse_inf("")
        self.path: str | None = None
        self.modified = False
        self.view = "extended"
        self.breakpoints: set[int] = set()
        self.debug_thread: threading.Thread | None = None
        self.runner: Runner | None = None
        self.events: queue.Queue = queue.Queue()
        self.resume = threading.Event()
        self.step_mode = "run"          # run | step
        self.current_line = 0
        self.answer_box: queue.Queue = queue.Queue()
        self.sim_state: SimulationBackend | None = None    # simulierte Registry des letzten Laufs
        self.title("Empirum Package Editor")
        self.geometry("1280x820")
        self.minsize(900, 600)
        self.protocol("WM_DELETE_WINDOW", self.close)
        self._build_menu()
        self._build_toolbar()
        self._build_body()
        self._build_statusbar()
        self._bind_keys()
        self.after(60, self._poll_events)
        if path:
            self.open_file(path)
        else:
            self._refresh_all()

    # -- Aufbau ----------------------------------------------------------------

    def _build_menu(self):
        menubar = tk.Menu(self)
        m = tk.Menu(menubar, tearoff=0)
        m.add_command(label="Neu aus Vorlage...", command=self.new_from_template, accelerator="Strg+N")
        m.add_command(label="Oeffnen...", command=self.open_dialog, accelerator="Strg+O")
        m.add_command(label="Speichern", command=self.save, accelerator="Strg+S")
        m.add_command(label="Speichern unter...", command=self.save_as)
        m.add_separator()
        self.recent_menu = tk.Menu(m, tearoff=0)
        m.add_cascade(label="Zuletzt geoeffnet", menu=self.recent_menu)
        m.add_separator()
        m.add_command(label="Beenden", command=self.close)
        menubar.add_cascade(label="Datei", menu=m)

        m = tk.Menu(menubar, tearoff=0)
        m.add_command(label="Rueckgaengig", command=lambda: self._text_edit("undo"), accelerator="Strg+Z")
        m.add_command(label="Wiederholen", command=lambda: self._text_edit("redo"), accelerator="Strg+Y")
        m.add_separator()
        m.add_command(label="Suchen und Ersetzen...", command=self.find, accelerator="Strg+F")
        m.add_command(label="Weitersuchen", command=self.find_next, accelerator="F3")
        m.add_command(label="Gehe zu Zeile...", command=self.goto_line, accelerator="Strg+G")
        m.add_separator()
        m.add_command(label="Registrierung importieren (.reg)...", command=self.import_reg)
        m.add_command(label="Neue Sektion...", command=self.new_section)
        m.add_command(label="Vervollstaendigen", command=lambda: self.completer.open(), accelerator="Strg+Leertaste")
        menubar.add_cascade(label="Bearbeiten", menu=m)

        m = tk.Menu(menubar, tearoff=0)
        self.view_var = tk.StringVar(value="extended")
        m.add_radiobutton(label="Normalansicht", variable=self.view_var, value="normal", command=self._switch_view)
        m.add_radiobutton(label="Erweiterte Ansicht", variable=self.view_var, value="extended", command=self._switch_view, accelerator="Strg+W")
        m.add_separator()
        m.add_command(label="Ausgefuehrte Zeilen markieren loeschen", command=self._clear_marks)
        menubar.add_cascade(label="Ansicht", menu=m)

        m = tk.Menu(menubar, tearoff=0)
        m.add_command(label="DEBUG starten", command=lambda: self.start_debug(False), accelerator="F5")
        m.add_command(label="EINZELSCHRITT", command=lambda: self.start_debug(True), accelerator="F12")
        m.add_command(label="Weiter", command=self.debug_continue, accelerator="F5")
        m.add_command(label="Naechster Schritt", command=self.debug_step, accelerator="F12")
        m.add_command(label="Stopp", command=self.debug_stop, accelerator="Umschalt+F5")
        m.add_separator()
        m.add_command(label="Automatischer Testlauf: hin und zurueck...", command=self.start_auto, accelerator="F6")
        m.add_separator()
        m.add_command(label="Haltepunkt umschalten", command=self.toggle_breakpoint, accelerator="F9")
        m.add_command(label="Alle Haltepunkte loeschen", command=self.clear_breakpoints)
        menubar.add_cascade(label="Debug", menu=m)

        m = tk.Menu(menubar, tearoff=0)
        m.add_command(label="Paketpruefung", command=self.check, accelerator="F7")
        m.add_command(label="Testumgebung (Variablen)...", command=self.edit_environment)
        m.add_command(label="Registry-Annahmen fuer die Simulation...", command=self.edit_registry_assumptions)
        m.add_command(label="Simulierte Registry zuruecksetzen", command=self.reset_simulation)
        m.add_separator()
        m.add_command(label="Paketordner oeffnen", command=self.open_folder)
        m.add_command(label="Protokolldatei oeffnen", command=self.open_log)
        menubar.add_cascade(label="Extras", menu=m)

        m = tk.Menu(menubar, tearoff=0)
        m.add_command(label="Befehlsreferenz", command=lambda: ReferenceWindow(self), accelerator="F1")
        m.add_command(label="Tastenkuerzel", command=self.show_keys)
        m.add_command(label="Info", command=self.show_about)
        menubar.add_cascade(label="Hilfe", menu=m)
        self.config(menu=menubar)
        self._fill_recent()

    def _build_toolbar(self):
        bar = ttk.Frame(self, padding=(4, 2))
        bar.pack(fill="x")
        # Zuerst rechts packen, damit die Modusanzeige immer sichtbar bleibt
        self.mode_label = ttk.Label(bar, text="Bearbeiten", foreground="#1b7f3b", font=("Segoe UI", 9, "bold"))
        self.mode_label.pack(side="right", padx=8)
        ttk.Button(bar, text="Oeffnen", command=self.open_dialog).pack(side="left")
        ttk.Button(bar, text="Speichern", command=self.save).pack(side="left", padx=(2, 8))
        ttk.Button(bar, text="Normal", command=lambda: self._set_view("normal")).pack(side="left")
        ttk.Button(bar, text="Erweitert", command=lambda: self._set_view("extended")).pack(side="left", padx=(2, 8))
        style = ttk.Style(self)
        style.configure("Debug.TButton", font=("Segoe UI", 9, "bold"))
        self.btn_debug = ttk.Button(bar, text="DEBUG", style="Debug.TButton", command=lambda: self.start_debug(False))
        self.btn_debug.pack(side="left")
        self.btn_step = ttk.Button(bar, text="EINZELSCHRITT", style="Debug.TButton", command=lambda: self.start_debug(True))
        self.btn_step.pack(side="left", padx=2)
        self.btn_continue = ttk.Button(bar, text="Weiter", command=self.debug_continue, state="disabled")
        self.btn_continue.pack(side="left", padx=2)
        self.btn_next = ttk.Button(bar, text="Schritt", command=self.debug_step, state="disabled")
        self.btn_next.pack(side="left", padx=2)
        self.btn_stop = ttk.Button(bar, text="Stopp", command=self.debug_stop, state="disabled")
        self.btn_stop.pack(side="left", padx=(2, 8))
        self.btn_auto = ttk.Button(bar, text="Hin und zurueck", command=self.start_auto)
        self.btn_auto.pack(side="left", padx=(0, 8))
        ttk.Button(bar, text="Pruefen", command=self.check).pack(side="left")

    def _build_body(self):
        outer = ttk.PanedWindow(self, orient="horizontal")
        outer.pack(fill="both", expand=True)

        left = ttk.Frame(outer)
        ttk.Label(left, text="Alle Abschnitte", font=("Segoe UI", 9, "bold")).pack(anchor="w", padx=4, pady=2)
        self.tree = ttk.Treeview(left, show="tree", selectmode="browse")
        self.tree.pack(fill="both", expand=True)
        self.tree.bind("<<TreeviewSelect>>", self._on_tree_select)
        self.tree.bind("<Button-3>", self._tree_menu)
        outer.add(left, weight=1)

        right = ttk.PanedWindow(outer, orient="vertical")
        outer.add(right, weight=4)

        self.view_frame = ttk.Frame(right)
        right.add(self.view_frame, weight=3)
        self._build_extended(self.view_frame)
        self._build_normal(self.view_frame)

        self.bottom = ttk.Notebook(right)
        right.add(self.bottom, weight=1)
        self._build_bottom()
        self._show_view_widgets()

    def _build_extended(self, parent):
        self.ext = ttk.Frame(parent)
        self.gutter = tk.Canvas(self.ext, width=52, bg="#f3f3f3", highlightthickness=0)
        self.gutter.pack(side="left", fill="y")
        self.gutter.bind("<Button-1>", self._gutter_click)
        self.text = tk.Text(self.ext, wrap="none", undo=True, font=MONO, tabs=("4c",))
        ys = ttk.Scrollbar(self.ext, orient="vertical", command=self._yscroll)
        xs = ttk.Scrollbar(self.ext, orient="horizontal", command=self.text.xview)
        self.text.configure(yscrollcommand=lambda *a: (ys.set(*a), self._draw_gutter()),
                            xscrollcommand=xs.set)
        xs.pack(side="bottom", fill="x")
        ys.pack(side="right", fill="y")
        self.text.pack(side="left", fill="both", expand=True)
        configure_tags(self.text)
        self.text.bind("<<Modified>>", self._on_modified)
        self.text.bind("<KeyRelease>", self._on_key)
        self.text.bind("<ButtonRelease-1>", lambda e: self._update_cursor_status())
        self.text.bind("<Configure>", lambda e: self._draw_gutter())
        self.completer = Completer(self.text, extra_words=self._extra_words)

    def _build_normal(self, parent):
        self.normal = ttk.Frame(parent)
        top = ttk.Frame(self.normal)
        top.pack(fill="x")
        self.normal_title = ttk.Label(top, text="", font=("Segoe UI", 10, "bold"))
        self.normal_title.pack(side="left", padx=4, pady=2)
        ttk.Button(top, text="Zeile hinzufuegen", command=self._normal_add).pack(side="right", padx=2)
        ttk.Button(top, text="Zeile loeschen", command=self._normal_delete).pack(side="right", padx=2)
        ttk.Button(top, text="Bearbeiten", command=self._normal_edit).pack(side="right", padx=2)
        self.grid = ttk.Treeview(self.normal, columns=("a", "b", "c"), show="headings", selectmode="browse")
        self.grid.heading("a", text="Zeile")
        self.grid.heading("b", text="Schluessel / Typ")
        self.grid.heading("c", text="Wert / Anweisung")
        self.grid.column("a", width=60, stretch=False, anchor="e")
        self.grid.column("b", width=220, stretch=False)
        self.grid.column("c", width=700)
        gs = ttk.Scrollbar(self.normal, orient="vertical", command=self.grid.yview)
        self.grid.configure(yscrollcommand=gs.set)
        gs.pack(side="right", fill="y")
        self.grid.pack(fill="both", expand=True)
        self.grid.bind("<Double-Button-1>", lambda e: self._normal_edit())
        self.grid.tag_configure("comment", foreground="#7a7a7a")
        self.grid.tag_configure("uninstall", foreground="#e65100")
        self.grid.tag_configure("call", foreground="#1b7f3b")
        self.grid.tag_configure("if", foreground="#7b1fa2")

    def _build_bottom(self):
        # Protokoll
        f = ttk.Frame(self.bottom)
        self.log = tk.Text(f, wrap="none", font=("Consolas", 9), state="disabled", height=10)
        ls = ttk.Scrollbar(f, orient="vertical", command=self.log.yview)
        self.log.configure(yscrollcommand=ls.set)
        ls.pack(side="right", fill="y")
        self.log.pack(fill="both", expand=True)
        for tag, color in (("ERROR", "#b71c1c"), ("WARN", "#e65100"), ("CMD", "#0b3d91"), ("ECHO", "#1b7f3b"),
                           ("DEBUG", "#8a8a8a"), ("INFO", "#000000")):
            self.log.tag_configure(tag, foreground=color)
        self.log.bind("<Double-Button-1>", self._log_jump)
        self.bottom.add(f, text="Protokoll")
        # Variablen
        f = ttk.Frame(self.bottom)
        self.var_filter = tk.StringVar()
        row = ttk.Frame(f)
        row.pack(fill="x")
        ttk.Label(row, text="Filter:").pack(side="left", padx=4)
        ttk.Entry(row, textvariable=self.var_filter, width=30).pack(side="left")
        self.var_filter.trace_add("write", lambda *a: self._refresh_vars())
        self.vars_tree = ttk.Treeview(f, columns=("n", "v"), show="headings")
        self.vars_tree.heading("n", text="Variable")
        self.vars_tree.heading("v", text="Wert")
        self.vars_tree.column("n", width=260, stretch=False)
        vs = ttk.Scrollbar(f, orient="vertical", command=self.vars_tree.yview)
        self.vars_tree.configure(yscrollcommand=vs.set)
        vs.pack(side="right", fill="y")
        self.vars_tree.pack(fill="both", expand=True)
        self.bottom.add(f, text="Variablen")
        # Aktionen
        f = ttk.Frame(self.bottom)
        self.actions_tree = ttk.Treeview(f, columns=("k", "o", "t", "d"), show="headings")
        for col, label, width in (("k", "Art", 110), ("o", "Vorgang", 160), ("t", "Ziel", 520), ("d", "Details", 300)):
            self.actions_tree.heading(col, text=label)
            self.actions_tree.column(col, width=width, stretch=(col == "t"))
        as_ = ttk.Scrollbar(f, orient="vertical", command=self.actions_tree.yview)
        self.actions_tree.configure(yscrollcommand=as_.set)
        as_.pack(side="right", fill="y")
        self.actions_tree.pack(fill="both", expand=True)
        self.bottom.add(f, text="Aktionen")
        # Pruefung
        f = ttk.Frame(self.bottom)
        self.check_tree = ttk.Treeview(f, columns=("l", "z", "s", "t"), show="headings")
        for col, label, width in (("l", "Stufe", 80), ("z", "Zeile", 60), ("s", "Sektion", 180), ("t", "Befund", 700)):
            self.check_tree.heading(col, text=label)
            self.check_tree.column(col, width=width, stretch=(col == "t"))
        self.check_tree.tag_configure("Fehler", foreground="#b71c1c")
        self.check_tree.tag_configure("Warnung", foreground="#e65100")
        self.check_tree.tag_configure("Hinweis", foreground="#555555")
        cs = ttk.Scrollbar(f, orient="vertical", command=self.check_tree.yview)
        self.check_tree.configure(yscrollcommand=cs.set)
        cs.pack(side="right", fill="y")
        self.check_tree.pack(fill="both", expand=True)
        self.check_tree.bind("<Double-Button-1>", self._check_jump)
        self.bottom.add(f, text="Pruefung")
        # Aufrufstapel
        f = ttk.Frame(self.bottom)
        self.stack_list = tk.Listbox(f, font=("Consolas", 9))
        self.stack_list.pack(fill="both", expand=True)
        self.bottom.add(f, text="Aufrufstapel")

    def _build_statusbar(self):
        self.status = ttk.Label(self, text="Bereit", anchor="w", relief="sunken", padding=(6, 2))
        self.status.pack(fill="x", side="bottom")

    def _bind_keys(self):
        self.bind("<Control-n>", lambda e: self.new_from_template())
        self.bind("<Control-o>", lambda e: self.open_dialog())
        self.bind("<Control-s>", lambda e: self.save())
        self.bind("<Control-w>", lambda e: self._toggle_view())
        self.bind("<Control-f>", lambda e: self.find())
        self.bind("<F3>", lambda e: self.find_next())
        self.bind("<Control-g>", lambda e: self.goto_line())
        self.bind("<F5>", lambda e: self._f5())
        self.bind("<Shift-F5>", lambda e: self.debug_stop())
        self.bind("<F12>", lambda e: self._f12())
        self.bind("<F10>", lambda e: self._f12())
        self.bind("<F9>", lambda e: self.toggle_breakpoint())
        self.bind("<F7>", lambda e: self.check())
        self.bind("<F6>", lambda e: self.start_auto())
        self.bind("<F1>", lambda e: ReferenceWindow(self))
        self.text.bind("<Control-z>", lambda e: self._text_edit("undo") or "break")
        self.text.bind("<Control-y>", lambda e: self._text_edit("redo") or "break")

    # -- Datei --------------------------------------------------------------------

    def open_dialog(self):
        if not self._confirm_discard():
            return
        path = filedialog.askopenfilename(parent=self, title="Setup.inf oeffnen",
                                          filetypes=[("Setup.inf", "*.inf"), ("Alle Dateien", "*.*")],
                                          initialdir=self.settings.get("last_dir") or os.getcwd())
        if path:
            self.open_file(path)

    def open_file(self, path: str):
        try:
            inf = load_inf(path)
        except OSError as exc:
            messagebox.showerror("Oeffnen", f"Datei kann nicht gelesen werden:\n{exc}", parent=self)
            return
        self.inf = inf
        self.path = inf.path
        self.settings["last_dir"] = os.path.dirname(path)
        recent = [p for p in self.settings.get("recent", []) if p != inf.path]
        self.settings["recent"] = [inf.path] + recent[:9]
        save_settings(self.settings)
        self._fill_recent()
        self.breakpoints.clear()
        self.text.delete("1.0", "end")
        self.text.insert("1.0", inf.text())
        self.text.edit_reset()
        self.text.edit_modified(False)
        self.modified = False
        self._refresh_all()
        self._set_status(f"Geoeffnet: {self.path} ({inf.encoding}, {'CRLF' if inf.newline == chr(13) + chr(10) else 'LF'}, {len(inf.sections)} Sektionen)")
        self.check(quiet=True)

    def new_from_template(self):
        if not self._confirm_discard():
            return
        names = list_templates()
        if not names:
            messagebox.showinfo("Vorlagen", "Keine Vorlagen gefunden.", parent=self)
            return
        choice = simpledialog.askstring("Neu aus Vorlage", "Vorlage (" + ", ".join(names) + "):",
                                        initialvalue=names[0], parent=self)
        if not choice:
            return
        path = os.path.join(TEMPLATE_DIR, choice) if not os.path.isabs(choice) else choice
        if not os.path.isfile(path):
            messagebox.showerror("Vorlage", f"Vorlage nicht gefunden: {path}", parent=self)
            return
        inf = load_inf(path)
        inf.path = None
        self.inf = inf
        self.path = None
        self.text.delete("1.0", "end")
        self.text.insert("1.0", inf.text())
        self.text.edit_reset()
        self.modified = True
        self._refresh_all()
        self._set_status(f"Neue Setup.inf aus Vorlage {choice}; mit 'Speichern unter' im Paketordner Install\\ ablegen")

    def save(self):
        if not self.path:
            return self.save_as()
        self._sync_from_text()
        try:
            self.inf.save(self.path)
        except OSError as exc:
            messagebox.showerror("Speichern", str(exc), parent=self)
            return
        self.modified = False
        self.text.edit_modified(False)
        self._update_title()
        self._set_status(f"Gespeichert: {self.path} ({self.inf.encoding}, CRLF)")
        self.check(quiet=True)

    def save_as(self):
        path = filedialog.asksaveasfilename(parent=self, title="Setup.inf speichern unter", defaultextension=".inf",
                                            initialfile="Setup.inf", filetypes=[("Setup.inf", "*.inf")],
                                            initialdir=self.settings.get("last_dir") or os.getcwd())
        if not path:
            return
        self.path = path
        self.inf.path = os.path.abspath(path)
        self.settings["last_dir"] = os.path.dirname(path)
        self.save()

    def close(self):
        if self.debug_thread and self.debug_thread.is_alive():
            if not messagebox.askyesno("Testlauf", "Ein Testlauf laeuft noch. Abbrechen und schliessen?", parent=self):
                return
            self.debug_stop()
        if not self._confirm_discard():
            return
        save_settings(self.settings)
        if self.on_close:
            self.on_close(self)
        self.destroy()

    def _confirm_discard(self) -> bool:
        if not self.modified:
            return True
        answer = messagebox.askyesnocancel("Aenderungen", "Aenderungen speichern?", parent=self)
        if answer is None:
            return False
        if answer:
            self.save()
            return not self.modified
        return True

    def _fill_recent(self):
        self.recent_menu.delete(0, "end")
        for p in self.settings.get("recent", []):
            self.recent_menu.add_command(label=p, command=lambda p=p: self.open_file(p))

    # -- Synchronisation Text <-> Modell ----------------------------------------

    def _sync_from_text(self):
        text = self.text.get("1.0", "end-1c")
        new = parse_inf(text)
        new.path = self.inf.path
        new.encoding = self.inf.encoding
        new.newline = self.inf.newline
        new.bom = self.inf.bom
        self.inf = new

    def _refresh_all(self):
        self._sync_from_text()
        highlight_all(self.text)
        self._refresh_tree()
        self._draw_gutter()
        self._update_title()
        if self.view == "normal":
            self._refresh_normal()

    def _update_title(self):
        name = self.path or "Unbenannt"
        self.title(f"Empirum Package Editor - {name}{' *' if self.modified else ''}")

    def _on_modified(self, event=None):
        if self.text.edit_modified():
            self.modified = True
            self.text.edit_modified(False)
            self._update_title()

    def _on_key(self, event=None):
        line = int(self.text.index("insert").split(".")[0])
        highlight_line(self.text, line)
        self._update_cursor_status()
        if event and event.keysym in ("Return", "BackSpace", "Delete") or (event and event.char in "[]"):
            self._refresh_tree_soon()

    _tree_job = None

    def _refresh_tree_soon(self):
        if self._tree_job:
            self.after_cancel(self._tree_job)
        self._tree_job = self.after(400, self._refresh_all_light)

    def _refresh_all_light(self):
        self._tree_job = None
        self._sync_from_text()
        self._refresh_tree()
        self._draw_gutter()

    def _update_cursor_status(self):
        line, col = self.text.index("insert").split(".")
        sec = self.inf.section_of_line(int(line))
        where = f"[{sec.name}]" if sec else ""
        self._set_status(f"Zeile {line}, Spalte {int(col) + 1}  {where}")

    def _set_status(self, text: str):
        self.status.configure(text=text)

    # -- Baum ---------------------------------------------------------------------

    def _refresh_tree(self):
        selected = self.tree.selection()
        sel_name = self.tree.item(selected[0], "values")[0] if selected and self.tree.item(selected[0], "values") else None
        self.tree.delete(*self.tree.get_children())
        root = self.tree.insert("", "end", text=os.path.basename(self.path) if self.path else "Setup.inf", open=True)
        placed: set[int] = set()
        for label, prefixes in GROUP_ORDER:
            members = []
            for i, sec in enumerate(self.inf.sections):
                key = sec.key
                for p in prefixes:
                    if (p.endswith(":") and key.startswith(p)) or key == p:
                        members.append((i, sec))
                        break
            if not members:
                continue
            node = self.tree.insert(root, "end", text=label, open=True)
            for i, sec in members:
                placed.add(i)
                self.tree.insert(node, "end", text=sec.name, values=(sec.name, sec.header_line))
        rest = [(i, s) for i, s in enumerate(self.inf.sections) if i not in placed]
        if rest:
            node = self.tree.insert(root, "end", text="Weitere Sektionen", open=True)
            for i, sec in rest:
                self.tree.insert(node, "end", text=sec.name, values=(sec.name, sec.header_line))
        if sel_name:
            self._select_tree_item(sel_name)

    def _select_tree_item(self, name: str):
        for node in self._all_tree_items():
            values = self.tree.item(node, "values")
            if values and values[0] == name:
                self.tree.selection_set(node)
                self.tree.see(node)
                return

    def _all_tree_items(self, parent=""):
        for child in self.tree.get_children(parent):
            yield child
            yield from self._all_tree_items(child)

    def _on_tree_select(self, event=None):
        sel = self.tree.selection()
        if not sel:
            return
        values = self.tree.item(sel[0], "values")
        if not values:
            return
        name, line = values[0], int(values[1])
        if self.view == "extended":
            self.text.see(f"{line}.0")
            self.text.mark_set("insert", f"{line}.0")
            self.text.focus_set()
        else:
            self._refresh_normal(name)

    def _tree_menu(self, event):
        item = self.tree.identify_row(event.y)
        if not item:
            return
        self.tree.selection_set(item)
        values = self.tree.item(item, "values")
        if not values:
            return
        menu = tk.Menu(self, tearoff=0)
        name = values[0]
        menu.add_command(label=f"[{name}] in der Textansicht zeigen", command=lambda: (self._set_view("extended"), self._on_tree_select()))
        menu.add_command(label="Sektion loeschen", command=lambda: self._delete_section(name))
        if name.lower().startswith("reg:"):
            menu.add_command(label="Registrierung importieren (.reg)...", command=lambda: self.import_reg(name))
        menu.tk_popup(event.x_root, event.y_root)

    def _delete_section(self, name: str):
        sec = self.inf.find(name)
        if sec is None or not messagebox.askyesno("Sektion loeschen", f"Sektion [{name}] loeschen?", parent=self):
            return
        self.text.delete(f"{sec.header_line}.0", f"{sec.last_line_number() + 1}.0")
        self.modified = True
        self._refresh_all()

    def new_section(self):
        name = simpledialog.askstring("Neue Sektion", "Name der Sektion (z. B. Set:Konfiguration, Reg:Product):", parent=self)
        if not name:
            return
        name = name.strip().strip("[]")
        if self.inf.find(name):
            messagebox.showinfo("Neue Sektion", f"[{name}] gibt es schon.", parent=self)
            return
        self.text.insert("end", f"\n[{name}]\n")
        self.modified = True
        self._refresh_all()
        self._select_tree_item(name)
        self.text.see("end")

    # -- Ansichten ----------------------------------------------------------------

    def _switch_view(self):
        self._set_view(self.view_var.get())

    def _toggle_view(self):
        self._set_view("normal" if self.view == "extended" else "extended")

    def _set_view(self, view: str):
        self.view = view
        self.view_var.set(view)
        self._show_view_widgets()
        if view == "normal":
            self._sync_from_text()
            self._refresh_tree()
            sel = self.tree.selection()
            name = self.tree.item(sel[0], "values")[0] if sel and self.tree.item(sel[0], "values") else None
            self._refresh_normal(name)
        else:
            highlight_all(self.text)
            self._draw_gutter()

    def _show_view_widgets(self):
        self.ext.pack_forget()
        self.normal.pack_forget()
        if self.view == "normal":
            self.normal.pack(fill="both", expand=True)
        else:
            self.ext.pack(fill="both", expand=True)

    def _refresh_normal(self, name: str | None = None):
        self.grid.delete(*self.grid.get_children())
        if name is None:
            sections = self.inf.sections
            self.normal_title.configure(text="Alle Sektionen (links eine Sektion waehlen)")
            for sec in sections:
                self.grid.insert("", "end", values=(sec.header_line, f"[{sec.name}]", f"{len(sec.content_lines())} Zeilen"))
            return
        sec = self.inf.find(name)
        if sec is None:
            return
        self.normal_title.configure(text=f"[{sec.name}]  -  " + ("Schluessel = Wert" if sec.is_metadata else "Anweisungen"))
        if sec.is_metadata:
            for ln in sec.lines:
                if ln.is_blank:
                    continue
                kv = ln.key_value()
                if kv:
                    self.grid.insert("", "end", iid=str(ln.number), values=(ln.number, kv[0], kv[1]))
                else:
                    self.grid.insert("", "end", iid=str(ln.number), values=(ln.number, "", ln.raw),
                                     tags=("comment",) if ln.is_comment else ())
        else:
            for st in parse_section(sec):
                ln = st.line
                if ln.is_blank:
                    continue
                if st.kind == "empty":
                    self.grid.insert("", "end", iid=str(ln.number), values=(ln.number, "Kommentar", ln.raw), tags=("comment",))
                    continue
                kind = {"call": "Sektionsaufruf", "if": "Bedingung", "for": "Schleife", "copy": "Kopierzeile",
                        "reg": "Registry", "shell": "Verknuepfung", "ini": "INI", "command": st.name}.get(st.kind, st.kind)
                if st.uninstall or (st.kind == "reg" and st.delete):
                    kind = "- " + kind
                tags = ("uninstall",) if st.uninstall else ("call",) if st.kind == "call" else ("if",) if st.kind == "if" else ()
                self.grid.insert("", "end", iid=str(ln.number), values=(ln.number, kind, ln.raw.strip()), tags=tags)

    def _normal_selected_line(self) -> int | None:
        sel = self.grid.selection()
        if not sel:
            return None
        try:
            return int(sel[0])
        except ValueError:
            return None

    def _normal_edit(self):
        line = self._normal_selected_line()
        if line is None:
            return
        current = self.text.get(f"{line}.0", f"{line}.end")
        new = simpledialog.askstring("Zeile bearbeiten", f"Zeile {line}:", initialvalue=current, parent=self)
        if new is None or new == current:
            return
        self.text.delete(f"{line}.0", f"{line}.end")
        self.text.insert(f"{line}.0", new)
        self.modified = True
        self._refresh_all()

    def _normal_add(self):
        sel = self.tree.selection()
        name = self.tree.item(sel[0], "values")[0] if sel and self.tree.item(sel[0], "values") else None
        sec = self.inf.find(name) if name else None
        if sec is None:
            messagebox.showinfo("Zeile hinzufuegen", "Bitte links eine Sektion waehlen.", parent=self)
            return
        new = simpledialog.askstring("Zeile hinzufuegen", f"Neue Zeile in [{sec.name}]:", parent=self)
        if not new:
            return
        line = self._normal_selected_line() or sec.last_line_number()
        self.text.insert(f"{line}.end", "\n" + new)
        self.modified = True
        self._refresh_all()

    def _normal_delete(self):
        line = self._normal_selected_line()
        if line is None:
            return
        self.text.delete(f"{line}.0", f"{line + 1}.0")
        self.modified = True
        self._refresh_all()

    # -- Textfunktionen -----------------------------------------------------------

    def _text_edit(self, what: str):
        try:
            if what == "undo":
                self.text.edit_undo()
            else:
                self.text.edit_redo()
            highlight_all(self.text)
        except tk.TclError:
            pass

    def _yscroll(self, *args):
        self.text.yview(*args)
        self._draw_gutter()

    def _draw_gutter(self):
        self.gutter.delete("all")
        i = self.text.index("@0,0")
        while True:
            dline = self.text.dlineinfo(i)
            if dline is None:
                break
            y = dline[1]
            line = int(i.split(".")[0])
            color = "#333"
            if line in self.breakpoints:
                self.gutter.create_oval(4, y + 3, 14, y + 13, fill="#d32f2f", outline="")
            if line == self.current_line:
                self.gutter.create_polygon(16, y + 3, 24, y + 8, 16, y + 13, fill="#f9a825", outline="")
            self.gutter.create_text(48, y, anchor="ne", text=str(line), font=("Consolas", 9), fill=color)
            i = self.text.index(f"{i}+1line")
            if int(i.split(".")[0]) > int(self.text.index("end-1c").split(".")[0]):
                break

    def _gutter_click(self, event):
        i = self.text.index(f"@0,{event.y}")
        line = int(i.split(".")[0])
        self._toggle_breakpoint_line(line)

    def toggle_breakpoint(self):
        line = int(self.text.index("insert").split(".")[0])
        self._toggle_breakpoint_line(line)

    def _toggle_breakpoint_line(self, line: int):
        if line in self.breakpoints:
            self.breakpoints.discard(line)
        else:
            self.breakpoints.add(line)
        self._draw_gutter()
        self._set_status(f"Haltepunkte: {', '.join(str(b) for b in sorted(self.breakpoints)) or 'keine'}")

    def clear_breakpoints(self):
        self.breakpoints.clear()
        self._draw_gutter()

    def _clear_marks(self):
        self.text.tag_remove("executed", "1.0", "end")
        self.text.tag_remove("current", "1.0", "end")
        self.text.tag_remove("error", "1.0", "end")
        self.current_line = 0
        self._draw_gutter()

    def find(self):
        sel = ""
        try:
            sel = self.text.get("sel.first", "sel.last")
        except tk.TclError:
            pass
        dlg = FindDialog(self, sel or self.settings.get("last_find", ""))
        if not dlg.pattern:
            return
        self.settings["last_find"] = dlg.pattern
        if dlg.replace is None:
            self.find_next()
            return
        if dlg.replace_all:
            content = self.text.get("1.0", "end-1c")
            n = content.lower().count(dlg.pattern.lower())
            if n:
                import re
                new = re.sub(re.escape(dlg.pattern), lambda m: dlg.replace, content, flags=re.IGNORECASE)
                self.text.delete("1.0", "end")
                self.text.insert("1.0", new)
                self.modified = True
                self._refresh_all()
            self._set_status(f"{n} Ersetzungen")
        else:
            pos = self.text.search(dlg.pattern, "insert", nocase=True, stopindex="end")
            if pos:
                end = f"{pos}+{len(dlg.pattern)}c"
                self.text.delete(pos, end)
                self.text.insert(pos, dlg.replace)
                self.modified = True
                self.find_next()

    def find_next(self):
        pattern = self.settings.get("last_find", "")
        if not pattern:
            return self.find()
        self.text.tag_remove("found", "1.0", "end")
        start = self.text.index("insert+1c") if self.text.tag_ranges("sel") else "insert"
        pos = self.text.search(pattern, start, nocase=True, stopindex="end") or \
            self.text.search(pattern, "1.0", nocase=True, stopindex="end")
        if not pos:
            self._set_status(f"'{pattern}' nicht gefunden")
            return
        end = f"{pos}+{len(pattern)}c"
        self.text.tag_remove("sel", "1.0", "end")
        self.text.tag_add("sel", pos, end)
        self.text.tag_add("found", pos, end)
        self.text.mark_set("insert", pos)
        self.text.see(pos)
        self._set_view("extended")
        self.text.focus_set()

    def goto_line(self):
        n = simpledialog.askinteger("Gehe zu Zeile", "Zeile:", parent=self, minvalue=1)
        if n:
            self._goto(n)

    def _goto(self, line: int):
        self._set_view("extended")
        self.text.mark_set("insert", f"{line}.0")
        self.text.see(f"{line}.0")
        self.text.focus_set()
        self._update_cursor_status()

    def import_reg(self, target: str | None = None):
        path = filedialog.askopenfilename(parent=self, title=".reg-Datei importieren",
                                          filetypes=[("Registrierungsdatei", "*.reg"), ("Alle Dateien", "*.*")])
        if not path:
            return
        try:
            lines = import_reg_file(path)
        except (OSError, ValueError) as exc:
            messagebox.showerror("Import", str(exc), parent=self)
            return
        if not lines:
            messagebox.showinfo("Import", "Keine Eintraege gefunden.", parent=self)
            return
        if target is None:
            candidates = [s.name for s in self.inf.sections if s.prefix == "reg"]
            target = simpledialog.askstring("Zielsektion", "In welche [Reg:...]-Sektion? (" + ", ".join(candidates) + ")",
                                            initialvalue=candidates[0] if candidates else "Reg:Product", parent=self)
            if not target:
                return
        sec = self.inf.find(target)
        if sec is None:
            self.text.insert("end", f"\n[{target}]\n" + "\n".join(lines) + "\n")
        else:
            self.text.insert(f"{sec.last_line_number()}.end", "\n" + "\n".join(lines))
        self.modified = True
        self._refresh_all()
        self._set_status(f"{len(lines)} Registryzeilen nach [{target}] importiert (HKCU-Zeilen brauchen eine CLIENT-Sektion)")

    def _extra_words(self) -> list[str]:
        words = set()
        for sec in self.inf.sections:
            words.add("#" + sec.name if sec.is_script or sec.is_declarative else "")
            for key, _, _ in sec.items():
                if sec.is_metadata:
                    words.add("%" + key + "%")
        for sec in self.inf.script_sections():
            for st in parse_section(sec):
                if st.kind == "command" and st.name == "set":
                    words.add("%" + st.args.partition("=")[0].strip() + "%")
        words.discard("")
        return sorted(words)

    # -- Pruefung -----------------------------------------------------------------

    def check(self, quiet: bool = False):
        self._sync_from_text()
        findings = validate(self.inf)
        self.check_tree.delete(*self.check_tree.get_children())
        self.text.tag_remove("error", "1.0", "end")
        for f in findings:
            self.check_tree.insert("", "end", values=(f.level, f.line or "", f.section, f.text), tags=(f.level,))
            if f.level == "Fehler" and f.line:
                self.text.tag_add("error", f"{f.line}.0", f"{f.line}.end")
        errors = sum(1 for f in findings if f.level == "Fehler")
        warnings = sum(1 for f in findings if f.level == "Warnung")
        self._set_status(f"Paketpruefung: {errors} Fehler, {warnings} Warnungen, {len(findings) - errors - warnings} Hinweise")
        if not quiet:
            self.bottom.select(3)

    def _check_jump(self, event=None):
        sel = self.check_tree.selection()
        if sel:
            line = self.check_tree.item(sel[0], "values")[1]
            if line:
                self._goto(int(line))

    def _log_jump(self, event=None):
        index = self.log.index(f"@{event.x},{event.y}")
        line_text = self.log.get(f"{index} linestart", f"{index} lineend")
        import re
        m = re.search(r":(\d+)\]", line_text)
        if m:
            self._goto(int(m.group(1)))

    # -- Testumgebung -------------------------------------------------------------

    def edit_environment(self):
        self._sync_from_text()
        suggested = []
        env = self.inf.find("Environment")
        if env:
            for key, value, _ in env.items():
                if "%%" in value:
                    suggested.append(key)
        vardef = self.inf.find("VarDefInfo")
        if vardef:
            for ln in vardef.content_lines():
                name = ln.text.split(",")[0].strip()
                if name:
                    suggested.append(name)
        EnvironmentDialog(self, self.settings, suggested)
        save_settings(self.settings)

    def edit_registry_assumptions(self):
        RegistryAssumptionsDialog(self, self.settings)
        save_settings(self.settings)

    def reset_simulation(self):
        self.sim_state = None
        self._set_status("Simulierte Registry und Dateien zurueckgesetzt; der naechste Lauf beginnt leer")

    def open_folder(self):
        if not self.path:
            return
        folder = os.path.dirname(os.path.dirname(self.path))
        self._open_path(folder)

    def open_log(self):
        path = getattr(self, "last_log_path", "")
        if path and os.path.isfile(path):
            self._open_path(path)
        else:
            messagebox.showinfo("Protokoll", "Noch kein Protokoll vorhanden. Erst einen Testlauf starten.", parent=self)

    def _open_path(self, path: str):
        import subprocess
        import sys
        try:
            if sys.platform.startswith("win"):
                os.startfile(path)  # type: ignore[attr-defined]
            elif sys.platform == "darwin":
                subprocess.Popen(["open", path])
            else:
                subprocess.Popen(["xdg-open", path])
        except OSError as exc:
            messagebox.showerror("Oeffnen", str(exc), parent=self)

    # -- Debug --------------------------------------------------------------------

    def _f5(self):
        if self.debug_thread and self.debug_thread.is_alive():
            self.debug_continue()
        else:
            self.start_debug(False)

    def _f12(self):
        if self.debug_thread and self.debug_thread.is_alive():
            self.debug_step()
        else:
            self.start_debug(True)

    def start_debug(self, single_step: bool):
        if self.debug_thread and self.debug_thread.is_alive():
            messagebox.showinfo("Testlauf", "Es laeuft schon ein Testlauf.", parent=self)
            return
        if not self.path:
            messagebox.showinfo("Testlauf", "Bitte die Setup.inf zuerst im Paketordner speichern (Install\\Setup.inf).", parent=self)
            return
        if self.modified:
            if messagebox.askyesno("Testlauf", "Die Datei ist geaendert. Vor dem Testlauf speichern?", parent=self):
                self.save()
        self._sync_from_text()
        switches = self.inf.value("SetupInfo", "Command line options") or ""
        dlg = DebugStartDialog(self, self.path, self.settings, single_step, default_switches=switches)
        if dlg.result_options is None:
            return
        save_settings(self.settings)
        opts = dlg.result_options
        opts.env_overrides = dict(self.settings.get("env_overrides", {}))
        if dlg.simulate:
            backend = SimulationBackend(read_real_registry=dlg.read_real_registry,
                                        read_real_files=dlg.read_real_registry)
            backend.default_exit_code = dlg.default_exit_code
            backend.execute_programs = dlg.execute_programs
            if dlg.ask_exit_codes and not dlg.execute_programs:
                backend.call_hook = self._ask_exit_code
            if dlg.execute_programs and not messagebox.askyesno(
                    "Programme wirklich starten",
                    "Call, CallHidden und MsiExec werden in diesem Lauf wirklich gestartet. Installer "
                    "veraendern den Rechner. Fortfahren?", parent=self, icon="warning"):
                return
            if opts.emulate_installers and self.sim_state is not None:
                n = backend.inherit(self.sim_state)
                self._set_status(f"Simulierte Registry aus dem vorigen Lauf uebernommen ({n} Schluessel)")
            self._apply_registry_assumptions(backend)
        else:
            if not _is_admin():
                if not messagebox.askyesno("Administratorrechte",
                                           "Das Programm laeuft nicht als Administrator. Setup.exe laeuft als SYSTEM; "
                                           "ohne erhoehte Rechte scheitern HKLM-Eintraege, Program Files und die "
                                           "meisten Installer. Trotzdem starten?", parent=self, icon="warning"):
                    return
            elif not self.settings.get("_real_confirmed") and not messagebox.askyesno(
                    "Echter Testlauf",
                    "Der Lauf schreibt Registry und Dateien und startet Programme auf diesem Rechner, "
                    "genau wie Setup.exe. Fortfahren? (Diese Frage kommt in dieser Sitzung nur einmal.)",
                    parent=self, icon="warning"):
                return
            self.settings["_real_confirmed"] = True
            backend = WindowsBackend()
        self.step_mode = "step" if single_step else "run"
        self._auto_stop = False
        self.resume.clear()
        self.current_line = 0
        self._clear_marks()
        self._clear_run_views()
        self._set_debug_state(True)
        self.mode_label.configure(text="Debug: " + ("Einzelschritt" if single_step else "laeuft"), foreground="#d32f2f")
        inf = load_inf(self.path)
        self.runner = Runner(inf, backend, opts, on_log=self._on_log, step_hook=self._step_hook,
                             ask_hook=self._ask_hook)
        self.debug_thread = threading.Thread(target=self._debug_worker, daemon=True)
        self.debug_thread.start()

    # -- Automatischer Testlauf (hin und zurueck) ---------------------------------

    def start_auto(self, simulate: bool | None = None, reinstall: bool | None = None,
                   ask: bool = True):
        """Installation, wahlweise erneute Installation und Deinstallation hintereinander,
        sichtbar im Editor, mit Testbericht neben dem Paket."""
        if self.debug_thread and self.debug_thread.is_alive():
            messagebox.showinfo("Testlauf", "Es laeuft schon ein Testlauf.", parent=self)
            return
        if not self.path:
            messagebox.showinfo("Testlauf", "Bitte die Setup.inf zuerst im Paketordner speichern.", parent=self)
            return
        if self.modified and messagebox.askyesno("Testlauf", "Die Datei ist geaendert. Vor dem Testlauf speichern?", parent=self):
            self.save()
        self._sync_from_text()
        if ask:
            dlg = AutoRunDialog(self, self.settings)
            if not dlg.confirmed:
                return
            simulate = dlg.simulate
            reinstall = dlg.reinstall
            save_settings(self.settings)
        simulate = True if simulate is None else simulate
        reinstall = bool(reinstall)
        if not simulate:
            if os.name != "nt":
                messagebox.showerror("Testlauf", "Echte Ausfuehrung gibt es nur unter Windows.", parent=self)
                return
            if not _is_admin() and not messagebox.askyesno(
                    "Administratorrechte", "Das Programm laeuft nicht als Administrator. Trotzdem starten?",
                    parent=self, icon="warning"):
                return
        base = RunOptions(bits=int(self.settings.get("bits", 64)),
                          version_compare=self.settings.get("version_compare", "numeric"),
                          once_rule=self.settings.get("once_rule", True),
                          apply_registration=self.settings.get("apply_registration", True),
                          emulate_installers=self.settings.get("emulate_installers", True),
                          env_overrides=dict(self.settings.get("env_overrides", {})))
        exec_programs = bool(self.settings.get("execute_programs", False)) and simulate
        default_code = int(self.settings.get("default_exit_code", 0))

        def factory(mode, previous):
            if not simulate:
                return WindowsBackend()
            be = SimulationBackend(read_real_registry=self.settings.get("read_real_registry", True))
            be.default_exit_code = default_code
            be.execute_programs = exec_programs
            if previous is not None:
                be.inherit(previous)
            elif self.sim_state is not None and base.emulate_installers:
                be.inherit(self.sim_state)
            self._apply_registry_assumptions(be)
            return be

        self.step_mode = "run"
        self._auto_stop = False
        self.resume.clear()
        self.current_line = 0
        self._clear_marks()
        self._clear_run_views()
        self._set_debug_state(True)
        self.mode_label.configure(text="Automatischer Testlauf", foreground="#d32f2f")
        self.runner = None
        path = self.path

        def on_phase(label, mode):
            self.events.put(("phase", label, mode))

        def worker():
            try:
                rt = run_roundtrip(path, simulate=simulate, reinstall=reinstall, base_options=base,
                                   backend_factory=factory, on_phase=on_phase,
                                   runner_hooks={"on_log": self._on_log, "step_hook": self._auto_step_hook,
                                                 "ask_hook": self._ask_hook})
                self.events.put(("auto_done", rt))
            except Exception as exc:  # pragma: no cover
                self.events.put(("crash", repr(exc)))

        self.debug_thread = threading.Thread(target=worker, daemon=True)
        self.debug_thread.start()

    def _auto_step_hook(self, st, runner):
        self.runner = runner
        if getattr(self, "_auto_stop", False):
            runner.stop_flag.set()
        self._step_hook(st, runner)

    def _apply_registry_assumptions(self, backend: SimulationBackend):
        for raw in self.settings.get("registry_assumptions", []):
            inf = parse_inf("[Reg:X]\n" + raw + "\n")
            st = parse_statement(inf.sections[0].lines[0], inf.sections[0])
            if st.kind != "reg" or st.error:
                continue
            if st.delete:
                if st.value:
                    backend.reg_delete_value(st.root, st.key, st.value)
                else:
                    backend.reg_delete_key(st.root, st.key)
            else:
                backend.reg_write(st.root, st.key, st.value, parse_reg_flags(st.reg_flags), st.data)
        backend.actions.clear()

    def _debug_worker(self):
        try:
            result = self.runner.run()
            self.events.put(("done", result))
        except Exception as exc:  # pragma: no cover - Sicherheitsnetz
            self.events.put(("crash", repr(exc)))

    def _step_hook(self, st, runner):
        """Laeuft im Hintergrund-Thread: hier haelt der Interpreter an."""
        line = st.number
        self.events.put(("step", line, [f.section.name + "  (" + f.reason + ")" for f in runner.stack],
                         runner.vars.snapshot()))
        if self.step_mode == "step" or line in self.breakpoints:
            self.step_mode = "paused"
            self.events.put(("paused", line))
            self.resume.clear()
            self.resume.wait()

    def _ask_exit_code(self, cmdline: str, hidden: bool):
        """Laeuft im Hintergrund-Thread; wartet auf die Antwort der Oberflaeche."""
        self.events.put(("ask_exit", cmdline, hidden))
        return self.answer_box.get()

    def _ask_hook(self, kind: str, payload: dict) -> str:
        self.events.put(("ask", kind, payload))
        return self.answer_box.get()

    def debug_continue(self):
        if self.step_mode == "paused":
            self.step_mode = "run"
            self.mode_label.configure(text="Debug: laeuft", foreground="#d32f2f")
            self.resume.set()

    def debug_step(self):
        if self.step_mode == "paused":
            self.step_mode = "step"
            self.resume.set()

    def debug_stop(self):
        self._auto_stop = True
        if self.runner:
            self.runner.stop_flag.set()
        self.step_mode = "run"
        self.resume.set()
        try:
            self.answer_box.put_nowait(None)
        except queue.Full:
            pass

    def _set_debug_state(self, running: bool):
        state = "disabled" if running else "normal"
        self.btn_debug.configure(state=state)
        self.btn_step.configure(state=state)
        self.btn_continue.configure(state="normal" if running else "disabled")
        self.btn_next.configure(state="normal" if running else "disabled")
        self.btn_stop.configure(state="normal" if running else "disabled")
        self.btn_auto.configure(state=state)
        self.text.configure(state="disabled" if running else "normal")

    def _clear_run_views(self):
        self.log.configure(state="normal")
        self.log.delete("1.0", "end")
        self.log.configure(state="disabled")
        self.vars_tree.delete(*self.vars_tree.get_children())
        self.actions_tree.delete(*self.actions_tree.get_children())
        self.stack_list.delete(0, "end")
        self.bottom.select(0)

    def _on_log(self, entry: LogEntry):
        self.events.put(("log", entry))

    def _poll_events(self):
        try:
            while True:
                ev = self.events.get_nowait()
                self._handle_event(ev)
        except queue.Empty:
            pass
        self.after(60, self._poll_events)

    def _handle_event(self, ev):
        kind = ev[0]
        if kind == "log":
            entry: LogEntry = ev[1]
            self.log.configure(state="normal")
            self.log.insert("end", entry.format() + "\n", (entry.level,))
            self.log.see("end")
            self.log.configure(state="disabled")
        elif kind == "step":
            _, line, stack, variables = ev
            self._mark_current(line)
            self.stack_list.delete(0, "end")
            for item in reversed(stack):
                self.stack_list.insert("end", item)
            self._last_vars = variables
            self._refresh_vars()
        elif kind == "paused":
            self.mode_label.configure(text=f"Debug: angehalten in Zeile {ev[1]}", foreground="#e65100")
            self._set_status(f"Angehalten vor Zeile {ev[1]}. F12 = naechster Schritt, F5 = weiter, Umschalt+F5 = Stopp")
        elif kind == "ask_exit":
            _, cmdline, hidden = ev
            dlg = ExitCodeDialog(self, cmdline, hidden, self.settings.get("default_exit_code", 0))
            self.answer_box.put(dlg.code)
        elif kind == "ask":
            _, what, payload = ev
            if what == "askkill":
                dlg = AskKillDialog(self, payload)
                self.answer_box.put(dlg.answer)
            elif what == "prompt":
                value = simpledialog.askstring("Prompt", f"Wert fuer {payload.get('variable')}:\n{payload.get('definition') or ''}", parent=self)
                self.answer_box.put(value or "")
            else:
                self.answer_box.put("")
        elif kind == "done":
            result = ev[1]
            self._finish_run(result)
        elif kind == "phase":
            _, label, mode = ev
            self.text.tag_remove("executed", "1.0", "end")
            self.mode_label.configure(text=f"Automatischer Testlauf: {label}", foreground="#d32f2f")
            self.log.configure(state="normal")
            self.log.insert("end", f"\n===== {label} =====\n", ("INFO",))
            self.log.configure(state="disabled")
        elif kind == "auto_done":
            self._finish_auto(ev[1])
        elif kind == "crash":
            self._set_debug_state(False)
            self.mode_label.configure(text="Bearbeiten", foreground="#1b7f3b")
            messagebox.showerror("Testlauf", f"Der Interpreter ist abgestuerzt:\n{ev[1]}", parent=self)

    def _mark_current(self, line: int):
        self.text.tag_remove("current", "1.0", "end")
        if self.current_line:
            self.text.tag_add("executed", f"{self.current_line}.0", f"{self.current_line}.end")
        self.current_line = line
        self.text.tag_add("current", f"{line}.0", f"{line}.end")
        self.text.see(f"{line}.0")
        self._draw_gutter()

    _last_vars: dict = {}

    def _refresh_vars(self):
        flt = self.var_filter.get().lower()
        self.vars_tree.delete(*self.vars_tree.get_children())
        for name in sorted(self._last_vars, key=str.lower):
            if flt and flt not in name.lower() and flt not in self._last_vars[name].lower():
                continue
            self.vars_tree.insert("", "end", values=(name, self._last_vars[name]))

    def _finish_run(self, result):
        self._set_debug_state(False)
        if self.runner is not None and isinstance(self.runner.backend, SimulationBackend):
            self.sim_state = self.runner.backend
        self.text.tag_remove("current", "1.0", "end")
        for line in result.executed_lines:
            self.text.tag_add("executed", f"{line}.0", f"{line}.end")
        self.current_line = 0
        self._draw_gutter()
        self._last_vars = result.variables
        self._refresh_vars()
        for a in result.actions:
            self.actions_tree.insert("", "end", values=(a.kind, a.operation, a.target, a.detail))
        self.stack_list.delete(0, "end")
        self.last_log_path = result.log_path
        ok = result.status == Status.SUCCESS
        self.mode_label.configure(text="Bearbeiten", foreground="#1b7f3b")
        self._set_status(result.summary())
        self.log.configure(state="normal")
        self.log.insert("end", "\n" + result.summary() + "\n", ("INFO" if ok else "ERROR",))
        if result.log_path:
            self.log.insert("end", f"Protokoll: {result.log_path}\n", ("DEBUG",))
        self.log.see("end")
        self.log.configure(state="disabled")
        title = "Testlauf abgeschlossen" if ok else "Testlauf mit Fehler beendet"
        body = f"{result.status.value}\n{result.message}"
        if result.trigger:
            body += f"\n\n{result.trigger}"
        body += f"\n\nErrorLevel {result.error_level}"
        if result.reboot:
            body += f"\nNeustart angefordert: {result.reboot}"
        body += f"\n{result.warnings} Warnungen, {result.errors} Fehler, {len(result.actions)} Aktionen"
        (messagebox.showinfo if ok else messagebox.showwarning)(title, body, parent=self)

    def _finish_auto(self, rt: RoundtripResult):
        self._set_debug_state(False)
        self.text.tag_remove("current", "1.0", "end")
        self.current_line = 0
        self._draw_gutter()
        if self.runner is not None and isinstance(self.runner.backend, SimulationBackend):
            self.sim_state = self.runner.backend
        if rt.phases:
            last = rt.phases[-1].result
            self._last_vars = last.variables
            self._refresh_vars()
            self.actions_tree.delete(*self.actions_tree.get_children())
            for p in rt.phases:
                self.actions_tree.insert("", "end", values=("", f"== {p.label}", "", ""))
                for a in p.result.actions:
                    self.actions_tree.insert("", "end", values=(a.kind, a.operation, a.target, a.detail))
        self.last_log_path = rt.report_path
        self.mode_label.configure(text="Bearbeiten", foreground="#1b7f3b")
        self._set_status(rt.summary())
        lines = [rt.summary(), ""]
        for p in rt.phases:
            lines.append(f"{p.label}: {p.result.status.value}, ErrorLevel {p.result.error_level}")
            if p.result.trigger:
                lines.append(f"    {p.result.trigger}")
            for name, passed, detail in p.checks:
                lines.append(f"    [{'x' if passed else ' '}] {name}")
        if rt.report_path:
            lines += ["", f"Testbericht: {rt.report_path}"]
        self.log.configure(state="normal")
        self.log.insert("end", "\n" + "\n".join(lines) + "\n", ("INFO" if rt.ok else "ERROR",))
        self.log.see("end")
        self.log.configure(state="disabled")
        (messagebox.showinfo if rt.ok else messagebox.showwarning)(
            "Automatischer Testlauf " + ("bestanden" if rt.ok else "nicht bestanden"), "\n".join(lines), parent=self)

    # -- Hilfe --------------------------------------------------------------------

    def show_keys(self):
        messagebox.showinfo("Tastenkuerzel",
                            "Strg+N  Neu aus Vorlage\nStrg+O  Oeffnen\nStrg+S  Speichern\nStrg+W  Ansicht wechseln\n"
                            "Strg+F  Suchen/Ersetzen\nF3  Weitersuchen\nStrg+G  Gehe zu Zeile\n"
                            "Strg+Leertaste  Vervollstaendigen\nF5  DEBUG / Weiter\nF12  EINZELSCHRITT / Schritt\n"
                            "Umschalt+F5  Stopp\nF9  Haltepunkt\nF7  Paketpruefung\nF1  Befehlsreferenz", parent=self)

    def show_about(self):
        messagebox.showinfo("Info",
                            "Empirum Package Editor (Nachbau) - Teil des Packaging Center 24.0 Nachbaus.\n\n"
                            "Kein Produkt von Matrix42. Der Interpreter bildet Setup.exe nach, so weit die "
                            "oeffentliche Dokumentation und die Vorlagen es belegen.", parent=self)
