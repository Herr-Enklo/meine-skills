#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "jev-ultrafast @ git+https://github.com/browser-use/jev-ultrafast@1231850a0bf1a0c0341fe408ef1668dbbfdfac46",
# ]
# [tool.uv]
# exclude-newer = "2026-09-21T00:00:00Z"
# ///
"""Jev Ultrafast für Claude Code: ein Ziel, ein eigener Chrome, geprüftes Ergebnis.

Aufruf immer über uv, damit die gepinnte Jev-Version geladen wird:

    uv run --script jev.py status
    uv run --script jev.py chrome [--headless]
    uv run --script jev.py inspect --url URL
    uv run --script jev.py run --url URL --goal ZIEL --expect-text TEXT
    uv run --script jev.py stop

Jev steuert nie den Alltags-Chrome, sondern einen eigenen mit getrenntem Profil
unter ~/.jev/chrome-profile, angebunden über den DevTools-Port auf 127.0.0.1.
Schlüssel kommen aus der Umgebung oder aus ~/.jev/.env und werden nie ausgegeben.
"""

import argparse
import functools
import glob
import json
import os
import platform
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

HOME = Path(os.environ.get("JEV_HOME", Path.home() / ".jev"))
ENV_FILE = Path(os.environ.get("JEV_ENV_FILE", HOME / ".env"))
PROFILE = HOME / "chrome-profile"
PORT = int(os.environ.get("JEV_CDP_PORT", "9333"))
CDP_URL = os.environ.get("JEV_CDP_URL", f"http://127.0.0.1:{PORT}")
# Ein Browser-Harness-Daemon je Chrome. Ein gemeinsamer Name würde Befehle an den falschen Chrome schicken.
DAEMON = "jev-" + "".join(c if c.isalnum() else "-" for c in urlsplit(CDP_URL).netloc)[:60]

TYPESAFE_DECISIONS = "https://api.typesafe.ai/v1/systemone"
OPENROUTER_DECISIONS = "https://openrouter.ai/api/alpha/decisions"
OPENROUTER_JEV_MODEL = "typesafe/jev-1.13"
OPENROUTER_TEXT = "https://openrouter.ai/api/v1"
TEXT_MODEL = "inception/mercury-2.5"


# ---------------------------------------------------------------- Konfiguration


def parse_env(text):
    """KEY=VALUE-Zeilen wie in .env. Kommentare und Leerzeilen zählen nicht."""
    values = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if key.startswith("export "):
            key = key[7:].strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if key and value:
            values[key] = value
    return values


def load_env(env=os.environ, path=ENV_FILE):
    """Umgebungsvariablen gewinnen, die Datei ergänzt nur Fehlendes."""
    if path.is_file():
        for key, value in parse_env(path.read_text(encoding="utf-8-sig")).items():
            env.setdefault(key, value)


def configure(env=os.environ):
    """Legt fest, wo Jev entscheidet und wer Text schreibt. Gibt eine Übersicht ohne Schlüssel zurück."""
    decisions = None
    if env.get("TYPESAFE_API_KEY"):
        provider = "typesafe"
        decisions = TYPESAFE_DECISIONS
        env.setdefault("TYPESAFE_MODEL", "jev-latest")
    elif env.get("OPENROUTER_API_KEY"):
        # Jev liegt auch bei OpenRouter; Anfrage und Antwort haben dasselbe Format wie bei TypeSafe.
        provider = "openrouter"
        decisions = env.get("JEV_DECISIONS_URL", OPENROUTER_DECISIONS)
        env["TYPESAFE_API_KEY"] = env["OPENROUTER_API_KEY"]
        env.setdefault("TYPESAFE_MODEL", OPENROUTER_JEV_MODEL)
    else:
        provider = None
    if not env.get("TEXT_MODEL_API_KEY") and env.get("OPENROUTER_API_KEY"):
        env["TEXT_MODEL_API_KEY"] = env["OPENROUTER_API_KEY"]
        env.setdefault("TEXT_MODEL_BASE_URL", OPENROUTER_TEXT)
    if env.get("TEXT_MODEL_BASE_URL", "").rstrip("/") == OPENROUTER_TEXT:
        env.setdefault("TEXT_MODEL", TEXT_MODEL)
        env.setdefault("TEXT_MODEL_REASONING", "none")
    return {
        "provider": provider,
        "decisions_url": decisions,
        "jev_model": env.get("TYPESAFE_MODEL") if provider else None,
        "text_model": env.get("TEXT_MODEL") if env.get("TEXT_MODEL_API_KEY") else None,
        "text_base_url": env.get("TEXT_MODEL_BASE_URL") if env.get("TEXT_MODEL_API_KEY") else None,
        "env_file": str(ENV_FILE),
        "env_file_exists": ENV_FILE.is_file(),
    }


def http_url(value):
    parsed = urlsplit(value or "")
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError(f"Nur http(s)-Adressen: {value!r}")
    if parsed.username or parsed.password:
        raise ValueError("Keine Zugangsdaten in der URL")
    if any(ord(c) < 33 for c in value):
        raise ValueError("URL enthält Leer- oder Steuerzeichen")
    return value


def prepare_runtime(settings):
    """Muss vor dem ersten Import von jev_ultrafast laufen: browser_harness liest BU_* beim Import."""
    os.environ["BU_CDP_URL"] = CDP_URL
    os.environ.pop("BU_CDP_WS", None)
    os.environ["BU_NAME"] = DAEMON
    os.environ.setdefault("BH_TELEMETRY", "0")
    os.environ.setdefault("BH_UPDATE_CHECK", "0")
    from jev_ultrafast import model

    target = settings.get("decisions_url")
    if target and target != TYPESAFE_DECISIONS and not getattr(model.post_json, "jev_skill", False):
        original = model.post_json

        def post_json(url, key, body):
            if url != TYPESAFE_DECISIONS:
                return original(url, key, body)
            result = original(target, key, body)
            result.setdefault("model", body.get("model"))
            return result

        post_json.jev_skill = True
        model.post_json = post_json

    from jev_ultrafast import agent

    agent.Browser = tab_browser()


# ---------------------------------------------------------------- Chrome


def cdp_alive(url=CDP_URL, timeout=1.5):
    # Ohne Proxy: ein System-Proxy würde die Anfrage an 127.0.0.1 sonst womöglich umleiten.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(url.rstrip("/") + "/json/version", timeout=timeout) as response:
            return json.loads(response.read()).get("Browser")
    except Exception:
        return None


def find_chrome():
    if path := os.environ.get("JEV_CHROME"):
        return path
    system = platform.system()
    candidates = []
    if system == "Windows":
        for base in (os.environ.get(k) for k in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA")):
            if base:
                candidates.append(Path(base) / "Google/Chrome/Application/chrome.exe")
        for base in (os.environ.get(k) for k in ("PROGRAMFILES(X86)", "PROGRAMFILES")):
            if base:
                candidates.append(Path(base) / "Microsoft/Edge/Application/msedge.exe")
    elif system == "Darwin":
        for app in ("Google Chrome", "Chromium", "Microsoft Edge"):
            candidates.append(Path(f"/Applications/{app}.app/Contents/MacOS/{app}"))
    else:
        for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"):
            if found := shutil.which(name):
                candidates.append(Path(found))
        candidates += [Path(p) for p in sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux/chrome"))]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return None


def wants_headless():
    return platform.system() == "Linux" and not (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))


def start_chrome(headless=None):
    if browser := cdp_alive():
        return {"cdp_url": CDP_URL, "browser": browser, "started": False}
    if os.environ.get("JEV_CDP_URL"):
        raise RuntimeError(f"JEV_CDP_URL={CDP_URL} antwortet nicht; dieser Chrome wird nicht selbst gestartet.")
    binary = find_chrome()
    if not binary:
        raise RuntimeError("Kein Chrome, Chromium oder Edge gefunden. Pfad in JEV_CHROME setzen.")
    headless = wants_headless() if headless is None else headless
    PROFILE.mkdir(parents=True, exist_ok=True)
    args = [
        binary,
        f"--remote-debugging-port={PORT}",
        "--remote-debugging-address=127.0.0.1",
        f"--user-data-dir={PROFILE}",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1200,900",
    ]
    if headless:
        args.append("--headless=new")
    if platform.system() == "Linux" and os.geteuid() == 0:
        args.append("--no-sandbox")  # Chrome verweigert sonst den Start als root, etwa im Cloud-Container.
    args.append("about:blank")
    options = {"stdin": subprocess.DEVNULL, "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
    if platform.system() == "Windows":
        options["creationflags"] = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        options["start_new_session"] = True
    process = subprocess.Popen(args, **options)
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if browser := cdp_alive():
            return {"cdp_url": CDP_URL, "browser": browser, "started": True, "headless": headless,
                    "pid": process.pid, "profile": str(PROFILE)}
        if process.poll() is not None:
            break
        time.sleep(0.25)
    raise RuntimeError(f"Chrome antwortet nicht auf {CDP_URL}. Läuft schon ein Chrome mit diesem Profil ohne Port?")


# ---------------------------------------------------------------- Tab und Fenster

# Jev setzt diese Seitengröße fest; mit ihr ist er gemessen (docs/performance.md im Jev-Repo).
VIEW_WIDTH, VIEW_HEIGHT = 1120, 780


def front_tab(cdp):
    """Der Tab, den der Nutzer vor sich hat.

    Jev legt sonst je Lauf einen Hintergrund-Tab an, damit er im Alltags-Chrome keinen fremden Tab
    anfasst. Dieser Chrome gehört Jev allein; neue Tabs häufen sich nur und laufen am Nutzer vorbei.
    """
    pages = [t for t in cdp("Target.getTargets")["targetInfos"]
             if t["type"] == "page" and not t["url"].startswith(("devtools://", "chrome-extension://"))]
    for page in pages:
        session = None
        try:
            session = cdp("Target.attachToTarget", targetId=page["targetId"], flatten=True)["sessionId"]
            state = cdp("Runtime.evaluate", session_id=session, expression="document.visibilityState",
                        returnByValue=True)
            if state.get("result", {}).get("value") == "visible":
                return page["targetId"]
        except Exception:
            pass
        finally:
            if session:
                try:
                    cdp("Target.detachFromTarget", sessionId=session)
                except Exception:
                    pass
    # Kein Tab sichtbar, etwa bei minimiertem Fenster. Versteckte Tabs bleiben unberührt,
    # darunter der eigene Tab des Browser-Harness-Daemons.
    return cdp("Target.createTarget", url="about:blank")["targetId"]


def fit_window(cdp, target, evaluate):
    """Fenster so groß wie Jevs Seite, sonst steht sie klein in einem grauen Rahmen."""
    try:
        window = cdp("Browser.getWindowForTarget", targetId=target)
        state = window["bounds"].get("windowState", "normal")
        if state == "minimized":
            return
        if state != "normal":
            cdp("Browser.setWindowBounds", windowId=window["windowId"], bounds={"windowState": "normal"})
            time.sleep(0.3)
        frame_width, frame_height = evaluate("[outerWidth - innerWidth, outerHeight - innerHeight]")
        # Unplausible Werte kommen von einer Seitengröße, die ein früherer Lauf am Tab hinterlassen hat.
        if 0 <= frame_width <= 200 and 0 <= frame_height <= 400:
            cdp("Browser.setWindowBounds", windowId=window["windowId"],
                bounds={"width": VIEW_WIDTH + frame_width, "height": VIEW_HEIGHT + frame_height})
    except Exception:
        pass  # Nur Darstellung; Jev arbeitet auch ohne.


@functools.cache
def tab_browser():
    """Jevs Browser, aber im vorderen Tab. Erst nach prepare_runtime aufrufen."""
    from browser_harness.admin import ensure_daemon
    from browser_harness.helpers import cdp
    from jev_ultrafast.browser import Browser

    class TabBrowser(Browser):
        def __init__(self, url):
            # Wie Browser.__init__ im gepinnten Commit, bis auf Tab und Fenster.
            ensure_daemon()
            self.target = front_tab(cdp)
            self.session = cdp("Target.attachToTarget", targetId=self.target, flatten=True)["sessionId"]
            fit_window(cdp, self.target, self.evaluate)
            self.call("Emulation.setDeviceMetricsOverride", width=VIEW_WIDTH, height=VIEW_HEIGHT,
                      deviceScaleFactor=1, mobile=False)
            self.call("Emulation.setFocusEmulationEnabled", enabled=True)
            self.call("Page.navigate", url=url)
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                if self.evaluate("document.readyState") == "complete":
                    break
                time.sleep(0.02)

        def release(self):
            """Tab dem Nutzer überlassen: Die Seite füllt wieder das Fenster, Jevs Sitzung endet.

            Die Sitzung hängt am Daemon, nicht an diesem Prozess. Ohne Lösen bliebe die feste
            Seitengröße am Tab, bis der Daemon endet.
            """
            if not self.target:
                return
            for method, params in (("Emulation.clearDeviceMetricsOverride", {}),
                                   ("Emulation.setFocusEmulationEnabled", {"enabled": False})):
                try:
                    self.call(method, **params)
                except Exception:
                    pass
            try:
                cdp("Target.detachFromTarget", sessionId=self.session)
            except Exception:
                pass
            self.target = None

        def close(self):
            """Seite leeren statt Tab schließen: Mit dem letzten Tab ginge das Fenster zu."""
            if self.target:
                try:
                    self.call("Page.navigate", url="about:blank")
                except Exception:
                    pass
                self.release()

    return TabBrowser


# ---------------------------------------------------------------- Ausführung


def elements_table(page):
    from jev_ultrafast.model import action_space

    rows = []
    for e in action_space(page["actions"])[0]:
        row = {"index": int(e["index"]), "role": e.get("role"), "label": e["label"], "operations": e["operations"]}
        for key in ("checked", "selected", "expanded"):
            if key in e:
                row[key] = e[key]
        if e.get("value") and e.get("role") not in {"checkbox", "radio", "switch"}:
            row["value"] = e["value"]
        if e.get("options"):
            row["options"] = [o["label"].split(" → ")[-1] for o in e["options"]][:20]
        rows.append(row)
    return rows


FULL_TEXT = "(() => (document.body ? document.body.innerText : ''))()"


def save_screenshot(browser, path):
    """Bild der Endseite, damit man einen headless Lauf nachvollziehen kann. Jev selbst sieht keine Bilder."""
    import base64

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(base64.b64decode(browser.call("Page.captureScreenshot", format="png")["data"]))
    return str(path.resolve())


def check_outcome(url, text, expect_url=None, expect_text=()):
    checks = []
    if expect_url:
        checks.append({"check": "url_beginnt_mit", "expected": expect_url, "passed": url.startswith(expect_url)})
    folded = text.casefold()
    for expected in expect_text:
        checks.append({"check": "text_sichtbar", "expected": expected, "passed": expected.casefold() in folded})
    return checks


def step_line(step, seconds):
    detail = f' <- "{step["text"]}"' if step.get("text") else ""
    target = f' [{step["target"]}]' if step.get("target") else ""
    return f'{step["step"]:>3}  {seconds:5.1f}s  {step["operation"]}{target} {step["action"]}{detail}'


def run_goal(url, goal, *, expect_url=None, expect_text=(), max_steps=40, timeout=180, keep_open=False,
             screenshot=None):
    from jev_ultrafast import Agent

    started = time.monotonic()
    agent = Agent(url, goal, screenshots=False)
    status, error = None, None
    try:
        ticks = 0
        while agent.state["status"] not in {"done", "blocked"}:
            if ticks >= max_steps or time.monotonic() - started >= timeout:
                status = "budget"
                break
            seen = len(agent.state["history"])
            try:
                agent.command("tick")
            except ValueError as exc:
                # Jevs eigene Grenzen (60 Aktionen, 120 Entscheidungen) enden als blocked, der Rest ist ein Fehler.
                status, error = ("blocked" if "budget" in str(exc) else "error"), str(exc)
                break
            ticks += 1
            for step in agent.state["history"][seen:]:
                print(step_line(step, time.monotonic() - started), file=sys.stderr, flush=True)
        status = status or agent.state["status"]
    except Exception as exc:
        status, error = "error", f"{type(exc).__name__}: {exc}"
    try:
        page = agent.browser.observe(screenshot=False)
        text = agent.browser.evaluate(FULL_TEXT) or page["text"]
    except Exception as exc:
        page, text = {"url": agent.state["page"]["url"], "title": agent.state["page"]["title"]}, ""
        error = error or f"Abschlussbeobachtung fehlgeschlagen: {exc}"
    checks = check_outcome(page["url"], text, expect_url, expect_text)
    result = {
        "status": status,
        "verified": all(c["passed"] for c in checks) if checks else None,
        "checks": checks,
        "url": page["url"],
        "title": page.get("title"),
        "text": text[:4000],
        "steps": [
            {k: h.get(k) for k in ("step", "operation", "target", "action", "kind", "text", "page_changed", "url")}
            for h in agent.state["history"]
        ],
        "decisions": len(agent.state["decisions"]),
        "text_calls": len(agent.state["text_calls"]),
        "elapsed_ms": round((time.monotonic() - started) * 1000),
        "kept_open": keep_open,
    }
    if screenshot:
        try:
            result["screenshot"] = save_screenshot(agent.browser, screenshot)
        except Exception as exc:
            result["screenshot_error"] = str(exc)
    if error:
        result["error"] = error
    if keep_open:
        agent.browser.release()
    else:
        agent.close()
    return result


def exit_code(result):
    if result["status"] == "error":
        return 1
    if result["status"] == "done" and result["verified"] is not False:
        return 0
    return 2


# ---------------------------------------------------------------- Befehle


def cmd_status(args, settings):
    return {**settings, "cdp_url": CDP_URL, "chrome": cdp_alive(), "chrome_binary": find_chrome(),
            "profile": str(PROFILE), "python": platform.python_version()}, 0


def cmd_chrome(args, settings):
    return start_chrome(True if args.headless else None), 0


def cmd_inspect(args, settings):
    start_chrome()
    prepare_runtime(settings)
    browser = tab_browser()(http_url(args.url))
    try:
        page = browser.observe(screenshot=False)
        result = {"url": page["url"], "title": page["title"], "elements": elements_table(page),
                  "text": page["text"][:3000]}
        if args.screenshot:
            result["screenshot"] = save_screenshot(browser, args.screenshot)
        return result, 0
    finally:
        if args.keep_open:
            browser.release()
        else:
            browser.close()


def cmd_run(args, settings):
    if not settings["provider"]:
        raise RuntimeError(f"Kein Jev-Schlüssel. OPENROUTER_API_KEY oder TYPESAFE_API_KEY in {ENV_FILE} eintragen.")
    goal = args.goal_file.read_text(encoding="utf-8") if args.goal_file else args.goal
    if not goal or not goal.strip():
        raise ValueError("Ziel fehlt: --goal oder --goal-file")
    if args.expect_url:
        http_url(args.expect_url)
    start_chrome()
    prepare_runtime(settings)
    result = run_goal(http_url(args.url), goal.strip(), expect_url=args.expect_url, expect_text=args.expect_text,
                      max_steps=args.max_steps, timeout=args.timeout, keep_open=args.keep_open,
                      screenshot=args.screenshot)
    result["provider"] = settings["provider"]
    return result, exit_code(result)


def cmd_stop(args, settings):
    if not cdp_alive():
        return {"stopped": False, "reason": "kein Chrome auf " + CDP_URL}, 0
    prepare_runtime(settings)
    from browser_harness.admin import ensure_daemon, restart_daemon
    from browser_harness.helpers import cdp

    ensure_daemon()
    try:
        cdp("Browser.close")
    except Exception:
        pass  # Chrome schließt die Verbindung, bevor die Antwort ankommt.
    restart_daemon(DAEMON)
    return {"stopped": True}, 0


def parser():
    p = argparse.ArgumentParser(prog="jev.py", description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("status", help="Konfiguration und Chrome prüfen, ohne Modellaufruf")
    chrome = sub.add_parser("chrome", help="Eigenen Automatisierungs-Chrome starten")
    chrome.add_argument("--headless", action="store_true", help="ohne Fenster (Server, Cloud)")
    inspect = sub.add_parser("inspect", help="Seite öffnen und Elementtabelle zeigen, ohne Modellaufruf")
    inspect.add_argument("--url", required=True)
    inspect.add_argument("--keep-open", action="store_true")
    inspect.add_argument("--screenshot", type=Path, help="Bild der Seite als PNG speichern")
    run = sub.add_parser("run", help="Ein Ziel von Jev ausführen lassen (kostenpflichtige API-Aufrufe)")
    run.add_argument("--url", required=True, help="Startseite")
    goal = run.add_mutually_exclusive_group(required=True)
    goal.add_argument("--goal", help="Ziel in natürlicher Sprache, mit Abbruchbedingung")
    goal.add_argument("--goal-file", type=Path, help="Ziel aus UTF-8-Datei")
    run.add_argument("--expect-url", help="Ergebnis-URL muss so beginnen")
    run.add_argument("--expect-text", action="append", default=[], help="Text muss am Ende sichtbar sein")
    run.add_argument("--max-steps", type=int, default=40, help="höchstens so viele Entscheidungsrunden")
    run.add_argument("--timeout", type=int, default=180, help="Sekunden, geprüft zwischen den Runden")
    run.add_argument("--keep-open", action="store_true", help="Tab danach offen lassen")
    run.add_argument("--screenshot", type=Path, help="Bild der Endseite als PNG speichern")
    sub.add_parser("stop", help="Automatisierungs-Chrome und Verbindung beenden")
    return p


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")  # Windows-Pipes sind sonst cp1252
    args = parser().parse_args(argv)
    load_env()
    settings = configure()
    commands = {"status": cmd_status, "chrome": cmd_chrome, "inspect": cmd_inspect, "run": cmd_run, "stop": cmd_stop}
    try:
        result, code = commands[args.command](args, settings)
    except (ValueError, RuntimeError, OSError) as exc:
        result, code = {"status": "error", "error": str(exc)}, 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return code


if __name__ == "__main__":
    sys.exit(main())
