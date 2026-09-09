"""Package Wizard (Nachbau): legt ein Paket aus einer Vorlage an.

Seiten: Methode, Paketdaten, Installer, Prozesse, Ziel, Zusammenfassung.
Am Ende entsteht <Store>\\<Hersteller>\\<Produkt>\\<Version>\\Install\\Setup.inf
und Files\\ mit dem Installer; die Setup.inf oeffnet sich im Package Editor.
"""

from __future__ import annotations

import os
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

from empirum.package import PackageSpec, create_package, list_templates, TEMPLATE_DIR
from gui.dialogs import load_settings, save_settings


class PackageWizard(tk.Toplevel):
    def __init__(self, master, settings: dict | None = None, on_finish=None):
        super().__init__(master)
        self.settings = settings if settings is not None else load_settings()
        self.on_finish = on_finish
        self.title("Empirum Package Wizard")
        self.geometry("760x560")
        self.resizable(False, False)
        self.page = 0
        self.processes: list[tuple[str, str]] = []
        self._vars()
        self._build()
        self._show_page(0)

    def _vars(self):
        s = self.settings
        templates = list_templates()
        self.template = tk.StringVar(value=templates[0] if templates else "")
        self.method = tk.StringVar(value="EXE")
        self.developer = tk.StringVar()
        self.product = tk.StringVar()
        self.version = tk.StringVar()
        self.revision = tk.StringVar(value="0")
        self.author = tk.StringVar(value=s.get("author") or os.environ.get("USERNAME") or os.environ.get("USER") or "")
        self.description = tk.StringVar()
        self.order = tk.StringVar()
        self.requester = tk.StringVar()
        self.installer = tk.StringVar()
        self.params = tk.StringVar(value="/S")
        self.uninst_params = tk.StringVar(value="/S")
        self.display_name = tk.StringVar()
        self.arch = tk.StringVar(value="x64")
        self.platform = tk.StringVar(value="x64")
        self.cmd_options = tk.StringVar(value="/S0")
        self.copy_installer = tk.BooleanVar(value=True)
        self.store = tk.StringVar(value=s.get("package_store", ""))
        self.open_editor = tk.BooleanVar(value=True)

    def _build(self):
        self.header = ttk.Label(self, text="", font=("Segoe UI", 12, "bold"), padding=(12, 10))
        self.header.pack(anchor="w")
        self.hint = ttk.Label(self, text="", wraplength=720, justify="left", foreground="#555", padding=(12, 0))
        self.hint.pack(anchor="w")
        self.container = ttk.Frame(self, padding=12)
        self.container.pack(fill="both", expand=True)
        self.pages = [self._page_method(), self._page_info(), self._page_installer(), self._page_processes(),
                      self._page_target(), self._page_summary()]
        nav = ttk.Frame(self, padding=(12, 8))
        nav.pack(fill="x", side="bottom")
        self.btn_back = ttk.Button(nav, text="< Zurueck", command=self.back)
        self.btn_back.pack(side="left")
        ttk.Button(nav, text="Abbrechen", command=self.destroy).pack(side="right")
        self.btn_next = ttk.Button(nav, text="Weiter >", command=self.next)
        self.btn_next.pack(side="right", padx=6)

    # -- Seiten --------------------------------------------------------------

    def _page_method(self):
        f = ttk.Frame(self.container)
        ttk.Label(f, text="Paketierungsmethode").pack(anchor="w")
        for label, value, tpl in (("Unattended: Setup-Programm (EXE) mit stillen Parametern", "EXE", "EXE.inf"),
                                  ("MSI: Windows-Installer-Paket", "MSI", "MSI.inf")):
            ttk.Radiobutton(f, text=label, variable=self.method, value=value,
                            command=lambda t=tpl: self._pick_template(t)).pack(anchor="w", pady=4)
        row = ttk.Frame(f)
        row.pack(fill="x", pady=(16, 4))
        ttk.Label(row, text="Vorlage:").pack(side="left")
        self.template_box = ttk.Combobox(row, textvariable=self.template, values=list_templates(), width=40)
        self.template_box.pack(side="left", padx=6)
        ttk.Button(row, text="Andere Datei...", command=self._pick_template_file).pack(side="left")
        ttk.Label(f, text=f"Vorlagen liegen unter {TEMPLATE_DIR}. Eigene Vorlagen dort ablegen oder hier auswaehlen.",
                  wraplength=700, foreground="#555").pack(anchor="w", pady=8)
        return f

    def _pick_template(self, name: str):
        if name in list_templates():
            self.template.set(name)

    def _pick_template_file(self):
        path = filedialog.askopenfilename(parent=self, title="Vorlage waehlen", filetypes=[("INF", "*.inf")])
        if path:
            self.template.set(path)

    def _page_info(self):
        f = ttk.Frame(self.container)
        rows = [("Hersteller (DeveloperName)", self.developer), ("Produkt (ProductName)", self.product),
                ("Version", self.version), ("Revision", self.revision), ("Autor", self.author),
                ("Beschreibung", self.description), ("Auftragsnummer", self.order), ("Besteller", self.requester),
                ("Command line options", self.cmd_options)]
        for i, (label, var) in enumerate(rows):
            ttk.Label(f, text=label + ":").grid(row=i, column=0, sticky="w", pady=3, padx=(0, 8))
            ttk.Entry(f, textvariable=var, width=60).grid(row=i, column=1, sticky="ew", pady=3)
        f.columnconfigure(1, weight=1)
        ttk.Label(f, text="Aus Hersteller, Produkt und Version entsteht der Paketordner "
                          "<Hersteller>\\<Produkt>\\<Version>. Zeichen wie \\ / : * ? \" < > | sind nicht erlaubt.",
                  wraplength=700, foreground="#555").grid(row=len(rows), column=0, columnspan=2, sticky="w", pady=10)
        return f

    def _page_installer(self):
        f = ttk.Frame(self.container)
        ttk.Label(f, text="Installerdatei:").grid(row=0, column=0, sticky="w", pady=3)
        row = ttk.Frame(f)
        row.grid(row=0, column=1, sticky="ew")
        ttk.Entry(row, textvariable=self.installer, width=52).pack(side="left", fill="x", expand=True)
        ttk.Button(row, text="...", width=3, command=self._pick_installer).pack(side="left", padx=4)
        ttk.Label(f, text="Parameter Installation:").grid(row=1, column=0, sticky="w", pady=3)
        ttk.Entry(f, textvariable=self.params, width=60).grid(row=1, column=1, sticky="ew")
        ttk.Label(f, text="Parameter Deinstallation:").grid(row=2, column=0, sticky="w", pady=3)
        ttk.Entry(f, textvariable=self.uninst_params, width=60).grid(row=2, column=1, sticky="ew")
        ttk.Label(f, text="DisplayName unter Uninstall:").grid(row=3, column=0, sticky="w", pady=3)
        ttk.Entry(f, textvariable=self.display_name, width=60).grid(row=3, column=1, sticky="ew")
        ttk.Label(f, text="Architektur:").grid(row=4, column=0, sticky="w", pady=3)
        r = ttk.Frame(f)
        r.grid(row=4, column=1, sticky="w")
        for label, value in (("x64", "x64"), ("x86", "x86"), ("beide (Win64/Win32-Abschnitte)", "both")):
            ttk.Radiobutton(r, text=label, variable=self.arch, value=value).pack(side="left", padx=4)
        ttk.Label(f, text="[Setup] Platform:").grid(row=5, column=0, sticky="w", pady=3)
        ttk.Combobox(f, textvariable=self.platform, values=("*", "x64", "x86", "x86os"), width=8, state="readonly").grid(row=5, column=1, sticky="w")
        ttk.Checkbutton(f, text="Installer nach Files\\ kopieren", variable=self.copy_installer).grid(row=6, column=1, sticky="w", pady=6)
        f.columnconfigure(1, weight=1)
        ttk.Label(f, text="MSI: Parameter wie REBOOT=REALLYSUPPRESS /qn setzt die Vorlage selbst; hier reicht der Dateiname. "
                          "Der DisplayName ist der Name unter Systemsteuerung > Programme; mit ihm findet das Skript "
                          "die Installation (GetUninstallKeyName). * als Platzhalter ist erlaubt.",
                  wraplength=700, foreground="#555").grid(row=7, column=0, columnspan=2, sticky="w", pady=10)
        return f

    def _pick_installer(self):
        path = filedialog.askopenfilename(parent=self, title="Installer waehlen",
                                          filetypes=[("Installer", "*.exe *.msi"), ("Alle Dateien", "*.*")])
        if path:
            self.installer.set(path)
            if path.lower().endswith(".msi"):
                self.method.set("MSI")
                self._pick_template("MSI.inf")
                self.params.set("")
                self.uninst_params.set("")
            if not self.display_name.get():
                self.display_name.set(self.product.get())

    def _page_processes(self):
        f = ttk.Frame(self.container)
        ttk.Label(f, text="Prozesse, die vor der Installation beendet werden (AskKillProcesses):").pack(anchor="w")
        self.proc_tree = ttk.Treeview(f, columns=("exe", "title"), show="headings", height=8)
        self.proc_tree.heading("exe", text="Prozess (exe)")
        self.proc_tree.heading("title", text="Anzeigename")
        self.proc_tree.pack(fill="x", pady=6)
        row = ttk.Frame(f)
        row.pack(fill="x")
        self.proc_exe = tk.StringVar()
        self.proc_title = tk.StringVar()
        ttk.Entry(row, textvariable=self.proc_exe, width=24).pack(side="left")
        ttk.Entry(row, textvariable=self.proc_title, width=36).pack(side="left", padx=4)
        ttk.Button(row, text="Hinzufuegen", command=self._add_process).pack(side="left")
        ttk.Button(row, text="Entfernen", command=self._remove_process).pack(side="left", padx=4)
        ttk.Label(f, text="Ohne Eintraege bleiben die AskKillProcesses-Zeilen der Vorlage auskommentiert.",
                  foreground="#555").pack(anchor="w", pady=8)
        return f

    def _add_process(self):
        exe = self.proc_exe.get().strip()
        if not exe:
            return
        self.processes.append((exe, self.proc_title.get().strip() or exe))
        self.proc_tree.insert("", "end", values=self.processes[-1])
        self.proc_exe.set("")
        self.proc_title.set("")

    def _remove_process(self):
        sel = self.proc_tree.selection()
        if not sel:
            return
        idx = self.proc_tree.index(sel[0])
        self.proc_tree.delete(sel[0])
        del self.processes[idx]

    def _page_target(self):
        f = ttk.Frame(self.container)
        ttk.Label(f, text="Package Store (Zielordner):").pack(anchor="w")
        row = ttk.Frame(f)
        row.pack(fill="x", pady=4)
        ttk.Entry(row, textvariable=self.store, width=70).pack(side="left", fill="x", expand=True)
        ttk.Button(row, text="...", width=3, command=self._pick_store).pack(side="left", padx=4)
        self.target_label = ttk.Label(f, text="", foreground="#0b3d91", wraplength=700, justify="left")
        self.target_label.pack(anchor="w", pady=8)
        ttk.Checkbutton(f, text="Setup.inf danach im Package Editor oeffnen", variable=self.open_editor).pack(anchor="w")
        ttk.Label(f, text="Das Original schlaegt hier \\\\<EmpirumServer>\\Configurator$\\PackageStore vor. "
                          "Lokal reicht ein Ordner; der Import in die Empirum-Konsole geschieht spaeter ueber den "
                          "ZIP-Export oder das Kopieren nach Configurator$\\Packages.",
                  wraplength=700, foreground="#555").pack(anchor="w", pady=8)
        return f

    def _pick_store(self):
        path = filedialog.askdirectory(parent=self, title="Package Store waehlen")
        if path:
            self.store.set(path)
            self._update_target()

    def _update_target(self):
        self.target_label.configure(text=os.path.join(self.store.get() or "<Store>", self.developer.get() or "<Hersteller>",
                                                      self.product.get() or "<Produkt>", self.version.get() or "<Version>",
                                                      "Install", "Setup.inf"))

    def _page_summary(self):
        f = ttk.Frame(self.container)
        self.summary = tk.Text(f, height=20, width=90, font=("Consolas", 10), state="disabled")
        self.summary.pack(fill="both", expand=True)
        return f

    # -- Navigation ----------------------------------------------------------

    TITLES = [("Methode", "Wie wird die Software installiert?"),
              ("Paketdaten", "Angaben fuer [Application] und [SetupInfo]."),
              ("Installer", "Setup-Datei, Parameter und Erkennung der Installation."),
              ("Prozesse", "Laufende Programme, die der Installation im Weg stehen."),
              ("Ziel", "Wohin das Paket geschrieben wird."),
              ("Zusammenfassung", "Pruefen und mit 'Fertigstellen' anlegen.")]

    def _show_page(self, n: int):
        for p in self.pages:
            p.pack_forget()
        self.page = n
        self.pages[n].pack(fill="both", expand=True)
        title, hint = self.TITLES[n]
        self.header.configure(text=f"Schritt {n + 1} von {len(self.pages)}: {title}")
        self.hint.configure(text=hint)
        self.btn_back.configure(state="normal" if n > 0 else "disabled")
        self.btn_next.configure(text="Fertigstellen" if n == len(self.pages) - 1 else "Weiter >")
        if n == 4:
            self._update_target()
        if n == 5:
            self._fill_summary()

    def back(self):
        if self.page > 0:
            self._show_page(self.page - 1)

    def next(self):
        if not self._validate_page():
            return
        if self.page == len(self.pages) - 1:
            self.finish()
        else:
            self._show_page(self.page + 1)

    def _validate_page(self) -> bool:
        if self.page == 0 and not self.template.get():
            messagebox.showerror("Vorlage", "Bitte eine Vorlage waehlen.", parent=self)
            return False
        if self.page == 1:
            for label, var in (("Hersteller", self.developer), ("Produkt", self.product), ("Version", self.version)):
                if not var.get().strip():
                    messagebox.showerror("Paketdaten", f"{label} fehlt.", parent=self)
                    return False
                if any(c in var.get() for c in '\\/:*?"<>|'):
                    messagebox.showerror("Paketdaten", f"{label} enthaelt unzulaessige Zeichen.", parent=self)
                    return False
        if self.page == 2 and not self.installer.get().strip():
            if not messagebox.askyesno("Installer", "Kein Installer angegeben. Trotzdem weiter? Der Dateiname "
                                                    "muss dann spaeter in [Set:Win64]/[Set:Win32] eingetragen werden.", parent=self):
                return False
        if self.page == 4 and not self.store.get().strip():
            messagebox.showerror("Ziel", "Bitte einen Zielordner waehlen.", parent=self)
            return False
        return True

    def _spec(self) -> PackageSpec:
        return PackageSpec(
            template=self.template.get(), developer=self.developer.get().strip(), product=self.product.get().strip(),
            version=self.version.get().strip(), revision=self.revision.get().strip() or "0",
            author=self.author.get().strip(), description=self.description.get().strip(),
            installer=self.installer.get().strip(), install_params=self.params.get().strip(),
            uninstall_params=self.uninst_params.get().strip(), display_name=self.display_name.get().strip(),
            arch=self.arch.get(), platform=self.platform.get(), processes=list(self.processes),
            order_number=self.order.get().strip(), requester=self.requester.get().strip(),
            command_line_options=self.cmd_options.get().strip() or "/S0", copy_installer=self.copy_installer.get(),
        )

    def _fill_summary(self):
        s = self._spec()
        target = os.path.join(self.store.get(), s.developer, s.product, s.version)
        lines = [
            f"Vorlage:            {s.template}",
            f"Methode:            {self.method.get()}",
            f"Hersteller:         {s.developer}",
            f"Produkt:            {s.product}",
            f"Version / Revision: {s.version} / {s.revision}",
            f"Autor:              {s.author}",
            f"Beschreibung:       {s.description}",
            f"Installer:          {s.installer or '(keiner)'}",
            f"Parameter:          {s.install_params}",
            f"Deinst.-Parameter:  {s.uninstall_params}",
            f"DisplayName:        {s.display_name or '(leer, spaeter eintragen)'}",
            f"Architektur:        {s.arch}, Platform={s.platform}",
            f"Prozesse:           {', '.join(e for e, _ in s.processes) or '(keine)'}",
            f"Command line opts:  {s.command_line_options}",
            "",
            f"Ziel:               {target}",
            f"                    Install\\Setup.inf" + (", Files\\" + os.path.basename(s.installer) if s.installer and s.copy_installer else ""),
        ]
        self.summary.configure(state="normal")
        self.summary.delete("1.0", "end")
        self.summary.insert("1.0", "\n".join(lines))
        self.summary.configure(state="disabled")

    def finish(self):
        spec = self._spec()
        try:
            path = create_package(spec, self.store.get().strip())
        except FileExistsError as exc:
            messagebox.showerror("Paket anlegen", str(exc), parent=self)
            return
        except OSError as exc:
            messagebox.showerror("Paket anlegen", f"Fehler beim Anlegen:\n{exc}", parent=self)
            return
        self.settings["package_store"] = self.store.get().strip()
        self.settings["author"] = spec.author
        save_settings(self.settings)
        messagebox.showinfo("Paket angelegt", f"Setup.inf erzeugt:\n{path}", parent=self)
        if self.on_finish:
            self.on_finish(path, self.open_editor.get())
        self.destroy()
