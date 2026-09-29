"""Kleine tkinter-Oberfläche: Laufwerk wählen, scannen, wiederherstellen.

Der Aufbau ist bewusst schlicht:

1. Quelle wählen (erkanntes Laufwerk aus der Liste oder eine Image-Datei).
2. Ausgabeordner wählen (muss auf einem anderen Datenträger liegen – das wird
   vor dem Schreiben geprüft).
3. "Scannen" – der Scan läuft in einem Hintergrund-Thread, damit die
   Oberfläche bedienbar bleibt; Funde erscheinen gebündelt in der Liste.
4. "Wiederherstellen" – schreibt die gewählten Funde in den Ausgabeordner.
   Gelesen wird immer die Quelle, die gescannt wurde, auch wenn die Auswahl
   oben inzwischen geändert wurde.

Die Engine liest die Quelle ausschließlich. Geschrieben wird nur in den
Ausgabeordner.
"""

from __future__ import annotations

import os
import queue
import subprocess
import sys
import threading
import time

import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from recovery import ByteSource, Scanner, ScanOptions
from recovery import scanner as scanner_mod
from recovery.drives import Drive, format_size, list_drives, output_on_source
from gui.sorting import order_indices, state_of

# So viele Zeilen zeigen wir höchstens in der Liste an (Tk wird bei sehr vielen
# Zeilen träge). Alle Funde bleiben intern erhalten, werden beim Sortieren
# berücksichtigt und lassen sich per "Alle wiederherstellen" retten.
MAX_ROWS = 20000

# Funde werden vom Scan-Thread gebündelt übergeben, höchstens so oft.
BATCH_SECONDS = 0.15

SECTOR_CHOICES = {"automatisch": None, "512 Byte": 512, "4096 Byte (4Kn)": 4096}

COLUMNS = ("typ", "name", "groesse", "geaendert", "zustand", "quelle")
COLUMN_TITLES = {"typ": "Typ", "name": "Name/Pfad", "groesse": "Größe",
                 "geaendert": "Geändert", "zustand": "Zustand", "quelle": "Herkunft"}


class RecoveryApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Datenrettung")
        self.root.geometry("1000x720")
        self.root.minsize(760, 560)

        self.queue: queue.Queue = queue.Queue()
        self.worker: threading.Thread | None = None
        self.cancel_flag = threading.Event()
        self.findings: list = []
        self.view: list[int] = []               # Fund-Indizes in Anzeige-Reihenfolge
        self.sources: dict[str, str] = {}       # Anzeigename -> Pfad/Gerät
        self.busy = False
        self._sort_col: str | None = None
        self._sort_reverse = False
        self._progress = None                   # vom Worker gesetzt, per Polling gelesen
        self._recover_progress = None
        self.scan_source: tuple[str, int | None] | None = None   # (Pfad, Sektorgröße)
        self._streamed = False                  # hat der letzte Scan linear gelesen?
        self._poll_id: str | None = None
        self._closing = False                   # Fenster soll nach dem Abbruch schließen
        self._close_deadline = 0.0

        self._build_ui()
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        self.root.bind("<Destroy>", self._on_destroy, add="+")
        self._poll_queue()
        self.refresh_drives()

    # -- Aufbau der Oberfläche -----------------------------------------

    def _build_ui(self) -> None:
        pad = {"padx": 8, "pady": 4}
        root = self.root

        self.banner = tk.Label(
            root,
            text=("Nur-Lesen-Modus: Die Quelle wird nie verändert. Den Ausgabeordner "
                  "immer auf einem ANDEREN Datenträger wählen. Zugriff auf ganze "
                  "Laufwerke erfordert Administratorrechte."),
            bg="#fff3cd", fg="#664d03", anchor="w", justify="left", padx=10, pady=6,
        )
        self.banner.pack(side="top", fill="x")
        self.banner.bind("<Configure>",
                         lambda e: self.banner.configure(wraplength=max(200, e.width - 24)))

        # Quelle
        src_frame = ttk.LabelFrame(root, text="1. Quelle (Laufwerk oder Image)")
        src_frame.pack(side="top", fill="x", **pad)
        self.source_var = tk.StringVar()
        self.source_box = ttk.Combobox(src_frame, textvariable=self.source_var,
                                       state="readonly")
        self.source_box.grid(row=0, column=0, sticky="ew", padx=6, pady=6)
        self.refresh_btn = ttk.Button(src_frame, text="Aktualisieren",
                                      command=self.refresh_drives)
        self.refresh_btn.grid(row=0, column=1, padx=4)
        self.image_btn = ttk.Button(src_frame, text="Image-Datei …", command=self.choose_image)
        self.image_btn.grid(row=0, column=2, padx=4)
        src_frame.columnconfigure(0, weight=1)

        # Ausgabe
        out_frame = ttk.LabelFrame(root, text="2. Ausgabeordner (auf einem anderen Datenträger)")
        out_frame.pack(side="top", fill="x", **pad)
        self.out_var = tk.StringVar()
        self.out_entry = ttk.Entry(out_frame, textvariable=self.out_var)
        self.out_entry.grid(row=0, column=0, sticky="ew", padx=6, pady=6)
        self.out_btn = ttk.Button(out_frame, text="Wählen …", command=self.choose_output)
        self.out_btn.grid(row=0, column=1, padx=4)
        out_frame.columnconfigure(0, weight=1)

        # Optionen – zeilenweise angelegt, damit die Tab-Reihenfolge der Anzeige folgt.
        opt_frame = ttk.LabelFrame(root, text="3. Optionen")
        opt_frame.pack(side="top", fill="x", **pad)
        self.opt_ntfs = tk.BooleanVar(value=True)
        self.opt_fat = tk.BooleanVar(value=True)
        self.opt_carve = tk.BooleanVar(value=True)
        self.opt_free = tk.BooleanVar(value=True)
        self.opt_partial = tk.BooleanVar(value=True)
        self.opt_validate = tk.BooleanVar(value=True)
        self.opt_all = tk.BooleanVar(value=False)
        self.opt_usn = tk.BooleanVar(value=False)
        self.opt_orphan = tk.BooleanVar(value=False)
        self.opt_reconstruct = tk.BooleanVar(value=False)
        options = [
            ("NTFS: gelöschte Dateien (mit Namen)", self.opt_ntfs),
            ("FAT/exFAT: gelöschte Dateien", self.opt_fat),
            ("File-Carving (nach Signatur)", self.opt_carve),
            ("Carving nur im freien Speicher", self.opt_free),
            ("Unvollständige Dateien mitnehmen", self.opt_partial),
            ("Treffer validieren", self.opt_validate),
            ("Auch vorhandene Dateien listen", self.opt_all),
            ("USN-Journal (Namen gelöschter Dateien)", self.opt_usn),
            ("Ganzen Datenträger nach MFT-Einträgen absuchen", self.opt_orphan),
            ("Partitionstabelle rekonstruieren", self.opt_reconstruct),
        ]
        self.option_widgets: list = []
        for i, (text, var) in enumerate(options):
            cb = ttk.Checkbutton(opt_frame, text=text, variable=var)
            cb.grid(row=i // 2, column=i % 2, sticky="w", padx=6, pady=2)
            self.option_widgets.append(cb)
        sector_row = ttk.Frame(opt_frame)
        sector_row.grid(row=(len(options) + 1) // 2, column=0, columnspan=2, sticky="w",
                        padx=6, pady=(2, 6))
        ttk.Label(sector_row, text="Sektorgröße:").pack(side="left")
        self.sector_var = tk.StringVar(value="automatisch")
        self.sector_box = ttk.Combobox(sector_row, textvariable=self.sector_var,
                                       state="readonly", values=list(SECTOR_CHOICES), width=18)
        self.sector_box.pack(side="left", padx=6)
        opt_frame.columnconfigure(0, weight=1)
        opt_frame.columnconfigure(1, weight=1)

        # Aktionen + Fortschritt
        act_frame = ttk.Frame(root)
        act_frame.pack(side="top", fill="x", **pad)
        self.scan_btn = ttk.Button(act_frame, text="Scannen", command=self.start_scan)
        self.scan_btn.pack(side="left", padx=6)
        self.cancel_btn = ttk.Button(act_frame, text="Abbrechen",
                                     command=self.cancel, state="disabled")
        self.cancel_btn.pack(side="left")
        self.progress = ttk.Progressbar(act_frame, mode="determinate", maximum=1000)
        self.progress.pack(side="left", fill="x", expand=True, padx=10)

        self.status_var = tk.StringVar(value="Bereit.")
        ttk.Label(root, textvariable=self.status_var, anchor="w").pack(
            side="top", fill="x", padx=14)

        # Wiederherstellen: vor der Liste packen, damit es auch in kleinen
        # Fenstern sichtbar bleibt (die Liste bekommt nur den Rest).
        rec_frame = ttk.Frame(root)
        rec_frame.pack(side="bottom", fill="x", **pad)
        self.recover_all_btn = ttk.Button(rec_frame, text="Alle wiederherstellen",
                                          command=lambda: self.start_recover(False),
                                          state="disabled")
        self.recover_all_btn.pack(side="left", padx=6)
        self.recover_sel_btn = ttk.Button(rec_frame, text="Auswahl wiederherstellen",
                                          command=lambda: self.start_recover(True),
                                          state="disabled")
        self.recover_sel_btn.pack(side="left")
        self.count_var = tk.StringVar(value="")
        ttk.Label(rec_frame, textvariable=self.count_var).pack(side="right", padx=8)

        # Ergebnisliste
        res_frame = ttk.LabelFrame(root, text="Gefundene Dateien")
        res_frame.pack(side="top", fill="both", expand=True, **pad)
        self.tree = ttk.Treeview(res_frame, columns=COLUMNS, show="headings",
                                 selectmode="extended")
        for col, width, anchor, stretch in (
            ("typ", 180, "w", False),
            ("name", 320, "w", True),
            ("groesse", 90, "e", False),
            ("geaendert", 150, "w", False),
            ("zustand", 150, "w", False),
            ("quelle", 170, "w", False),
        ):
            self.tree.heading(col, text=COLUMN_TITLES[col],
                              command=lambda c=col: self._sort_by(c))
            self.tree.column(col, width=width, minwidth=60, anchor=anchor, stretch=stretch)
        vsb = ttk.Scrollbar(res_frame, orient="vertical", command=self.tree.yview)
        hsb = ttk.Scrollbar(res_frame, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        self.tree.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        hsb.grid(row=1, column=0, sticky="ew")
        res_frame.rowconfigure(0, weight=1)
        res_frame.columnconfigure(0, weight=1)

        # Tastatur: Enter löst Knöpfe aus, Strg+A wählt alles, Umschalt+Pfeil
        # erweitert die Auswahl; das Kontextmenü (Rechtsklick, Umschalt+F10,
        # Menütaste) bietet Sortieren und Wiederherstellen.
        for seq in ("<Return>", "<KP_Enter>"):
            root.bind_class("TButton", seq, lambda e: e.widget.invoke())
        self.tree.bind("<Control-a>", self._select_all)
        self.tree.bind("<Control-A>", self._select_all)
        self.tree.bind("<Shift-Up>", lambda e: self._extend_selection(-1))
        self.tree.bind("<Shift-Down>", lambda e: self._extend_selection(1))
        self.tree.bind("<FocusIn>", self._focus_first_row)
        self.menu = tk.Menu(root, tearoff=0)
        for col in COLUMNS:
            self.menu.add_command(label=f"Sortieren nach „{COLUMN_TITLES[col]}“",
                                  command=lambda c=col: self._sort_by(c))
        self.menu.add_separator()
        self.menu.add_command(label="Alle Zeilen auswählen", command=self._select_all)
        self.menu.add_command(label="Auswahl wiederherstellen",
                              command=lambda: self.start_recover(True))
        for seq in ("<Button-3>", "<Shift-F10>", "<App>"):
            try:
                self.tree.bind(seq, self._show_menu)
            except tk.TclError:
                pass

    # -- Laufwerke / Quelle ---------------------------------------------

    def refresh_drives(self) -> None:
        if self.busy:
            return
        self.source_box.configure(state="disabled")
        self.status_var.set("Suche Laufwerke …")

        def work():
            drives = list_drives()
            self.queue.put(("drives", drives))

        threading.Thread(target=work, daemon=True).start()

    def _apply_drives(self, drives: list[Drive]) -> None:
        # Vorhandene Image-Einträge behalten, Laufwerke neu setzen.
        image_entries = {k: v for k, v in self.sources.items() if k.startswith("Image: ")}
        self.sources = {}
        values = []
        for d in drives:
            label = f"{d.path}  –  {d.label}"
            self.sources[label] = d.path
            values.append(label)
        for label, path in image_entries.items():
            self.sources[label] = path
            values.append(label)
        self.source_box.configure(values=values,
                                  state="disabled" if self.busy else "readonly")
        if values and not self.source_var.get():
            self.source_var.set(values[0])
        if not self.busy:
            self.status_var.set(f"{len(drives)} Laufwerk(e) erkannt."
                                if drives else
                                "Keine Laufwerke erkannt – bitte eine Image-Datei wählen.")

    def choose_image(self) -> None:
        if self.busy:
            return
        path = filedialog.askopenfilename(
            title="Image-Datei wählen",
            filetypes=[("Disk-Images", "*.dd *.img *.raw *.bin *.001"),
                       ("Alle Dateien", "*.*")])
        if not path:
            return
        label = f"Image: {path}"                  # voller Pfad: gleiche Namen bleiben unterscheidbar
        self.sources[label] = path
        values = list(self.source_box["values"])
        if label not in values:
            values.append(label)
        self.source_box.configure(values=values)
        self.source_var.set(label)

    def choose_output(self) -> None:
        path = filedialog.askdirectory(title="Ausgabeordner wählen")
        if path:
            self.out_var.set(path)

    # -- Scan ------------------------------------------------------------

    def start_scan(self) -> None:
        if self.busy:
            return
        label = self.source_var.get()
        source_path = self.sources.get(label)
        if not source_path:
            messagebox.showwarning("Keine Quelle", "Bitte zuerst ein Laufwerk oder Image wählen.")
            return
        if not (self.opt_ntfs.get() or self.opt_fat.get() or self.opt_carve.get()
                or self.opt_usn.get()):
            messagebox.showwarning("Keine Methode", "Bitte mindestens ein Verfahren aktivieren.")
            return

        self.findings = []
        self.view = []
        self.tree.delete(*self.tree.get_children())
        self.count_var.set("")
        self._sort_col = None
        self._update_headings()
        self.cancel_flag.clear()
        self._progress = None
        sector = SECTOR_CHOICES.get(self.sector_var.get())
        self.scan_source = (source_path, sector)
        self._set_busy(True)
        self.progress.configure(value=0)
        self.status_var.set("Scan läuft …")

        options = ScanOptions(
            use_ntfs=self.opt_ntfs.get(),
            use_fat=self.opt_fat.get(),
            use_carve=self.opt_carve.get(),
            deleted_only=not self.opt_all.get(),
            recover_partial=self.opt_partial.get(),
            validate=self.opt_validate.get(),
            ntfs_orphan_scan=self.opt_orphan.get(),
            reconstruct_partitions=self.opt_reconstruct.get(),
            use_usn=self.opt_usn.get(),
            carve_free_only=self.opt_free.get(),
        )
        self._streamed = options.use_carve or options.ntfs_orphan_scan \
            or options.reconstruct_partitions

        def work():
            pending: list = []
            last_flush = [time.monotonic()]

            def on_finding(f) -> None:
                pending.append(f)
                now = time.monotonic()
                if len(pending) >= 500 or now - last_flush[0] >= BATCH_SECONDS:
                    self.queue.put(("findings", pending[:]))
                    pending.clear()
                    last_flush[0] = now

            def on_progress(phase: str, frac: float, _count: int) -> None:
                self._progress = (phase, frac)

            try:
                # Groesse und Sektorgroesse fragt ByteSource selbst ab; die Werte
                # aus der Laufwerksliste (WMI) sind dafuer zu ungenau.
                with ByteSource(source_path, sector_size=sector) as src:
                    scanner = Scanner(src, options)
                    scanner.scan(progress_cb=on_progress,
                                 should_cancel=self.cancel_flag.is_set,
                                 on_finding=on_finding)
                    if pending:
                        self.queue.put(("findings", pending[:]))
                        pending.clear()
                    stats = {"size": src.size, "scanned": src.scanned_until,
                             "unreadable": src.unreadable_sectors,
                             "sector": src.sector_size}
                    warnings = list(scanner.warnings)
                self.queue.put(("scan_done", self.cancel_flag.is_set(), stats, warnings))
            except PermissionError:
                self.queue.put(("error",
                                "Zugriff verweigert. Bitte das Programm als Administrator "
                                "starten (Rechtsklick → Als Administrator ausführen)."))
            except FileNotFoundError:
                self.queue.put(("error", f"Quelle nicht gefunden:\n{source_path}"))
            except Exception as exc:
                self.queue.put(("error", f"Unerwarteter Fehler:\n{exc}"))

        self.worker = threading.Thread(target=work, daemon=True)
        self.worker.start()

    def cancel(self) -> None:
        if self.busy:
            self.cancel_flag.set()
            self.status_var.set("Abbruch angefordert …")

    # -- Beenden ---------------------------------------------------------

    def close(self) -> None:
        """Fenster schließen; ein laufender Scan oder eine Wiederherstellung wird
        vorher geordnet abgebrochen, damit keine halbe Datei und kein
        unvollständiges Protokoll zurückbleibt."""
        if self._closing:
            return
        if not self.busy:
            self.root.destroy()
            return
        if not messagebox.askyesno(
                "Beenden",
                "Es läuft noch ein Scan oder eine Wiederherstellung.\n"
                "Abbrechen und das Programm beenden?"):
            return
        self._closing = True
        # Auf einen Lesezugriff, der an einer defekten Stelle hängt, nicht
        # endlos warten.
        self._close_deadline = time.monotonic() + 10.0
        self.cancel_flag.set()
        self.status_var.set("Wird beendet …")

    def _on_destroy(self, event) -> None:
        if event.widget is self.root and self._poll_id is not None:
            try:
                self.root.after_cancel(self._poll_id)
            except tk.TclError:
                pass
            self._poll_id = None

    # -- Wiederherstellen ------------------------------------------------

    def start_recover(self, selection_only: bool) -> None:
        if self.busy or not self.findings or self.scan_source is None:
            return
        out_dir = self.out_var.get().strip()
        if not out_dir:
            messagebox.showwarning("Kein Ausgabeordner", "Bitte einen Ausgabeordner wählen.")
            return
        source_path, sector = self.scan_source
        reason = output_on_source(source_path, out_dir)
        if reason:
            messagebox.showerror(
                "Ausgabeordner auf der Quelle",
                f"{reason}\n\nDas Schreiben würde gelöschte Daten überschreiben, die "
                "noch gerettet werden sollen. Bitte einen Ordner auf einem anderen "
                "Datenträger wählen, z. B. auf einer USB-Festplatte.")
            return

        if selection_only:
            targets = [self.findings[int(i)] for i in self.tree.selection()
                       if i.isdigit() and int(i) < len(self.findings)]
            if not targets:
                messagebox.showinfo("Keine Auswahl", "Bitte Zeilen in der Liste markieren.")
                return
        else:
            targets = list(self.findings)

        self.cancel_flag.clear()
        self._recover_progress = None
        self._set_busy(True)
        self.progress.configure(value=0)
        self.status_var.set(f"Stelle {len(targets)} Datei(en) wieder her …")

        def work():
            def on_progress(done: int, total: int, name: str) -> None:
                self._recover_progress = (done, total, name)
            try:
                with ByteSource(source_path, sector_size=sector) as src:
                    ok, skipped, errors = scanner_mod.recover(
                        src, targets, out_dir, progress_cb=on_progress,
                        should_cancel=self.cancel_flag.is_set)
                self.queue.put(("recover_done", ok, skipped, errors, out_dir,
                                self.cancel_flag.is_set(), selection_only))
            except Exception as exc:
                self.queue.put(("error", f"Fehler beim Wiederherstellen:\n{exc}"))

        self.worker = threading.Thread(target=work, daemon=True)
        self.worker.start()

    # -- Queue-Verarbeitung ---------------------------------------------

    def _poll_queue(self) -> None:
        self._poll_id = None
        if self._closing:
            # Nachrichten verwerfen (keine Dialoge mehr), bis der Thread fertig ist.
            try:
                while True:
                    self.queue.get_nowait()
            except queue.Empty:
                pass
            worker_done = self.worker is None or not self.worker.is_alive()
            if worker_done or time.monotonic() > self._close_deadline:
                self.root.destroy()
                return
            self._poll_id = self.root.after(50, self._poll_queue)
            return
        deadline = time.monotonic() + 0.04            # Zeitbudget je Durchlauf
        try:
            while time.monotonic() < deadline:
                self._handle(self.queue.get_nowait())
        except queue.Empty:
            pass
        if self.busy and not self.cancel_flag.is_set():
            if self._recover_progress is not None:
                done, total, name = self._recover_progress
                self.progress.configure(value=int(done / max(1, total) * 1000))
                self.status_var.set(f"Wiederherstellen {done}/{total}: {name}")
            elif self._progress is not None:
                phase, frac = self._progress
                self.progress.configure(value=max(0, min(1000, int(frac * 1000))))
                self.status_var.set(f"{phase} … {frac * 100:.1f} %")
        self._poll_id = self.root.after(50, self._poll_queue)

    def _handle(self, msg: tuple) -> None:
        kind = msg[0]
        if kind == "drives":
            self._apply_drives(msg[1])
        elif kind == "findings":
            self._add_findings(msg[1])
        elif kind == "scan_done":
            _, cancelled, stats, warnings = msg
            self._scan_finished(cancelled, stats, warnings)
        elif kind == "error":
            self._set_busy(False)
            self.progress.configure(value=0)
            self.status_var.set("Fehler.")
            messagebox.showerror("Fehler", msg[1])
        elif kind == "recover_done":
            _, ok, skipped, errors, out_dir, cancelled, selection_only = msg
            self._recover_progress = None
            self._set_busy(False)
            self.progress.configure(value=0 if cancelled else 1000)
            head = "Abgebrochen" if cancelled else "Fertig"
            status = f"{head}: {ok} Datei(en) wiederhergestellt."
            if skipped:
                status += f" {skipped} bereits vorhanden."
            self.status_var.set(status)
            text = f"{ok} Datei(en) wurden nach\n{out_dir}\ngeschrieben."
            if skipped:
                text += f"\n{skipped} waren bereits vorhanden und wurden übersprungen."
            if cancelled:
                button = "Auswahl wiederherstellen" if selection_only else "Alle wiederherstellen"
                extra = " mit derselben Auswahl" if selection_only else ""
                text += (f"\n\nAbgebrochen. Ein erneuter Klick auf „{button}“{extra} setzt "
                         "fort, ohne neu zu scannen; schon gerettete Dateien werden "
                         "übersprungen.")
            if errors:
                text += f"\n\n{len(errors)} Fehler (die ersten 5):\n" + "\n".join(errors[:5])
            messagebox.showinfo("Wiederherstellung", text)
            self._offer_open_folder(out_dir)

    # -- Liste -----------------------------------------------------------

    def _row_values(self, finding) -> tuple:
        return (finding.type_name, finding.path(), format_size(finding.size),
                finding.modified(), state_of(finding), finding.describe_source())

    def _add_findings(self, batch: list) -> None:
        start = len(self.findings)
        self.findings.extend(batch)
        shown = min(len(self.view), MAX_ROWS)
        for index in range(start, len(self.findings)):
            self.view.append(index)
            if shown < MAX_ROWS:
                finding = self.findings[index]
                self.tree.insert("", "end", iid=str(index), values=self._row_values(finding))
                shown += 1
        self._update_overflow()
        self.count_var.set(f"{len(self.findings)} Fund(e)")

    def _update_overflow(self) -> None:
        hidden = len(self.view) - MAX_ROWS
        if hidden > 0:
            text = (f"{hidden} weitere Funde ausgeblendet – „Alle wiederherstellen“ "
                    "rettet auch diese")
            values = ("…", text, "", "", "", "")
            if self.tree.exists("overflow"):
                self.tree.item("overflow", values=values)
                self.tree.move("overflow", "", "end")
            else:
                self.tree.insert("", "end", iid="overflow", values=values)
        elif self.tree.exists("overflow"):
            self.tree.delete("overflow")

    def _rebuild_tree(self) -> None:
        """Baut die Anzeige in der Reihenfolge von ``self.view`` neu auf.

        Löschen und neu einfügen ist linear; einzelnes Verschieben (``move``)
        wäre bei vielen Zeilen quadratisch langsam.
        """
        selected = set(self.tree.selection())
        focus = self.tree.focus()
        self.tree.delete(*self.tree.get_children())
        for index in self.view[:MAX_ROWS]:
            self.tree.insert("", "end", iid=str(index),
                             values=self._row_values(self.findings[index]))
        self._update_overflow()
        keep = [iid for iid in selected if self.tree.exists(iid)]
        if keep:
            self.tree.selection_set(keep)
        if focus and self.tree.exists(focus):
            self.tree.focus(focus)

    def _sort_by(self, col: str) -> None:
        """Sortiert alle Funde nach der Spalte; erster Klick aufsteigend."""
        if self._sort_col == col:
            self._sort_reverse = not self._sort_reverse
        else:
            self._sort_col = col
            self._sort_reverse = False
        self._apply_sort()

    def _apply_sort(self) -> None:
        if self._sort_col is None:
            return
        self.view = order_indices(self.findings, self._sort_col, self._sort_reverse)
        self._rebuild_tree()
        self._update_headings()

    def _update_headings(self) -> None:
        for c, title in COLUMN_TITLES.items():
            arrow = ""
            if c == self._sort_col:
                arrow = " ▼" if self._sort_reverse else " ▲"
            self.tree.heading(c, text=title + arrow)

    def _select_all(self, _event=None):
        rows = [iid for iid in self.tree.get_children() if iid != "overflow"]
        if rows:
            self.tree.selection_set(rows)
        return "break"

    def _extend_selection(self, delta: int):
        rows = [iid for iid in self.tree.get_children() if iid != "overflow"]
        if not rows:
            return "break"
        current = self.tree.focus()
        pos = rows.index(current) if current in rows else 0
        target = rows[max(0, min(len(rows) - 1, pos + delta))]
        self.tree.selection_add(target)
        self.tree.focus(target)
        self.tree.see(target)
        return "break"

    def _focus_first_row(self, _event=None) -> None:
        if not self.tree.focus():
            rows = self.tree.get_children()
            if rows and rows[0] != "overflow":
                self.tree.focus(rows[0])
                if not self.tree.selection():
                    self.tree.selection_set(rows[0])

    def _show_menu(self, event=None):
        x = getattr(event, "x_root", 0) or self.tree.winfo_rootx() + 40
        y = getattr(event, "y_root", 0) or self.tree.winfo_rooty() + 40
        try:
            self.menu.tk_popup(x, y)
        finally:
            self.menu.grab_release()
        return "break"

    def _scan_finished(self, cancelled: bool, stats: dict, warnings: list) -> None:
        self._set_busy(False)
        self._apply_sort()                      # waehrend des Scans angehaengte Zeilen einsortieren
        self.progress.configure(value=0 if cancelled else 1000)
        prefix = "Abgebrochen" if cancelled else "Scan fertig"
        info = f"{prefix}. {len(self.findings)} Fund(e)."
        if stats and self._streamed and stats.get("size"):
            info += (f"  Durchsucht: {format_size(stats['scanned'])} von "
                     f"{format_size(stats['size'])}.")
        if stats and stats.get("unreadable"):
            info += f"  {stats['unreadable']} Sektoren nicht lesbar."
        self.status_var.set(info)
        if warnings:
            text = "\n\n".join(warnings[:8])
            if len(warnings) > 8:
                text += f"\n\n… und {len(warnings) - 8} weitere Hinweise."
            messagebox.showwarning("Hinweise zum Scan", text)
        if not self.findings and not cancelled:
            hint = "Es wurden keine wiederherstellbaren Dateien gefunden."
            if (stats and self._streamed and stats.get("size")
                    and stats["scanned"] < stats["size"] * 0.5):
                hint += ("\n\nEs wurde nur ein kleiner Teil des Datenträgers gelesen "
                         f"({format_size(stats['scanned'])} von {format_size(stats['size'])}). "
                         "Das deutet auf fehlende Administratorrechte oder ein "
                         "Zugriffsproblem hin.")
            messagebox.showinfo("Kein Fund", hint)

    # -- Hilfen ----------------------------------------------------------

    def _set_busy(self, busy: bool) -> None:
        self.busy = busy
        normal = "disabled" if busy else "normal"
        self.scan_btn.configure(state=normal)
        self.refresh_btn.configure(state=normal)
        self.image_btn.configure(state=normal)
        self.out_btn.configure(state=normal)
        self.out_entry.configure(state=normal)
        self.source_box.configure(state="disabled" if busy else "readonly")
        self.sector_box.configure(state="disabled" if busy else "readonly")
        for widget in self.option_widgets:
            widget.configure(state=normal)
        self.cancel_btn.configure(state="normal" if busy else "disabled")
        # Wiederherstellen-Knöpfe während eines Laufs sperren, danach wieder
        # freigeben, solange Funde vorliegen. So muss man nach einem
        # abgebrochenen Lauf nicht erneut scannen.
        recover_state = "disabled" if (busy or not self.findings) else "normal"
        self.recover_all_btn.configure(state=recover_state)
        self.recover_sel_btn.configure(state=recover_state)

    def _offer_open_folder(self, path: str) -> None:
        if messagebox.askyesno("Ordner öffnen", "Ausgabeordner jetzt öffnen?"):
            open_folder(path)


def open_folder(path: str) -> None:
    try:
        if sys.platform.startswith("win"):
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", path])
        else:
            subprocess.Popen(["xdg-open", path])
    except Exception:
        pass


def run() -> None:
    root = tk.Tk()
    try:
        ttk.Style().theme_use("clam")
    except tk.TclError:
        pass
    RecoveryApp(root)
    root.mainloop()


if __name__ == "__main__":
    run()
