"""Ende-zu-Ende-Lauf ohne echte Modelle und ohne Kosten.

Startet eine Testseite und einen Ersatz für Jev und das Textmodell auf 127.0.0.1,
dann ruft er `jev.py run` genau so auf, wie der Skill es tut. Geprüft wird der
ganze Weg: eigener Chrome, Umleitung der Jev-Anfragen, Tippen, Klicken,
Auswählen, Abschlussprüfung, Exit-Code und dass am Ende nur ein Tab offen ist.

    python plugins/jev-ultrafast/tests/e2e_offline.py

Braucht uv und einen Chrome, Chromium oder Edge. Nutzt ein Wegwerfprofil.
"""

import json
import os
import subprocess
import sys
import tempfile
import threading
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "skills" / "jev" / "scripts" / "jev.py"

SEARCH = """<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Bibliothek</title></head><body>
<h1>Stadtbibliothek</h1>
<form onsubmit="event.preventDefault(); const q=document.getElementById('q').value;
  const k=document.getElementById('k').value;
  document.getElementById('r').innerHTML='<h2>Ergebnisse für '+q+' ('+(k||'alle')+')</h2>'+
  '<a href=\\'/buch\\'>'+q+' – Band 1</a>';">
  <label for="q">Suchbegriff</label> <input id="q" type="search">
  <label for="k">Kategorie</label>
  <select id="k"><option value="">Alle</option><option value="roman">Roman</option>
  <option value="sach">Sachbuch</option></select>
  <button type="submit">Suchen</button>
</form><div id="r"></div></body></html>"""

BOOK = """<!doctype html><html><head><meta charset="utf-8"><title>Buch</title></head>
<body><h1>Der Zauberberg – Band 1</h1><p>Verfügbar</p></body></html>"""

GOAL = "Suche in der Kategorie Roman nach 'Der Zauberberg' und öffne den ersten Treffer. Stopp auf der Buchseite."


def answer(criteria, choice):
    ids = list(criteria)
    rest = (1 - 0.9) / (len(ids) - 1) if len(ids) > 1 else 0
    return {"choice": choice, "confidence": 0.9,
            "probabilities": {i: (0.9 if i == choice else rest) if len(ids) > 1 else 1.0 for i in ids}}


def decide(body, log):
    """Gescriptete Politik: tippen, Kategorie wählen, suchen, Treffer öffnen, fertig."""
    state, questions = body["state"], body["questions"]
    elements = {e["label"]: e for e in state["elements"]}
    page = state["page"]
    if page["title"] == "Buch":
        operation, target = "DONE", None
    elif "Ergebnisse für" in page["text"]:
        link = next(e for e in state["elements"] if e["role"] == "link")
        operation, target = "CLICK", link["index"]
    elif not elements["Suchbegriff"].get("value"):
        operation, target = "TYPE_TEXT", elements["Suchbegriff"]["index"]
    elif elements["Kategorie"].get("value") != "Roman":
        option = next(o for o in elements["Kategorie"]["options"] if o["value"] == "roman")
        operation, target = "SELECT", option["index"]
    else:
        operation, target = "CLICK", elements["Suchen"]["index"]
    log.append(operation)
    answers = {"operation": answer(questions["operation"]["criteria"], operation)}
    for name, question in questions.items():
        if name == "operation":
            continue
        criteria = question["criteria"]
        wanted = target if name == operation.lower() + "_target" else next(iter(criteria))
        answers[name] = answer(criteria, wanted)
    return {"answers": answers, "usage": {}}


def serve(log):
    class Handler(BaseHTTPRequestHandler):
        def reply(self, status, content, mime):
            data = content.encode()
            self.send_response(status)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            pages = {"/": SEARCH, "/buch": BOOK}
            self.reply(200 if self.path in pages else 404, pages.get(self.path, "fehlt"), "text/html; charset=utf-8")

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            if self.path == "/decisions":
                assert self.headers["Authorization"] == "Bearer testschluessel"
                assert body["model"] == "typesafe/jev-1.13"
                return self.reply(200, json.dumps(decide(body, log)), "application/json")
            if self.path == "/v1/chat/completions":
                log.append("text")
                content = json.dumps({"text": "Der Zauberberg"})
                return self.reply(200, json.dumps({"choices": [{"message": {"content": content}}]}),
                                  "application/json")
            self.reply(404, "{}", "application/json")

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def page_tabs(port):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(f"http://127.0.0.1:{port}/json/list", timeout=5) as response:
        return [t for t in json.loads(response.read()) if t["type"] == "page"]


def main():
    log = []
    server = serve(log)
    base = f"http://127.0.0.1:{server.server_port}"
    with tempfile.TemporaryDirectory() as home:
        env = {
            **os.environ,
            "JEV_HOME": home,
            "JEV_CDP_PORT": "9344",
            "OPENROUTER_API_KEY": "testschluessel",
            "JEV_DECISIONS_URL": base + "/decisions",
            "TEXT_MODEL_BASE_URL": base + "/v1",
        }
        for key in ("TYPESAFE_API_KEY", "TEXT_MODEL_API_KEY", "TYPESAFE_MODEL", "JEV_CDP_URL"):
            env.pop(key, None)
        uv = ["uv", "run", "--quiet", "--script", str(SCRIPT)]
        try:
            subprocess.run(uv + ["chrome"], env=env, capture_output=True, timeout=60, check=True)
            run = subprocess.run(
                uv + ["run", "--url", base + "/", "--goal", GOAL, "--keep-open",
                      "--expect-url", base + "/buch", "--expect-text", "Der Zauberberg – Band 1"],
                env=env, capture_output=True, text=True, encoding="utf-8", timeout=300,
            )
            tabs = page_tabs(9344)
        finally:
            subprocess.run(uv + ["stop"], env=env, capture_output=True, timeout=60)
    print(run.stderr, file=sys.stderr)
    result = json.loads(run.stdout)
    print(json.dumps({k: result[k] for k in ("status", "verified", "checks", "url", "decisions", "text_calls")},
                     ensure_ascii=False, indent=2))
    expected = ["TYPE_TEXT", "text", "SELECT", "CLICK", "CLICK", "DONE"]
    assert run.returncode == 0, f"Exit-Code {run.returncode}"
    assert result["status"] == "done" and result["verified"] is True
    assert [s["operation"] for s in result["steps"]] == ["TYPE_TEXT", "SELECT", "CLICK", "CLICK"]
    assert result["steps"][0]["text"] == "Der Zauberberg"
    assert log == expected, log
    assert [t["url"] for t in tabs] == [base + "/buch"], tabs
    print("OK: kompletter Lauf ohne echte Modelle bestanden")


if __name__ == "__main__":
    main()
