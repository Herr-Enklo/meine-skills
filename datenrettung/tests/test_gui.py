"""Rauchtest der Oberflaeche (braucht tkinter und eine Anzeige).

Unter Linux ohne Bildschirm z.B. mit ``xvfb-run python -m unittest
datenrettung.tests.test_gui``. Fehlt tkinter oder die Anzeige, werden die Tests
uebersprungen.
"""

from __future__ import annotations

import gc
import os
import sys
import tempfile
import time
import unittest
from unittest import mock

_HERE = os.path.dirname(os.path.abspath(__file__))
_PKG = os.path.dirname(_HERE)                 # .../datenrettung (fuer "recovery", "gui")
_ROOT = os.path.dirname(_PKG)
for p in (_PKG, _ROOT):
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    import tkinter as tk
    _root = tk.Tk()
    _root.withdraw()
    _root.destroy()
    HAVE_TK = True
except Exception:                               # kein tkinter oder keine Anzeige
    HAVE_TK = False

from datenrettung.tests.make_sample_image import build_carving_image  # noqa: E402


def _read(path: str) -> bytes:
    with open(path, "rb") as fh:
        return fh.read()


@unittest.skipUnless(HAVE_TK, "tkinter oder Anzeige nicht verfuegbar")
class GuiTests(unittest.TestCase):
    def setUp(self):
        # Fenster frueherer Tests haengen in Referenzzyklen. Raeumt die
        # Speicherbereinigung sie zufaellig im Scan- oder Wiederherstellungs-
        # Thread ab, ruft tkinter aus diesem Thread Tcl auf: jede Variable
        # wartet dann eine Sekunde auf die Hauptschleife, und Tcl bricht am
        # Ende ab. Deshalb vor und nach jedem Test im Hauptthread aufraeumen.
        gc.collect()
        self.addCleanup(gc.collect)
        from gui import app as app_mod
        self.app_mod = app_mod
        self.root = tk.Tk()
        self.root.withdraw()
        self.messages = []
        patches = [
            mock.patch.object(app_mod.messagebox, "showinfo",
                              lambda *a, **k: self.messages.append(("info",) + a)),
            mock.patch.object(app_mod.messagebox, "showwarning",
                              lambda *a, **k: self.messages.append(("warn",) + a)),
            mock.patch.object(app_mod.messagebox, "showerror",
                              lambda *a, **k: self.messages.append(("error",) + a)),
            mock.patch.object(app_mod.messagebox, "askyesno", lambda *a, **k: False),
            mock.patch.object(app_mod, "list_drives", lambda: []),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.destroyed = []
        real_destroy = self.root.destroy

        def destroy():
            self.destroyed.append(True)
            real_destroy()

        self.root.destroy = destroy
        self.app = app_mod.RecoveryApp(self.root)
        self.addCleanup(self._destroy_root)
        self.pump(lambda: self.app.status_var.get().startswith("Keine Laufwerke"))

    def _destroy_root(self):
        if not self.destroyed:
            self.root.destroy()

    def pump(self, until, timeout=30.0):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            self.root.update()
            if until():
                return
            if self.destroyed:
                break
            time.sleep(0.01)
        self.fail("Zeitueberschreitung in der Oberflaeche")

    def use_image(self, data: bytes) -> str:
        fd, path = tempfile.mkstemp(suffix=".img")
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        self.addCleanup(os.remove, path)
        label = f"Image: {path}"
        self.app.sources[label] = path
        self.app.source_var.set(label)
        return path

    def scan(self):
        self.app.start_scan()
        self.assertTrue(self.app.busy)
        # Waehrend des Laufs sind Quelle und Optionen gesperrt.
        self.assertEqual(str(self.app.source_box.cget("state")), "disabled")
        self.assertEqual(str(self.app.image_btn.cget("state")), "disabled")
        self.pump(lambda: not self.app.busy)

    def test_scan_sortieren_und_wiederherstellen(self):
        img, expected = build_carving_image()
        self.use_image(img)
        self.scan()
        rows = [iid for iid in self.app.tree.get_children() if iid != "overflow"]
        self.assertEqual(len(rows), len(expected))
        self.assertEqual(self.app.count_var.get(), f"{len(expected)} Fund(e)")

        # Erster Klick sortiert aufsteigend nach Groesse (numerisch).
        self.app._sort_by("groesse")
        sizes = [self.app.findings[int(i)].size for i in self.app.tree.get_children()]
        self.assertEqual(sizes, sorted(sizes))
        self.assertTrue(self.app.tree.heading("groesse")["text"].endswith("▲"))

        out = tempfile.mkdtemp()
        self.app.out_var.set(out)
        self.app.start_recover(selection_only=False)
        self.pump(lambda: not self.app.busy)
        written = [n for n in os.listdir(out) if not n.startswith(".")]
        self.assertEqual(len(written), len(expected))

    def test_wiederherstellung_liest_die_gescannte_quelle(self):
        img, expected = build_carving_image()
        self.use_image(img)
        self.scan()
        self.use_image(b"A" * len(img))              # Auswahl nach dem Scan geaendert
        out = tempfile.mkdtemp()
        self.app.out_var.set(out)
        self.app.start_recover(selection_only=False)
        self.pump(lambda: not self.app.busy)
        contents = sorted(_read(os.path.join(out, n))
                          for n in os.listdir(out) if not n.startswith("."))
        self.assertEqual(contents, sorted(e["data"] for e in expected))

    def test_abgebrochener_scan_meldet_keinen_fehlenden_fund(self):
        self.use_image(bytes(64 * 1024 * 1024))
        self.app.start_scan()
        self.app.cancel()
        self.pump(lambda: not self.app.busy)
        self.assertFalse(any(m[1] == "Kein Fund" for m in self.messages), self.messages)

    def test_nur_ueberlaufzeile_ausgewaehlt_startet_nichts(self):
        img, _ = build_carving_image()
        self.use_image(img)
        with mock.patch.object(self.app_mod, "MAX_ROWS", 1):
            self.scan()
            self.assertTrue(self.app.tree.exists("overflow"))
            self.assertIn("3 weitere Funde", self.app.tree.item("overflow")["values"][1])
            self.app.tree.selection_set(("overflow",))
        self.app.out_var.set(tempfile.mkdtemp())
        self.app.start_recover(selection_only=True)
        self.assertFalse(self.app.busy)
        self.assertTrue(any(m[1] == "Keine Auswahl" for m in self.messages))

    def test_schliessen_waehrend_des_scans_bricht_geordnet_ab(self):
        self.use_image(bytes(64 * 1024 * 1024))
        self.app.start_scan()
        # Abgelehnte Nachfrage: nichts passiert.
        self.app.close()
        self.assertFalse(self.app.cancel_flag.is_set())
        self.assertFalse(self.destroyed)
        # Bestätigt: erst abbrechen, dann schließen, ohne weitere Dialoge.
        shown = len(self.messages)
        with mock.patch.object(self.app_mod.messagebox, "askyesno", lambda *a, **k: True):
            self.app.close()
        self.assertTrue(self.app.cancel_flag.is_set())
        self.pump(lambda: bool(self.destroyed))
        self.assertFalse(self.app.worker.is_alive())
        self.assertEqual(self.messages[shown:], [])
        self.assertIsNone(self.app._poll_id)

    def test_schliessen_im_leerlauf(self):
        self.app.close()
        self.assertTrue(self.destroyed)
        self.assertIsNone(self.app._poll_id)


if __name__ == "__main__":
    unittest.main(verbosity=2)
