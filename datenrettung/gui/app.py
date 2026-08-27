"""Kleine tkinter-Oberflaeche: Laufwerk waehlen, scannen, wiederherstellen.

Der Aufbau ist bewusst schlicht:

1. Quelle waehlen (erkanntes Laufwerk aus der Liste oder eine Image-Datei).
2. Ausgabeordner waehlen (muss auf einem anderen Datentraeger liegen).
3. "Scannen" – der Scan laeuft in einem Hintergrund-Thread, damit die
   Oberflaeche bedienbar bleibt; Funde erscheinen live in der Liste.
4. "Wiederherstellen" – schreibt die gewaehlten Funde in den Ausgabeordner.

Die Engine liest die Quelle ausschliesslich. Geschrieben wird nur in den
Ausgabeordner.
"""

from __future__ import annotations

import os
import queue
import subprocess
import sys
import threading

import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from recovery import ByteSource, Scanner, ScanOptions
from recovery import scanner as scanner_mod
from recovery.drives import Drive, format_size, list_drives
from gui.sorting import order_iids

# Zur Sicherheit: so viele Zeilen zeigen wir hoechstens in der Liste an.
# Alle Funde bleiben intern erhalten und lassen sich per "Alle" wiederherstellen.
MAX_ROWS = 20000


class RecoveryApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Datenrettung – Windows/NTFS")
        self.root.geometry("860x600")
        self.root.minsize(720, 520)

        self.queue: queue.Queue = queue.Queue()
        self.worker: threading.Thread | None = None
        self.cancel_flag = threading.Event()
        self.findings: list = []
        self.sources: dict[str, str] = {}       # Anzeigename -> Pfad/Geraet
        self.source_sizes: dict[str, int | None] = {}  # Anzeigename -> bekannte Groesse
        self.busy = False
        self._sort_state: dict[str, bool] = {}   # Spalte -> zuletzt absteigend?

        self._build_ui()
        self._poll_queue()
        self.refresh_drives()

    # -- Aufbau der Oberflaeche -----------------------------------------

    def _build_ui(self) -> None:
        pad = {"padx": 8, "pady": 4}

        banner = tk.Label(
            self.root,
            text=("Nur-Lesen-Modus: Die Quelle wird nie veraendert. "
                  "Ausgabeordner immer auf einem ANDEREN Datentraeger waehlen. "
                  "Zugriff auf ganze Laufwerke erfordert Administratorrechte."),
            bg="#fff3cd", fg="#664d03", anchor="w", justify="left",
            wraplength=830, padx=10, pady=6,
        )
        banner.pack(fill="x")

        # Quelle
        src_frame = ttk.LabelFrame(self.root, text="1. Quelle (Laufwerk oder Image)")
        src_frame.pack(fill="x", **pad)
        self.source_var = tk.StringVar()
        self.source_box = ttk.Combobox(src_frame, textvariable=self.source_var,
                                       state="readonly", width=60)
        self.source_box.grid(row=0, column=0, sticky="ew", padx=6, pady=6)
        ttk.Button(src_frame, text="Aktualisieren",
                   command=self.refresh_drives).grid(row=0, column=1, padx=4)
        ttk.Button(src_frame, text="Image-Datei…",
                   command=self.choose_image).grid(row=0, column=2, padx=4)
        src_frame.columnconfigure(0, weight=1)

        # Ausgabe
        out_frame = ttk.LabelFrame(self.root, text="2. Ausgabeordner (anderer Datentraeger!)")
        out_frame.pack(fill="x", **pad)
        self.out_var = tk.StringVar()
        ttk.Entry(out_frame, textvariable=self.out_var).grid(
            row=0, column=0, sticky="ew", padx=6, pady=6)
        ttk.Button(out_frame, text="Waehlen…",
                   command=self.choose_output).grid(row=0, column=1, padx=4)
        out_frame.columnconfigure(0, weight=1)

        # Optionen
        opt_frame = ttk.LabelFrame(self.root, text="3. Optionen")
        opt_frame.pack(fill="x", **pad)
        self.opt_ntfs = tk.BooleanVar(value=True)
        self.opt_carve = tk.BooleanVar(value=True)
        self.opt_all = tk.BooleanVar(value=False)
        self.opt_orphan = tk.BooleanVar(value=False)
        self.opt_partial = tk.BooleanVar(value=True)
        self.opt_validate = tk.BooleanVar(value=True)
        self.opt_4kn = tk.BooleanVar(value=False)
        self.opt_reconstruct = tk.BooleanVar(value=False)
        ttk.Checkbutton(opt_frame, text="NTFS: geloeschte Dateien (mit Namen)",
                        variable=self.opt_ntfs).grid(row=0, column=0, sticky="w", padx=6, pady=4)
        ttk.Checkbutton(opt_frame, text="File Carving (nach Signatur)",
                        variable=self.opt_carve).grid(row=0, column=1, sticky="w", padx=6, pady=4)
        ttk.Checkbutton(opt_frame, text="NTFS: auch vorhandene Dateien listen",
                        variable=self.opt_all).grid(row=0, column=2, sticky="w", padx=6, pady=4)
        ttk.Checkbutton(opt_frame, text="Ganzen Datentraeger nach MFT absuchen (dauert laenger)",
                        variable=self.opt_orphan).grid(row=1, column=0, columnspan=2,
                                                       sticky="w", padx=6, pady=4)
        ttk.Checkbutton(opt_frame, text="Unvollstaendige Dateien mitnehmen",
                        variable=self.opt_partial).grid(row=1, column=2, sticky="w", padx=6, pady=4)
        ttk.Checkbutton(opt_frame, text="4K-Sektoren (4Kn)",
                        variable=self.opt_4kn).grid(row=0, column=3, sticky="w", padx=6, pady=4)
        ttk.Checkbutton(opt_frame, text="Partitionstabelle rekonstruieren (Boot-Sektor-Suche)",
                        variable=self.opt_reconstruct).grid(row=2, column=0, columnspan=2,
                                                            sticky="w", padx=6, pady=4)
        ttk.Checkbutton(opt_frame, text="Treffer validieren",
                        variable=self.opt_validate).grid(row=2, column=2, sticky="w",
                                                         padx=6, pady=4)

        # Aktionen + Fortschritt
        act_frame = ttk.Frame(self.root)
        act_frame.pack(fill="x", **pad)
        self.scan_btn = ttk.Button(act_frame, text="Scannen", command=self.start_scan)
        self.scan_btn.pack(side="left", padx=6)
        self.cancel_btn = ttk.Button(act_frame, text="Abbrechen",
                                     command=self.cancel, state="disabled")
        self.cancel_btn.pack(side="left")
        self.progress = ttk.Progressbar(act_frame, mode="determinate", maximum=1000)
        self.progress.pack(side="left", fill="x", expand=True, padx=10)

        self.status_var = tk.StringVar(value="Bereit.")
        ttk.Label(self.root, textvariable=self.status_var, anchor="w").pack(
            fill="x", padx=14)

        # Ergebnisliste
        res_frame = ttk.LabelFrame(self.root, text="Gefundene Dateien")
        res_frame.pack(fill="both", expand=True, **pad)
        columns = ("typ", "name", "groesse", "geaendert", "quelle")
        self.tree = ttk.Treeview(res_frame, columns=columns, show="headings",
                                 selectmode="extended")
        self._col_titles = {"typ": "Typ", "name": "Name/Pfad",
                            "groesse": "Groesse", "geaendert": "Geaendert",
                            "quelle": "Herkunft"}
        for col, width, anchor in (
            ("typ", 170, "w"),
            ("name", 300, "w"),
            ("groesse", 90, "e"),
            ("geaendert", 140, "w"),
            ("quelle", 150, "w"),
        ):
            self.tree.heading(col, text=self._col_titles[col],
                              command=lambda c=col: self._sort_by(c))
            self.tree.column(col, width=width, anchor=anchor)
        vsb = ttk.Scrollbar(res_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        # Wiederherstellen
        rec_frame = ttk.Frame(self.root)
        rec_frame.pack(fill="x", **pad)
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

    # -- Laufwerke / Quelle ---------------------------------------------

    def refresh_drives(self) -> None:
        self.source_box.configure(state="disabled")
        self.status_var.set("Suche Laufwerke…")

        def work():
            drives = list_drives()
            self.queue.put(("drives", drives))

        threading.Thread(target=work, daemon=True).start()

    def _apply_drives(self, drives: list[Drive]) -> None:
        # Vorhandene Image-Eintraege behalten, Laufwerke neu setzen.
        image_entries = {k: v for k, v in self.sources.items() if k.startswith("Image: ")}
        self.sources = {}
        self.source_sizes = {}
        values = []
        for d in drives:
            label = f"{d.path}  –  {d.label}"
            self.sources[label] = d.path
            self.source_sizes[label] = d.size
            values.append(label)
        for label, path in image_entries.items():
            self.sources[label] = path
            self.source_sizes[label] = None
            values.append(label)
        self.source_box.configure(values=values, state="readonly")
        if values and not self.source_var.get():
            self.source_var.set(values[0])
        self.status_var.set(f"{len(drives)} Laufwerk(e) erkannt."
                            if drives else
                            "Keine Laufwerke erkannt – bitte Image-Datei waehlen.")

    def choose_image(self) -> None:
        path = filedialog.askopenfilename(
            title="Image-Datei waehlen",
            filetypes=[("Disk-Images", "*.dd *.img *.raw *.bin *.001"),
                       ("Alle Dateien", "*.*")])
        if not path:
            return
        label = f"Image: {os.path.basename(path)}"
        self.sources[label] = path
        self.source_sizes[label] = None
        values = list(self.source_box["values"])
        if label not in values:
            values.append(label)
        self.source_box.configure(values=values)
        self.source_var.set(label)

    def choose_output(self) -> None:
        path = filedialog.askdirectory(title="Ausgabeordner waehlen")
        if path:
            self.out_var.set(path)

    # -- Scan ------------------------------------------------------------

    def start_scan(self) -> None:
        if self.busy:
            return
        label = self.source_var.get()
        source_path = self.sources.get(label)
        if not source_path:
            messagebox.showwarning("Keine Quelle", "Bitte zuerst ein Laufwerk oder Image waehlen.")
            return
        if not (self.opt_ntfs.get() or self.opt_carve.get()):
            messagebox.showwarning("Keine Methode", "Bitte mindestens NTFS oder Carving aktivieren.")
            return

        self.findings = []
        self.tree.delete(*self.tree.get_children())
        self.count_var.set("")
        # Sortier-Pfeile zuruecksetzen.
        self._sort_state.clear()
        for c, title in self._col_titles.items():
            self.tree.heading(c, text=title)
        self.cancel_flag.clear()
        self._set_busy(True)
        self.progress.configure(value=0)

        options = ScanOptions(
            use_ntfs=self.opt_ntfs.get(),
            use_carve=self.opt_carve.get(),
            deleted_only=not self.opt_all.get(),
            recover_partial=self.opt_partial.get(),
            validate=self.opt_validate.get(),
            ntfs_orphan_scan=self.opt_orphan.get(),
            reconstruct_partitions=self.opt_reconstruct.get(),
        )
        known_size = self.source_sizes.get(label)
        sector = 4096 if self.opt_4kn.get() else 512

        def work():
            try:
                with ByteSource(source_path, size=known_size, sector_size=sector) as src:
                    scanner = Scanner(src, options)
                    scanner.scan(
                        progress_cb=lambda phase, frac, count: self.queue.put(
                            ("progress", phase, frac, count)),
                        should_cancel=self.cancel_flag.is_set,
                        on_finding=lambda f: self.queue.put(("finding", f)),
                    )
                    stats = {"size": src.size, "read": src.bytes_read,
                             "bad": src.bad_sectors}
                if self.cancel_flag.is_set():
                    self.queue.put(("cancelled", stats))
                else:
                    self.queue.put(("scan_done", stats))
            except PermissionError:
                self.queue.put(("error",
                    "Zugriff verweigert. Bitte das Programm als Administrator starten "
                    "(Rechtsklick → Als Administrator ausfuehren)."))
            except FileNotFoundError:
                self.queue.put(("error", f"Quelle nicht gefunden:\n{source_path}"))
            except Exception as exc:
                self.queue.put(("error", f"Unerwarteter Fehler:\n{exc}"))

        self.worker = threading.Thread(target=work, daemon=True)
        self.worker.start()

    def cancel(self) -> None:
        self.cancel_flag.set()
        self.status_var.set("Abbruch angefordert…")

    # -- Wiederherstellen ------------------------------------------------

    def start_recover(self, selection_only: bool) -> None:
        if self.busy or not self.findings:
            return
        out_dir = self.out_var.get().strip()
        if not out_dir:
            messagebox.showwarning("Kein Ausgabeordner", "Bitte einen Ausgabeordner waehlen.")
            return

        if selection_only:
            iids = self.tree.selection()
            if not iids:
                messagebox.showinfo("Keine Auswahl", "Bitte Zeilen in der Liste markieren.")
                return
            targets = [self.findings[int(i)] for i in iids if i.isdigit()
                       and int(i) < len(self.findings)]
        else:
            targets = list(self.findings)

        source_path = self.sources.get(self.source_var.get())
        if not source_path:
            return

        self.cancel_flag.clear()
        self._set_busy(True)
        self.progress.configure(value=0)
        self.status_var.set(f"Stelle {len(targets)} Datei(en) wieder her…")

        def work():
            try:
                with ByteSource(source_path) as src:
                    ok, skipped, errors = scanner_mod.recover(
                        src, targets, out_dir,
                        progress_cb=lambda done, total, name: self.queue.put(
                            ("recover_progress", done, total, name)),
                        should_cancel=self.cancel_flag.is_set,
                    )
                cancelled = self.cancel_flag.is_set()
                self.queue.put(("recover_done", ok, skipped, errors, out_dir, cancelled))
            except Exception as exc:
                self.queue.put(("error", f"Fehler beim Wiederherstellen:\n{exc}"))

        self.worker = threading.Thread(target=work, daemon=True)
        self.worker.start()

    # -- Queue-Verarbeitung ---------------------------------------------

    def _poll_queue(self) -> None:
        try:
            for _ in range(500):  # pro Durchlauf begrenzt viele Nachrichten
                msg = self.queue.get_nowait()
                self._handle(msg)
        except queue.Empty:
            pass
        self.root.after(60, self._poll_queue)

    def _handle(self, msg: tuple) -> None:
        kind = msg[0]
        if kind == "drives":
            self._apply_drives(msg[1])
        elif kind == "progress":
            _, phase, frac, count = msg
            self.progress.configure(value=max(0, min(1000, int(frac * 1000))))
            self.status_var.set(f"{phase} … {frac * 100:.1f} %  –  {count} Funde")
        elif kind == "finding":
            self._add_finding(msg[1])
        elif kind == "scan_done":
            self._scan_finished(cancelled=False, stats=msg[1] if len(msg) > 1 else None)
        elif kind == "cancelled":
            self._scan_finished(cancelled=True, stats=msg[1] if len(msg) > 1 else None)
        elif kind == "error":
            self._set_busy(False)
            self.progress.configure(value=0)
            self.status_var.set("Fehler.")
            messagebox.showerror("Fehler", msg[1])
        elif kind == "recover_progress":
            _, done, total, name = msg
            self.progress.configure(value=int(done / max(1, total) * 1000))
            self.status_var.set(f"Wiederherstellen {done}/{total}: {name}")
        elif kind == "recover_done":
            _, ok, skipped, errors, out_dir, cancelled = msg
            self._set_busy(False)
            self.progress.configure(value=0 if cancelled else 1000)
            head = "Abgebrochen" if cancelled else "Fertig"
            status = f"{head}: {ok} Datei(en) wiederhergestellt."
            if skipped:
                status += f" {skipped} bereits vorhanden."
            self.status_var.set(status)
            text = f"{ok} Datei(en) wurden nach\n{out_dir}\ngeschrieben."
            if skipped:
                text += f"\n{skipped} bereits vorhanden, uebersprungen."
            if cancelled:
                text += ("\n\nAbgebrochen. Ein erneuter Klick auf "
                         "„Alle wiederherstellen“ setzt fort, ohne neu zu scannen.")
            if errors:
                text += f"\n\n{len(errors)} Fehler (erste 5):\n" + "\n".join(errors[:5])
            messagebox.showinfo("Wiederherstellung", text)
            self._offer_open_folder(out_dir)

    def _add_finding(self, finding) -> None:
        index = len(self.findings)
        self.findings.append(finding)
        if index < MAX_ROWS:
            self.tree.insert(
                "", "end", iid=str(index),
                values=(finding.type_name, finding.name, format_size(finding.size),
                        finding.modified(), finding.describe_source()))
        elif index == MAX_ROWS:
            self.tree.insert("", "end", iid="overflow",
                             values=("…", "weitere Funde ausgeblendet", "", "", ""))
        self.count_var.set(f"{len(self.findings)} Fund(e)")

    def _sort_by(self, col: str) -> None:
        """Sortiert die Trefferliste nach der angeklickten Spalte.

        Sortiert wird nach den echten Fund-Daten, nicht nach dem angezeigten
        Text – so ordnet „Groesse" numerisch statt alphabetisch. Die Zeilen-IDs
        bleiben erhalten (nur die Anzeige wird umgeordnet), damit die Auswahl
        weiterhin auf die richtigen Funde zeigt.
        """
        reverse = not self._sort_state.get(col, False)
        rows = order_iids(self.findings, self.tree.get_children(""), col, reverse)
        for pos, iid in enumerate(rows):
            self.tree.move(iid, "", pos)
        # Die Ueberlauf-Zeile bleibt immer unten.
        if self.tree.exists("overflow"):
            self.tree.move("overflow", "", "end")

        self._sort_state[col] = reverse
        for c, title in self._col_titles.items():
            arrow = (" ▼" if reverse else " ▲") if c == col else ""
            self.tree.heading(c, text=title + arrow)

    def _scan_finished(self, cancelled: bool, stats: dict | None = None) -> None:
        self._set_busy(False)
        self.progress.configure(value=1000 if not cancelled else 0)
        prefix = "Abgebrochen" if cancelled else "Scan fertig"
        info = f"{prefix}. {len(self.findings)} Fund(e)."
        if stats:
            info += (f"  Gelesen: {format_size(stats['read'])} von "
                     f"{format_size(stats['size'])}, {stats['bad']} defekte Sektoren.")
        self.status_var.set(info)
        has = bool(self.findings)
        self.recover_all_btn.configure(state="normal" if has else "disabled")
        self.recover_sel_btn.configure(state="normal" if has else "disabled")
        if not has:
            hint = ("Es wurden keine wiederherstellbaren Dateien gefunden.")
            if stats and stats["size"] and stats["read"] < stats["size"] * 0.5:
                hint += ("\n\nEs wurde nur ein kleiner Teil des Datentraegers gelesen "
                         f"({format_size(stats['read'])} von {format_size(stats['size'])}). "
                         "Das deutet auf fehlende Administratorrechte oder ein "
                         "Zugriffsproblem hin.")
            messagebox.showinfo("Kein Fund", hint)

    # -- Hilfen ----------------------------------------------------------

    def _set_busy(self, busy: bool) -> None:
        self.busy = busy
        state = "disabled" if busy else "normal"
        self.scan_btn.configure(state=state)
        self.source_box.configure(state="disabled" if busy else "readonly")
        self.cancel_btn.configure(state="normal" if busy else "disabled")
        # Wiederherstellen-Knoepfe waehrend eines Laufs sperren, danach wieder
        # freigeben, solange Funde vorliegen. So muss man nach einem
        # abgebrochenen Lauf nicht erneut scannen.
        recover_state = "disabled" if (busy or not self.findings) else "normal"
        self.recover_all_btn.configure(state=recover_state)
        self.recover_sel_btn.configure(state=recover_state)

    def _offer_open_folder(self, path: str) -> None:
        if messagebox.askyesno("Ordner oeffnen", "Ausgabeordner jetzt oeffnen?"):
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
