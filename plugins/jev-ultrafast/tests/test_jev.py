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
        if method == "Browser.setWindowBounds" and "windowState" in params["bounds"]:
            self.window_state = params["bounds"]["windowState"]
        return {}

    def methods(self, name):
        return [params for method, params in self.calls if method == name]


class TabAndWindow(unittest.TestCase):
    def test_visible_tab_skips_devtools_and_hidden_tabs_and_detaches_probes(self):
        cdp = FakeCdp([("dev", "devtools://devtools/x", "visible"), ("daemon", "about:blank", "hidden"),
                       ("vorne", "https://de.wikipedia.org/", "visible")])
        self.assertEqual(jev.visible_tab(cdp), ("vorne", "https://de.wikipedia.org/"))
        self.assertEqual([p["targetId"] for p in cdp.methods("Target.attachToTarget")], ["daemon", "vorne"])
        self.assertEqual(len(cdp.methods("Target.detachFromTarget")), 2)

    def test_keeps_front_tab_with_content(self):
        cdp = FakeCdp([("daemon", "about:blank", "hidden"), ("vorne", "https://de.wikipedia.org/", "visible")])
        self.assertEqual(jev.working_tab(cdp, "daemon"), ("vorne", "vorne"))
        self.assertEqual(cdp.methods("Target.closeTarget"), [])

    def test_replaces_empty_start_tab_with_daemon_tab(self):
        cdp = FakeCdp([("start", "about:blank", "visible"), ("daemon", "about:blank", "hidden")])
        self.assertEqual(jev.working_tab(cdp, "daemon"), ("daemon", "daemon"))
        self.assertEqual(cdp.methods("Target.activateTarget"), [{"targetId": "daemon"}])
        self.assertEqual(cdp.methods("Target.closeTarget"), [{"targetId": "start"}])

    def test_daemon_tab_in_front_is_kept(self):
        cdp = FakeCdp([("daemon", "about:blank", "visible")])
        self.assertEqual(jev.working_tab(cdp, "daemon"), ("daemon", "vorne"))
        self.assertEqual(cdp.methods("Target.closeTarget"), [])

    def test_without_visible_tab_uses_daemon_tab_or_opens_one(self):
        cdp = FakeCdp([("daemon", "about:blank", "hidden")])
        self.assertEqual(jev.working_tab(cdp, "daemon"), ("daemon", "daemon"))
        self.assertEqual(cdp.methods("Target.closeTarget"), [])
        cdp = FakeCdp([("x", "about:blank", "hidden")])
        self.assertEqual(jev.working_tab(cdp, None), ("neu", "neu"))

    def test_headless_is_read_from_user_agent(self):
        self.assertTrue(jev.is_headless(lambda method, **_: {"userAgent": "Mozilla/5.0 HeadlessChrome/141"}))
        self.assertFalse(jev.is_headless(lambda method, **_: {"userAgent": "Mozilla/5.0 Chrome/141"}))

    def test_maximizes_window(self):
        cdp = FakeCdp([], window_state="normal")
        report = jev.maximize_window(cdp, "t")
        self.assertEqual([p["bounds"] for p in cdp.methods("Browser.setWindowBounds")], [{"windowState": "maximized"}])
        self.assertEqual(report, {"vorher": {"windowState": "normal"}, "nachher": {"windowState": "maximized"}})

    def test_leaves_maximized_window_alone(self):
        cdp = FakeCdp([], window_state="maximized")
        jev.maximize_window(cdp, "t")
        self.assertEqual(cdp.methods("Browser.setWindowBounds"), [])

    def test_reports_errors_instead_of_hiding_them(self):
        def broken(method, session_id=None, **params):
            raise RuntimeError("Browser window not found")

        self.assertEqual(jev.maximize_window(broken, "t"), {"fehler": "RuntimeError: Browser window not found"})

# Selbst signierte Test-CA; Fingerabdruck von OpenSSL:
# openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64
TEST_CA = """-----BEGIN CERTIFICATE-----
MIIBgzCCASmgAwIBAgIUBZ/gJRHx7tA6tYXApJ3yTcVzetMwCgYIKoZIzj0EAwIw
FjEUMBIGA1UEAwwLSmV2IFRlc3QgQ0EwIBcNMjYwOTIzMTg1NjMzWhgPMjEyNjA4
MzAxODU2MzNaMBYxFDASBgNVBAMMC0pldiBUZXN0IENBMFkwEwYHKoZIzj0CAQYI
KoZIzj0DAQcDQgAE2VKsD18EEXku+4GN4qaEro8o2pS6o4DvUPtEo+DRWKvszHSp
wT1La9MNZCE9GQmu3/bh5JIUsiZN+95l8ru+DKNTMFEwHQYDVR0OBBYEFDOi1oYN
vVDCZFmwaQWOA29OgPZdMB8GA1UdIwQYMBaAFDOi1oYNvVDCZFmwaQWOA29OgPZd
MA8GA1UdEwEB/wQFMAMBAf8wCgYIKoZIzj0EAwIDSAAwRQIgcymZ8YvbL87Wnxdr
7Fk7Fo9qOB87KEwYqJ3y4wIf0b4CIQCGwkHBSQ6sy0pO+isE9o91RhUDNDR4D2ub
Rv18JRMWFA==
-----END CERTIFICATE-----
"""
TEST_CA_PIN = "wSKBf4a5xob7ivQ22WG99l5UO/MJ/eQs11b7IPeWPsw="


class ProxyCa(unittest.TestCase):
    def test_pin_matches_openssl_and_duplicates_collapse(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "ca.crt"
            path.write_text(TEST_CA + TEST_CA, encoding="ascii")
            with patch.dict(jev.os.environ, {"JEV_PROXY_CA": str(path)}), \
                    patch.object(jev.Path, "home", return_value=Path(tmp)):
                self.assertEqual(jev.proxy_ca_pins(), [TEST_CA_PIN])

    def test_cloud_location_is_found_without_variable(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(jev.os.environ), \
                patch.object(jev.Path, "home", return_value=Path(tmp)):
            jev.os.environ.pop("JEV_PROXY_CA", None)
            self.assertEqual(jev.proxy_ca_pins(), [])
            (Path(tmp) / ".ccr").mkdir()
            (Path(tmp) / ".ccr" / "agent-proxy-ca.crt").write_text(TEST_CA, encoding="ascii")
            self.assertEqual(jev.proxy_ca_pins(), [TEST_CA_PIN])


if __name__ == "__main__":
    unittest.main()
