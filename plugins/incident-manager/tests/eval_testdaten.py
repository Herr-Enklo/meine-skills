"""Erzeugt die Eingabedatei evals/files/lagebild-notepad.txt für den Testkatalog.

Lässt tests/lagebild-test.ps1 mit festen Zeiten laufen (pwsh nötig) und ersetzt im Bericht,
was auf Linux anders aussieht als auf Windows: Temp-Pfade, Container-Uhr, Benutzer, PowerShell-
Version, Prozessliste und PATH.

Aufruf: python plugins/incident-manager/tests/eval_testdaten.py
"""

import os
import re
import subprocess
import tempfile
from pathlib import Path

TESTS = Path(__file__).resolve().parent
ZIEL = TESTS.parent / "skills" / "incident" / "evals" / "files" / "lagebild-notepad.txt"
JETZT = "2026-09-29 09:38"

PROZESSE = """== Prozesse: meiste CPU-Zeit seit Start und meister Arbeitsspeicher

Name         Id CPU_s RAM_MB
----         -- ----- ------
MsMpEng    4120  5310    412
OUTLOOK   10244  1822    690
msedge     8812  1410    355
Teams     11020  1203    520
explorer   6004   640    180
SearchHost 7720    95    160
svchost    1432    88     60
dwm        1300    80    120
EXCEL     12880    44    210
notepad++ 14320    12     85


Name         Id RAM_MB
----         -- ------
OUTLOOK   10244    690
Teams     11020    520
MsMpEng    4120    412
msedge     8812    355
EXCEL     12880    210
explorer   6004    180
SearchHost 7720    160
dwm        1300    120
notepad++ 14320     85
svchost    1432     60

Momentaufnahme zu Beginn des Laufs; spätere Abschnitte können andere Prozess-IDs zeigen.

"""

PFAD = """== Umgebung: PATH (Rechner, dann Benutzer)
Machine        C:\\Windows\\system32
Machine        C:\\Windows
Machine        C:\\Windows\\System32\\Wbem
Machine        C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\
Machine        C:\\Program Files\\Empirum\\Agent
User           C:\\Users\\mmuster\\AppData\\Local\\Microsoft\\WindowsApps

"""


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        roh = Path(tmp) / "roh.txt"
        umgebung = dict(os.environ, LAGEBILD_TEST_JETZT=JETZT, LAGEBILD_TEST_BERICHT=str(roh))
        subprocess.run(["pwsh", "-NoProfile", "-File", str(TESTS / "lagebild-test.ps1")], env=umgebung, check=True, capture_output=True)
        text = roh.read_text(encoding="utf-8-sig")

    basis = re.search(r"(/tmp/lagebild-[0-9a-f]+)", text).group(1)

    def windows_pfad(treffer: re.Match) -> str:
        pfad = treffer.group(0)
        for alt, neu in ((basis + "/Notepad++", "C:\\Program Files\\Notepad++"),
                         (basis + "/ProgramData", "C:\\ProgramData"),
                         (basis + "/windows", "C:\\Windows")):
            if pfad.startswith(alt):
                pfad = neu + pfad[len(alt):]
        return pfad.replace("/", "\\")

    text = re.sub(re.escape(basis) + r"[^\s(]*(?: Team/[^\s(]*)?", windows_pfad, text)
    text = re.sub(r"(?m)^(\S+)/(\S+\.dll)", lambda m: (m.group(1) + "/" + m.group(2)).replace("/", "\\"), text)
    text = re.sub(r"Erstellt:\s+.*", "Erstellt:         2026-09-29 09:39:12 (UTC+02:00, W. Europe Standard Time)", text)
    text = re.sub(r"Ereigniszeitraum: seit .*", "Ereigniszeitraum: seit 2026-09-27 09:39:12", text)
    text = text.replace("Benutzer:         \\, Administratorrechte", "Benutzer:         FIRMA\\mmuster, Administratorrechte")
    text = re.sub(r"PowerShell:\s+\S+, ", "PowerShell:       5.1.22621.4111, ", text)
    text = re.sub(r"\(geändert 2026-09-29 \d\d:\d\d:\d\d\)", "(geändert 2026-09-29 04:08:31)", text, count=2)
    text = re.sub(r"== Prozesse:.*?(?=== Automatisch)", lambda m: PROZESSE, text, flags=re.S)
    text = re.sub(r"== Umgebung: PATH.*?(?=== Installiert)", lambda m: PFAD, text, flags=re.S)
    text = re.sub(r"== Ende, Dauer \d+ s", "== Ende, Dauer 41 s", text)
    # Windows PowerShell 5.1 zeigt ganze Zahlen ohne Nachkommastellen; Textdateien haben keine Dateiversion
    text = re.sub(r"C:\s+256\.00\s+5\.00\s+2", "C:             256      5           2", text)
    text = re.sub(r"(?m)^notepad\+\+\.exe\s+(\S+ \S+) Valid", lambda m: f"notepad++.exe                   8.8.5.0 {m.group(1)} Valid", text)
    text = re.sub(r"(?m)^SciLexer\.dll\s+(\S+ \S+) Valid", lambda m: f"SciLexer.dll                    8.8.4.0 {m.group(1)} Valid", text)
    text = re.sub(r"(?m)^(plugins\\NppPlugin\\NppPlugin\.dll)\s+(\S+ \S+) NotSigned", lambda m: f"{m.group(1)} 1.0.0.0 {m.group(2)} NotSigned", text)
    if "/tmp" in text or "Etc/UTC" in text:
        raise SystemExit("Linux-Reste im Bericht, Ersetzungen prüfen")
    ZIEL.write_text(text, encoding="utf-8")
    print(f"geschrieben: {ZIEL}")


if __name__ == "__main__":
    main()
