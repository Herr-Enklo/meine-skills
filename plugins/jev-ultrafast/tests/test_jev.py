"""Offline-Tests für jev.py. Kein Browser, kein Netz, keine Pakete außer der Standardbibliothek.

    python -m unittest discover -s plugins/jev-ultrafast/tests
"""

import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "skills" / "jev" / "scripts" / "jev.py"
spec = importlib.util.spec_from_file_location("jev", SCRIPT)
jev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(jev)


class ParseEnv(unittest.TestCase):
    def test_reads_keys_and_strips_quotes(self):
        text = "# Kommentar\n\nOPENROUTER_API_KEY='sk-or-1'\nexport TEXT_MODEL=\"m\"\nLEER=\nKAPUTT\n"
        self.assertEqual(jev.parse_env(text), {"OPENROUTER_API_KEY": "sk-or-1", "TEXT_MODEL": "m"})

    def test_environment_wins_over_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / ".env"
            path.write_text("OPENROUTER_API_KEY=aus-datei\nTEXT_MODEL=x\n", encoding="utf-8")
            env = {"OPENROUTER_API_KEY": "aus-umgebung"}
            jev.load_env(env, path)
        self.assertEqual(env, {"OPENROUTER_API_KEY": "aus-umgebung", "TEXT_MODEL": "x"})


class Configure(unittest.TestCase):
    def test_nothing_configured(self):
        env = {}
        settings = jev.configure(env)
        self.assertIsNone(settings["provider"])
        self.assertIsNone(settings["text_model"])
        self.assertNotIn("TYPESAFE_API_KEY", env)

    def test_openrouter_key_covers_decisions_and_text(self):
        env = {"OPENROUTER_API_KEY": "sk-or"}
        settings = jev.configure(env)
        self.assertEqual(settings["provider"], "openrouter")
        self.assertEqual(settings["decisions_url"], jev.OPENROUTER_DECISIONS)
        self.assertEqual(env["TYPESAFE_API_KEY"], "sk-or")
        self.assertEqual(env["TYPESAFE_MODEL"], "typesafe/jev-1.13")
        self.assertEqual(env["TEXT_MODEL_API_KEY"], "sk-or")
        self.assertEqual(env["TEXT_MODEL_BASE_URL"], jev.OPENROUTER_TEXT)
        self.assertEqual(env["TEXT_MODEL"], "inception/mercury-2.5")
        self.assertEqual(env["TEXT_MODEL_REASONING"], "none")

    def test_typesafe_key_wins_and_keeps_upstream_endpoint(self):
        env = {"TYPESAFE_API_KEY": "ts", "OPENROUTER_API_KEY": "sk-or"}
        settings = jev.configure(env)
        self.assertEqual(settings["provider"], "typesafe")
        self.assertEqual(settings["decisions_url"], jev.TYPESAFE_DECISIONS)
        self.assertEqual(env["TYPESAFE_API_KEY"], "ts")
        self.assertEqual(env["TYPESAFE_MODEL"], "jev-latest")
        self.assertEqual(env["TEXT_MODEL_API_KEY"], "sk-or")

    def test_explicit_text_model_is_kept(self):
        env = {"OPENROUTER_API_KEY": "sk-or", "TEXT_MODEL_API_KEY": "ds", "TEXT_MODEL_BASE_URL": "https://api.deepseek.com/v1"}
        jev.configure(env)
        self.assertEqual(env["TEXT_MODEL_API_KEY"], "ds")
        self.assertNotIn("TEXT_MODEL", env)

    def test_summary_never_contains_keys(self):
        env = {"OPENROUTER_API_KEY": "geheim-123"}
        self.assertNotIn("geheim-123", repr(jev.configure(env)))


class Urls(unittest.TestCase):
    def test_accepts_http_and_https(self):
        for url in ("https://example.org/", "http://127.0.0.1:8000/a?b=c"):
            self.assertEqual(jev.http_url(url), url)

    def test_rejects_other_schemes_credentials_and_whitespace(self):
        for url in ("file:///etc/passwd", "javascript:alert(1)", "chrome://settings", "https://user:pw@example.org/",
                    "https://exa mple.org/", "", None):
            with self.assertRaises(ValueError):
                jev.http_url(url)


class Outcome(unittest.TestCase):
    def test_checks(self):
        checks = jev.check_outcome("https://en.wikipedia.org/wiki/General_relativity", "General Relativity\n...",
                                   "https://en.wikipedia.org/wiki/General", ["general relativity", "Einstein"])
        self.assertEqual([c["passed"] for c in checks], [True, True, False])

    def test_exit_codes(self):
        self.assertEqual(jev.exit_code({"status": "done", "verified": True}), 0)
        self.assertEqual(jev.exit_code({"status": "done", "verified": None}), 0)
        self.assertEqual(jev.exit_code({"status": "done", "verified": False}), 2)
        self.assertEqual(jev.exit_code({"status": "blocked", "verified": True}), 2)
        self.assertEqual(jev.exit_code({"status": "budget", "verified": None}), 2)
        self.assertEqual(jev.exit_code({"status": "error", "verified": None}), 1)

    def test_daemon_name_is_valid_for_browser_harness(self):
        self.assertRegex(jev.DAEMON, r"\A[A-Za-z0-9_-]{1,64}\Z")


class FakeCdp:
    """Ersatz für browser_harness.helpers.cdp: Tabs mit Sichtbarkeit, Fenster mit Zustand."""

    def __init__(self, tabs, window_state="normal"):
        self.tabs = tabs  # (targetId, url, visibilityState)
        self.window_state = window_state
        self.calls = []

    def __call__(self, method, session_id=None, **params):
        self.calls.append((method, params))
        if method == "Target.getTargets":
            infos = [{"targetId": t, "type": "page", "url": u} for t, u, _ in self.tabs]
            return {"targetInfos": infos + [{"targetId": "w", "type": "service_worker", "url": "https://x/sw.js"}]}
        if method == "Target.attachToTarget":
            return {"sessionId": "s-" + params["targetId"]}
        if method == "Runtime.evaluate":
            state = next(v for t, _, v in self.tabs if "s-" + t == session_id)
            return {"result": {"value": state}}
        if method == "Target.createTarget":
            return {"targetId": "neu"}
        if method == "Browser.getWindowForTarget":
            return {"windowId": 1, "bounds": {"windowState": self.window_state}}
        return {}

    def methods(self, name):
        return [params for method, params in self.calls if method == name]


class TabAndWindow(unittest.TestCase):
    def test_uses_visible_tab_and_leaves_probes_detached(self):
        cdp = FakeCdp([("dev", "devtools://devtools/x", "visible"), ("daemon", "about:blank", "hidden"),
                       ("vorne", "https://de.wikipedia.org/", "visible")])
        self.assertEqual(jev.front_tab(cdp), "vorne")
        self.assertEqual([p["targetId"] for p in cdp.methods("Target.attachToTarget")], ["daemon", "vorne"])
        self.assertEqual(len(cdp.methods("Target.detachFromTarget")), 2)
        self.assertEqual(cdp.methods("Target.createTarget"), [])

    def test_opens_foreground_tab_when_none_is_visible(self):
        cdp = FakeCdp([("daemon", "about:blank", "hidden")])
        self.assertEqual(jev.front_tab(cdp), "neu")
        self.assertEqual(cdp.methods("Target.createTarget"), [{"url": "about:blank"}])

    def test_unmaximizes_and_fits_window_to_page(self):
        cdp = FakeCdp([], window_state="maximized")
        with patch.object(jev.time, "sleep"):
            jev.fit_window(cdp, "t", lambda _: [16, 95])
        self.assertEqual([p["bounds"] for p in cdp.methods("Browser.setWindowBounds")],
                         [{"windowState": "normal"}, {"width": jev.VIEW_WIDTH + 16, "height": jev.VIEW_HEIGHT + 95}])

    def test_leaves_minimized_window_and_implausible_frames_alone(self):
        for state, frame in (("minimized", [16, 95]), ("normal", [694, -72])):
            cdp = FakeCdp([], window_state=state)
            jev.fit_window(cdp, "t", lambda _, frame=frame: frame)
            self.assertEqual(cdp.methods("Browser.setWindowBounds"), [], state)


if __name__ == "__main__":
    unittest.main()
