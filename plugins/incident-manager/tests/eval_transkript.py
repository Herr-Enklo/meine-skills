"""Macht aus dem JSONL-Protokoll eines Subagent-Laufs ein Transkript für die Bewertung.

Schreibt transcript.md (Auftrag, alle Werkzeugaufrufe mit gekürzten Parametern, letzte
Antwort) und outputs/metrics.json (Werkzeugaufrufe je Werkzeug) in den Run-Ordner.

Aufruf: python eval_transkript.py <agent.jsonl> <run-ordner>
"""

import collections
import json
import sys
from pathlib import Path


def texte(inhalt):
    if isinstance(inhalt, str):
        return [inhalt]
    return [teil.get("text", "") for teil in inhalt or [] if isinstance(teil, dict) and teil.get("type") == "text"]


def main(protokoll: Path, run_ordner: Path) -> None:
    auftrag = None
    aufrufe = []
    letzte_antwort = ""
    zaehler = collections.Counter()

    for zeile in protokoll.read_text(encoding="utf-8").splitlines():
        eintrag = json.loads(zeile)
        nachricht = eintrag.get("message")
        if not isinstance(nachricht, dict):
            continue
        inhalt = nachricht.get("content")
        if eintrag.get("type") == "user" and auftrag is None and not eintrag.get("isMeta"):
            gefunden = "\n".join(texte(inhalt)).strip()
            if gefunden:
                auftrag = gefunden
        if eintrag.get("type") == "assistant":
            for teil in inhalt if isinstance(inhalt, list) else []:
                if teil.get("type") == "tool_use":
                    zaehler[teil.get("name", "?")] += 1
                    parameter = json.dumps(teil.get("input"), ensure_ascii=False)
                    if len(parameter) > 400:
                        parameter = parameter[:400] + " ..."
                    aufrufe.append(f"- `{teil.get('name')}` {parameter}")
            antwort = "\n".join(texte(inhalt)).strip()
            if antwort:
                letzte_antwort = antwort

    zeilen = ["# Transkript", "", "## Auftrag", "", auftrag or "(nicht gefunden)", "",
              f"## Werkzeugaufrufe ({sum(zaehler.values())})", ""]
    zeilen += aufrufe or ["(keine)"]
    zeilen += ["", "## Letzte Antwort des Laufs", "", letzte_antwort or "(leer)", ""]
    (run_ordner / "transcript.md").write_text("\n".join(zeilen), encoding="utf-8")

    ausgaben = run_ordner / "outputs"
    ausgaben.mkdir(parents=True, exist_ok=True)
    dateien = [p.name for p in ausgaben.iterdir() if p.is_file() and p.name != "metrics.json"]
    metriken = {
        "tool_calls": dict(zaehler),
        "total_tool_calls": sum(zaehler.values()),
        "files_created": dateien,
        "output_chars": sum((ausgaben / d).stat().st_size for d in dateien),
        "transcript_chars": len("\n".join(zeilen)),
    }
    (ausgaben / "metrics.json").write_text(json.dumps(metriken, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
