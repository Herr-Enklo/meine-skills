"""Startfenster des Packaging Centers (Nachbau).

Wie das Original ein kleines Fenster mit Schaltflaechen fuer die Werkzeuge:
Package Wizard, Package Editor, Paketpruefung, Package Store (Paketliste),
Testumgebung. Dazu eine Liste der Pakete im eingestellten Package Store und
die zuletzt geoeffneten Dateien.
"""

from __future__ import annotations

import os
import sys
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

from empirum import load_inf, validate
from empirum.package import find_packages, export_zip
from gui.dialogs import load_settings, save_settings, EnvironmentDialog, ReferenceWindow, AutomationDialog
from empirum.pipeline import build_package
from empirum.package import update_package
from gui.editor import EditorWindow
from gui.wizard import PackageWizard

VERSION = "24.0 (Nachbau)"


class CenterApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.settings = load_settings()
        self.editors: list[EditorWindow] = []
        root.title(f"Empirum Packaging Center {VERSION}")
        root.geometry("900x560")
        root.minsize(760, 480)
        self._style()
        self._build()
        self.refresh_store()

    def _style(self):
        style = ttk.Style(self.root)
        try:
            style.theme_use("vista" if sys.platform.startswith("win") else "clam")
        except tk.TclError:
            pass
        style.configure("Tile.TButton", font=("Segoe UI", 10, "bold"), padding=(14, 12))

    def _build(self):
        head = ttk.Frame(self.root, padding=(14, 10))
        head.pack(fill="x")
        ttk.Label(head, text="Empirum Packaging Center", font=("Segoe UI", 16, "bold")).pack(anchor="w")
        ttk.Label(head, text=f"Version {VERSION}: Pakete anlegen, Setup.inf bearbeiten, lokal testen. "
                             "Kein Produkt von Matrix42.", foreground="#555").pack(anchor="w")

        body = ttk.Frame(self.root, padding=(14, 4))
        body.pack(fill="both", expand=True)
        tiles = ttk.Frame(body)
        tiles.pack(side="left", fill="y", padx=(0, 14))
        for label, cmd in (("Package Wizard", self.open_wizard),
                           ("Package Editor", lambda: self.open_editor(None)),
                           ("Automatik: bauen + testen", self.open_automation),
                           ("Paketpruefung", self.check_package),
                           ("Package Store...", self.choose_store),
                           ("Testumgebung...", self.edit_environment),
                           ("Befehlsreferenz", lambda: ReferenceWindow(self.root))):
            ttk.Button(tiles, text=label, style="Tile.TButton", width=22, command=cmd).pack(fill="x", pady=4)

        right = ttk.Frame(body)
        right.pack(side="left", fill="both", expand=True)
        top = ttk.Frame(right)
        top.pack(fill="x")
        ttk.Label(top, text="Package Store:", font=("Segoe UI", 9, "bold")).pack(side="left")
        self.store_label = ttk.Label(top, text="", foreground="#0b3d91")
        self.store_label.pack(side="left", padx=6)
        ttk.Button(top, text="Aktualisieren", command=self.refresh_store).pack(side="right")
        self.pkg_tree = ttk.Treeview(right, columns=("dev", "prod", "ver", "method", "path"), show="headings")
        for col, label, width in (("dev", "Hersteller", 150), ("prod", "Produkt", 220), ("ver", "Version", 100),
                                  ("method", "Methode", 90), ("path", "Setup.inf", 300)):
            self.pkg_tree.heading(col, text=label)
            self.pkg_tree.column(col, width=width, stretch=(col in ("prod", "path")))
        ps = ttk.Scrollbar(right, orient="vertical", command=self.pkg_tree.yview)
        self.pkg_tree.configure(yscrollcommand=ps.set)
        ps.pack(side="right", fill="y")
        self.pkg_tree.pack(fill="both", expand=True, pady=4)
        self.pkg_tree.bind("<Double-Button-1>", lambda e: self.open_selected())
        self.pkg_tree.bind("<Button-3>", self._pkg_menu)
        buttons = ttk.Frame(right)
        buttons.pack(fill="x")
        ttk.Button(buttons, text="Im Editor oeffnen", command=self.open_selected).pack(side="left")
        ttk.Button(buttons, text="Pruefen", command=self.check_selected).pack(side="left", padx=4)
        ttk.Button(buttons, text="Als ZIP exportieren", command=self.export_selected).pack(side="left")
        ttk.Button(buttons, text="Ordner oeffnen", command=self.open_selected_folder).pack(side="left", padx=4)

        recent = ttk.LabelFrame(right, text="Zuletzt geoeffnet")
        recent.pack(fill="x", pady=(8, 0))
        self.recent_list = tk.Listbox(recent, height=4)
        self.recent_list.pack(fill="x", padx=4, pady=4)
        self.recent_list.bind("<Double-Button-1>", lambda e: self._open_recent())
        self._fill_recent()

        self.status = ttk.Label(self.root, text="Bereit", anchor="w", relief="sunken", padding=(6, 2))
        self.status.pack(fill="x", side="bottom")

    # -- Aktionen ------------------------------------------------------------

    def open_wizard(self):
        PackageWizard(self.root, self.settings, on_finish=self._wizard_done)

    def _wizard_done(self, path: str, open_editor: bool):
        self.refresh_store()
        if open_editor:
            self.open_editor(path)

    def open_editor(self, path: str | None):
        for ed in self.editors:
            if path and ed.path and os.path.normcase(ed.path) == os.path.normcase(path):
                ed.lift()
                ed.focus_force()
                return ed
        ed = EditorWindow(self.root, path, self.settings, on_close=self._editor_closed)
        self.editors.append(ed)
        return ed

    def _editor_closed(self, ed):
        if ed in self.editors:
            self.editors.remove(ed)
        self._fill_recent()

    def open_automation(self):
        dlg = AutomationDialog(self.root, self.settings)
        if not dlg.confirmed:
            return
        save_settings(self.settings)
        try:
            if dlg.update_to:
                setup_inf = update_package(dlg.source_inf, dlg.update_to, store=dlg.store,
                                           author=self.settings.get("author", ""), files_dir=dlg.files_dir or None)
                notes = []
            else:
                res = build_package(dlg.source_inf, dlg.store, files_dir=dlg.files_dir or None, overwrite=dlg.overwrite)
                setup_inf, notes = res.setup_inf, res.notes
        except (OSError, ValueError) as exc:
            messagebox.showerror("Paket bauen", str(exc), parent=self.root)
            return
        self.refresh_store()
        self.status.configure(text=f"Paket gebaut: {setup_inf}")
        if notes:
            messagebox.showwarning("Paket gebaut, Hinweise", "\n".join(notes), parent=self.root)
        ed = self.open_editor(setup_inf)
        if dlg.test_mode in ("real", "sim") and ed is not None:
            # Editor zuerst aufbauen lassen, dann automatisch starten
            ed.after(400, lambda: ed.start_auto(simulate=dlg.test_mode == "sim", reinstall=dlg.reinstall, ask=False))

    def check_package(self):
        path = filedialog.askopenfilename(parent=self.root, title="Setup.inf pruefen",
                                          filetypes=[("Setup.inf", "*.inf"), ("Alle Dateien", "*.*")])
        if path:
            self._check(path)

    def _check(self, path: str):
        try:
            inf = load_inf(path)
        except OSError as exc:
            messagebox.showerror("Pruefen", str(exc), parent=self.root)
            return
        findings = validate(inf)
        errors = [f for f in findings if f.level == "Fehler"]
        warnings = [f for f in findings if f.level == "Warnung"]
        text = f"{len(errors)} Fehler, {len(warnings)} Warnungen, {len(findings) - len(errors) - len(warnings)} Hinweise\n\n"
        text += "\n".join(str(f) for f in findings[:25])
        if len(findings) > 25:
            text += f"\n... und {len(findings) - 25} weitere (im Editor unter 'Pruefung')"
        if messagebox.askyesno("Paketpruefung", text + "\n\nIm Editor oeffnen?", parent=self.root):
            self.open_editor(path)

    def choose_store(self):
        path = filedialog.askdirectory(parent=self.root, title="Package Store waehlen",
                                       initialdir=self.settings.get("package_store") or os.getcwd())
        if path:
            self.settings["package_store"] = path
            save_settings(self.settings)
            self.refresh_store()

    def refresh_store(self):
        store = self.settings.get("package_store", "")
        self.store_label.configure(text=store or "(nicht gewaehlt)")
        self.pkg_tree.delete(*self.pkg_tree.get_children())
        if not store or not os.path.isdir(store):
            return
        packages = find_packages(store)
        for p in packages:
            self.pkg_tree.insert("", "end", values=(p.developer, p.product, p.version, p.method, p.setup_inf))
        self.status.configure(text=f"{len(packages)} Pakete in {store}")

    def _selected_path(self) -> str | None:
        sel = self.pkg_tree.selection()
        if not sel:
            return None
        return self.pkg_tree.item(sel[0], "values")[4]

    def open_selected(self):
        path = self._selected_path()
        if path:
            self.open_editor(path)

    def check_selected(self):
        path = self._selected_path()
        if path:
            self._check(path)

    def export_selected(self):
        path = self._selected_path()
        if not path:
            return
        root = os.path.dirname(os.path.dirname(path))
        default = os.path.basename(os.path.dirname(root)) + "_" + os.path.basename(root) + ".zip"
        target = filedialog.asksaveasfilename(parent=self.root, title="ZIP exportieren", defaultextension=".zip",
                                              initialfile=default.replace(" ", "_"), filetypes=[("ZIP", "*.zip")])
        if not target:
            return
        include = messagebox.askyesno("Export", "Files\\ (Installer) mit einpacken?", parent=self.root)
        n = export_zip(root, target, include_files=include)
        messagebox.showinfo("Export", f"{n} Dateien nach {target} geschrieben.", parent=self.root)

    def open_selected_folder(self):
        path = self._selected_path()
        if not path:
            return
        folder = os.path.dirname(os.path.dirname(path))
        try:
            if sys.platform.startswith("win"):
                os.startfile(folder)  # type: ignore[attr-defined]
            else:
                import subprocess
                subprocess.Popen(["xdg-open" if sys.platform != "darwin" else "open", folder])
        except OSError as exc:
            messagebox.showerror("Ordner", str(exc), parent=self.root)

    def _pkg_menu(self, event):
        item = self.pkg_tree.identify_row(event.y)
        if not item:
            return
        self.pkg_tree.selection_set(item)
        menu = tk.Menu(self.root, tearoff=0)
        menu.add_command(label="Im Editor oeffnen", command=self.open_selected)
        menu.add_command(label="Pruefen", command=self.check_selected)
        menu.add_command(label="Als ZIP exportieren", command=self.export_selected)
        menu.add_command(label="Ordner oeffnen", command=self.open_selected_folder)
        menu.tk_popup(event.x_root, event.y_root)

    def edit_environment(self):
        EnvironmentDialog(self.root, self.settings)
        save_settings(self.settings)

    def _fill_recent(self):
        self.recent_list.delete(0, "end")
        for p in self.settings.get("recent", []):
            self.recent_list.insert("end", p)

    def _open_recent(self):
        sel = self.recent_list.curselection()
        if sel:
            self.open_editor(self.recent_list.get(sel[0]))


def run_app(path: str | None = None) -> int:
    root = tk.Tk()
    app = CenterApp(root)
    if path:
        app.open_editor(path)
    root.mainloop()
    return 0
