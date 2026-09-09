"""Tests fuer Parser, Variablen, Interpreter, Pruefung und Paketfunktionen.

Ausfuehren:
    python -m unittest packaging-center.tests.test_engine    (vom Repo-Wurzelordner, geht nicht wegen Bindestrich)
    python packaging-center/tests/test_engine.py
    cd packaging-center && python -m unittest tests.test_engine
"""

from __future__ import annotations

import os
import sys
import tempfile
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from empirum import load_inf, parse_inf, Runner, RunOptions, SimulationBackend, validate, Status  # noqa: E402
from empirum.inf import decode_bytes, split_top_level  # noqa: E402
from empirum.variables import Variables, Expander  # noqa: E402
from empirum.script import parse_statement, parse_section  # noqa: E402
from empirum.runner import compare  # noqa: E402
from empirum.package import PackageSpec, create_package, export_zip, find_packages, import_reg_file  # noqa: E402

TEMPLATE_DIR = os.path.join(_ROOT, "empirum", "templates")

MINI = """[SetupInfo]
Author = Test
Method = Unattended

[Setup]
Version=14.2
Platform=*

[Application]
ProductName=Demo
DeveloperName=Acme
Version=1.2.3
Revision=0
UninstallKeyName=Matrix42 - %DeveloperName% %ProductName% %Version%
UninstallDisplayName=Matrix42 - %DeveloperName% %ProductName% %Version%
MachineKeyName=$Matrix42Packages$\\%DeveloperName%\\%ProductName%\\%Version%
UserKeyName=$Matrix42Packages$\\%DeveloperName%\\%ProductName%
ReinstallString="%CommonSetupDir%\\Setup.exe" "%App%\\%SetupInfDir%\\Setup.inf"
UninstallString=%ReinstallString% /U
UninstallOptions=NOREMOVE
SrcDir=..
ApplicationDir=%CommonAppData%\\$Matrix42Scripts$\\%DeveloperName%\\%ProductName%\\%Version%
SetupInfDir=Install
UseStringSection=Strings:09
EndMessage=%EndMessageDesc%
CreateUnresolvableShellLinks=1

[Strings:07]
EndMessageDesc=Fertig!
Disk1=Medium 1

[Strings:09]
EndMessageDesc=Done!
Disk1=Media 1

[Environment]
V_SourceDir=Files
CommonSetupDir=%CommonFilesDir%\\Setup%SetupBits%
LogFile=%Temp%\\%ProductName%.log
V_Deferred=%%HKLM,"SOFTWARE\\Acme\\Demo","Installed"%%

[Disks]
1=%Disk1%

[Options]
Product = %ProductName%, COPYALWAYS, Product, "Demo"

[Processes]
Proc1=demo.exe, Demo, KILLPROCESS ABORT

[Product]
AddMeter -1
#Set:Win64, WINDOWS64 DONTDELETE
#Set:Win32, WINDOWS32 DONTDELETE
#Set:Product, DONTDELETE
#Set:Uninstall, DELETE
#Set:Win64, WINDOWS64 DELETE
#Set:Win32, WINDOWS32 DELETE
1:%SetupInfDir%\\Setup.inf, , ALWAYS, 0
-AddMeter -1

[Set:Win64]
Set V_Installer=setup64.exe
Set V_Arch=x64
Set V_RegWin=

[Set:Win32]
Set V_Installer=setup32.exe
Set V_Arch=x86
Set V_RegWin=\\WOW6432Node

[Set:Product]
Echo Produkt %V_Arch%
Set V_GUID = GetUninstallKeyName("Demo App", %V_Arch%)
ReplaceEnv V_GUID
Set V_Installed = %%HKLM,"SOFTWARE%V_RegWin%\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\%V_GUID%","DisplayVersion"%%
ReplaceEnv V_Installed
If "%V_Installed%" >= "%Version%" Then "Set:Skip" EndIf
If "%V_GUID%" == "" Then "Set:Install" Else "Set:Repair" EndIf
#Set:Registered

[Set:Install]
Call "%Src%\\%V_SourceDir%\\%V_Installer%" /S
If "%ErrorLevel%" == "3010" Then "RebootRequired" EndIf
If "%ErrorLevel%" <> "0" & "%ErrorLevel%" <> "3010" Then "Set:Fail" EndIf
Set V_Done=1

[Set:Repair]
Echo Repair
#Set:Install

[Set:Skip]
Exit Schon installiert: %V_Installed%

[Set:Fail]
ErrorLogMsg Installation fehlgeschlagen, ErrorLevel %ErrorLevel%
Abort Fehler %ErrorLevel%

[RebootRequired]
SetReboot 1
-SetReboot 1

[Set:Registered]
Set V_Tokens = Tokenize (V_List)
For I,1,%V_Tokens%,1,Set:Token

[Set:Token]
Set V_Cur=%%V_List%I%%%
ReplaceEnv V_Cur
Echo Token %I% = %V_Cur%

[Set:Uninstall]
-Del "%LogFile%"
If DoesRegKeyExist ("HKLM,SOFTWARE\\Acme\\Demo,Installed") == "1" Then "Set:Fail" EndIf
-Call "%Src%\\Files\\uninstall.exe" /S
Set ErrorLogMessage=Deinstallation

[Reg:Product]
HKLM,"SOFTWARE\\Acme\\Demo","Installed",0x00010001,"1"
HKLM,"SOFTWARE\\Acme\\Demo","Path",0x00000000,"%App%"
-HKLM,"SOFTWARE\\Acme\\Old"

[Shell:Product]
"%CommonPrograms%\\Demo", "%ProgramFilesDir%\\Demo\\demo.exe", "", "%ProgramFilesDir%\\Demo", Demo, "%ProgramFilesDir%\\Demo\\demo.exe", 0
"""


def _write_package(tmp: str, text: str = MINI) -> str:
    root = os.path.join(tmp, "Acme", "Demo", "1.2.3")
    os.makedirs(os.path.join(root, "Install"))
    os.makedirs(os.path.join(root, "Files"))
    path = os.path.join(root, "Install", "Setup.inf")
    with open(path, "wb") as fh:
        fh.write(text.replace("\n", "\r\n").encode("cp1252"))
    with open(os.path.join(root, "Files", "setup64.exe"), "wb") as fh:
        fh.write(b"MZ")
    return path


class ParserTests(unittest.TestCase):
    def test_sections_and_values(self):
        inf = parse_inf(MINI)
        self.assertEqual(inf.value("Application", "ProductName"), "Demo")
        self.assertEqual(inf.value("Application", "productname"), "Demo")
        sec = inf.find("Set:Product")
        self.assertIsNotNone(sec)
        self.assertEqual(sec.prefix, "set")
        self.assertTrue(sec.is_script)
        self.assertTrue(inf.find("Reg:Product").is_declarative)
        self.assertTrue(inf.find("Strings:07").is_strings)
        self.assertTrue(inf.find("Product").is_script)
        self.assertTrue(inf.find("Application").is_metadata)
        self.assertIs(inf.resolve("Install"), inf.find("Set:Install"))
        self.assertIs(inf.resolve('"RebootRequired"'), inf.find("RebootRequired"))

    def test_roundtrip_preserves_bytes(self):
        for name in ("MSI.inf", "EXE.inf"):
            path = os.path.join(TEMPLATE_DIR, name)
            with open(path, "rb") as fh:
                data = fh.read()
            inf = load_inf(path)
            self.assertEqual(inf.encoding, "cp1252")
            self.assertEqual(inf.newline, "\r\n")
            out = inf.text().replace("\n", inf.newline).encode(inf.encoding)
            self.assertEqual(out, data, name)

    def test_decode(self):
        self.assertEqual(decode_bytes("für".encode("cp1252"))[1], "cp1252")
        self.assertEqual(decode_bytes("für".encode("utf-8"))[1], "utf-8")
        text, enc, bom = decode_bytes(b"\xef\xbb\xbfx")
        self.assertEqual((text, enc, bom), ("x", "utf-8", True))

    def test_save_and_reload(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_package(tmp)
            inf = load_inf(path)
            inf.find("Application").set("Revision", "7")
            inf.find("Application").set("NewKey", "x")
            inf.save()
            again = load_inf(path)
            self.assertEqual(again.value("Application", "Revision"), "7")
            self.assertEqual(again.value("Application", "NewKey"), "x")
            with open(path, "rb") as fh:
                self.assertIn(b"\r\n", fh.read())

    def test_split_top_level(self):
        parts = split_top_level('"a,b", c, Func(x, y), d')
        self.assertEqual([p.strip() for p in parts], ['"a,b"', "c", "Func(x, y)", "d"])


class StatementTests(unittest.TestCase):
    def _st(self, text, section_name="Set:X"):
        inf = parse_inf(f"[{section_name}]\n{text}\n")
        sec = inf.sections[0]
        return parse_statement(sec.lines[0], sec)

    def test_call(self):
        st = self._st("#Set:Win64, WINDOWS64 DONTDELETE")
        self.assertEqual(st.kind, "call")
        self.assertEqual(st.target, "Set:Win64")
        self.assertEqual(st.flags, ["WINDOWS64", "DONTDELETE"])
        st = self._st("#!Set:Log")
        self.assertTrue(st.force)
        st = self._st("-AddMeter -1")
        self.assertTrue(st.uninstall)
        self.assertEqual(st.name, "addmeter")

    def test_if(self):
        st = self._st('If "%A%" <> "" & "%B%" == "" | DoesRegKeyExist ("HKLM,X\\Y,Z") == "1" Then "Set:Repair" Else "Set:Install" EndIf')
        self.assertEqual(st.kind, "if")
        self.assertEqual(st.error, "")
        self.assertEqual(len(st.conditions), 3)
        self.assertEqual(st.operators, ["&", "|"])
        self.assertEqual(st.conditions[0].op, "<>")
        self.assertEqual(st.conditions[2].lhs, 'DoesRegKeyExist ("HKLM,X\\Y,Z")')
        self.assertEqual(st.then_target, "Set:Repair")
        self.assertEqual(st.else_target, "Set:Install")
        st = self._st('If %V_A% <> %V_B% Then "Set:X" Endif')
        self.assertEqual(st.conditions[0].lhs, "%V_A%")
        self.assertEqual(st.conditions[0].rhs, "%V_B%")
        st = self._st('If "%X%" == "1" Then "Y"')
        self.assertIn("EndIf", st.error)

    def test_for_copy_reg_shell(self):
        st = self._st("For Zaehler,1,%N%,1,Set:CheckOldKeys")
        self.assertEqual((st.kind, st.for_var, st.for_start, st.for_end, st.for_step, st.target),
                         ("for", "Zaehler", "1", "%N%", "1", "Set:CheckOldKeys"))
        st = self._st("1:%SetupInfDir%\\Setup.inf,                             , ALWAYS,  0")
        self.assertEqual((st.kind, st.disk, st.src, st.dst, st.flags, st.size),
                         ("copy", "1", "%SetupInfDir%\\Setup.inf", "", ["ALWAYS"], "0"))
        st = self._st('HKLM,"SOFTWARE\\A\\B","Val",0x00010001,"1"', "Reg:Product")
        self.assertEqual((st.kind, st.root, st.key, st.value, st.reg_flags, st.data),
                         ("reg", "HKLM", "SOFTWARE\\A\\B", "Val", "0x00010001", "1"))
        st = self._st('-HKLM,"SOFTWARE\\A\\Old"', "Reg:Product")
        self.assertTrue(st.delete)
        st = self._st('"%Programs%\\Demo", "C:\\x.exe", "", "C:\\", Demo, "C:\\x.exe", 0', "Shell:Product")
        self.assertEqual(st.kind, "shell")
        self.assertEqual(st.fields[1], "C:\\x.exe")

    def test_set_and_decrement(self):
        st = self._st("Set V_MSIParameter=REBOOT=REALLYSUPPRESS /qn")
        self.assertEqual((st.name, st.args), ("set", "V_MSIParameter=REBOOT=REALLYSUPPRESS /qn"))
        st = self._st("DECREMENT (%V_N%, 1)")
        self.assertEqual((st.name, st.args), ("decrement", "%V_N%, 1"))


class ExpanderTests(unittest.TestCase):
    def setUp(self):
        self.vars = Variables()
        self.vars.set("Name", "Demo")
        self.vars.set("Version", "1.0")
        self.vars.set("Idx", "2")
        self.vars.set("List2", "zwei")
        self.reg = {("HKLM", "software\\acme", "ver"): "9.9"}
        self.exp = Expander(self.vars, lambda r, k, v: self.reg.get((r, k.lower(), v.lower()), ""),
                            lambda f, s, k: f"{s}/{k}")

    def test_basic(self):
        self.assertEqual(self.exp.expand("%Name% %Version%"), "Demo 1.0")
        self.assertEqual(self.exp.expand("%name%"), "Demo")
        self.assertEqual(self.exp.expand("%Unknown%x"), "x")
        self.assertEqual(self.exp.expand("100% sicher"), "100% sicher")

    def test_deferred(self):
        self.assertEqual(self.exp.expand("%%HKLM,\"Software\\Acme\",\"Ver\"%%"),
                         '%HKLM,"Software\\Acme","Ver"%')
        self.assertEqual(self.exp.expand('%HKLM,"Software\\Acme","Ver"%'), "9.9")
        self.assertEqual(self.exp.expand("%%List%Idx%%%"), "%List2%")
        self.assertEqual(self.exp.expand(self.exp.expand("%%List%Idx%%%")), "zwei")

    def test_ini(self):
        self.assertEqual(self.exp.expand("%\\\\srv\\Values$\\x.ini,Sec,Key%"), "Sec/Key")


class CompareTests(unittest.TestCase):
    def test_versions(self):
        self.assertTrue(compare("8.9.8", ">=", "8.9.8"))
        self.assertTrue(compare("152.0.7977.83", ">", "148.0.7778.97"))
        self.assertTrue(compare("8.10.0", ">", "8.9.8"))
        self.assertFalse(compare("8.10.0", ">", "8.9.8", mode="string"))
        self.assertTrue(compare("3010", "==", "3010"))
        self.assertTrue(compare("", "==", ""))
        self.assertTrue(compare("Abc", "==", "abc"))
        self.assertTrue(compare("a", "<>", "b"))
        self.assertTrue(compare("1.0", "!=", "1.1"))


class RunnerTests(unittest.TestCase):
    def _run(self, path, mode="install", backend=None, **kw):
        inf = load_inf(path)
        backend = backend or SimulationBackend(read_real_registry=False)
        opts = RunOptions(mode=mode, **kw)
        runner = Runner(inf, backend, opts)
        return runner.run(), runner, backend

    def test_install_flow(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_package(tmp)
            res, runner, be = self._run(path, env_overrides={"V_List": "a,b,c"})
            self.assertEqual(res.status, Status.SUCCESS, res.summary())
            self.assertEqual(res.message, "Done!")
            v = res.variables
            self.assertEqual(v["V_Arch"], "x64")
            self.assertEqual(v["V_Installer"], "setup64.exe")
            self.assertEqual(v["V_GUID"], "")
            self.assertEqual(v["V_Done"], "1")
            self.assertEqual(v["V_Tokens"], "3")
            self.assertEqual(v["V_List3"], "c")
            self.assertEqual(v["V_Cur"], "c")
            self.assertTrue(v["App"].endswith("\\Acme\\Demo\\1.2.3"))
            self.assertIn("Setup64", v["CommonSetupDir"])
            # Programmaufruf simuliert, Registry und Verknuepfung angelegt
            kinds = [(a.kind, a.operation) for a in res.actions]
            self.assertIn(("Programm", "starten"), kinds)
            self.assertIn(("Verknuepfung", "anlegen"), kinds)
            self.assertTrue(be.reg_key_exists("HKLM", "SOFTWARE\\Acme\\Demo", "Installed"))
            self.assertEqual(be.reg_read("HKLM", "SOFTWARE\\Acme\\Demo", "Installed"), "1")
            self.assertTrue(be.reg_key_exists("HKLM", "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Matrix42 - Acme Demo 1.2.3", "DisplayName"))
            self.assertEqual(be.reg_read("HKLM", "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Matrix42 - Acme Demo 1.2.3", "NoRemove"), "1")
            self.assertTrue(be.reg_key_exists("HKLM", "SOFTWARE\\$Matrix42Packages$\\Acme\\Demo\\1.2.3"))
            # Setup.inf wurde nach %App% kopiert
            copied = [a for a in res.actions if a.kind == "Datei" and a.operation == "kopieren"]
            self.assertTrue(any("Setup.inf" in a.target for a in copied))
            # Echo-Zeilen im Protokoll
            echos = [e.text for e in res.log if e.level == "ECHO"]
            self.assertIn("Produkt x64", echos)
            self.assertIn("Token 2 = b", echos)
            self.assertIn(runner.inf.find("Set:Install").lines[0].number, res.executed_lines)

    def test_install_32bit_and_reboot(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_package(tmp)
            be = SimulationBackend(read_real_registry=False)
            be.default_exit_code = 3010
            res, runner, be = self._run(path, backend=be, bits=32)
            self.assertEqual(res.status, Status.SUCCESS)
            self.assertEqual(res.variables["V_Arch"], "x86")
            self.assertEqual(res.variables["V_Installer"], "setup32.exe")
            self.assertEqual(res.reboot, "SetReboot 1")
            self.assertEqual(res.error_level, "3010")

    def test_install_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_package(tmp)
            be = SimulationBackend(read_real_registry=False)
            be.exit_code_rules = [("*setup64.exe*", 1603)]
            res, runner, be = self._run(path, backend=be)
            self.assertEqual(res.status, Status.FAILURE)
            self.assertEqual(res.message, "Fehler 1603")
            self.assertFalse(be.reg_key_exists("HKLM", "SOFTWARE\\Acme\\Demo", "Installed"))
            self.assertTrue(any(a.kind == "Fehlerprotokoll" for a in res.actions))

    def test_repair_and_skip(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_package(tmp)
            be = SimulationBackend(read_real_registry=False)
            key = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{GUID-1}"
            be.reg_write("HKLM", key, "DisplayName", 0, "Demo App")
            be.reg_write("HKLM", key, "DisplayVersion", 0, "1.0.0")
            be.actions.clear()
            res, runner, be = self._run(path, backend=be)
            self.assertEqual(res.status, Status.SUCCESS)
            self.assertEqual(res.variables["V_GUID"], "{GUID-1}")
            self.assertEqual(res.variables["V_Installed"], "1.0.0")
            self.assertIn("Repair", [e.text for e in res.log if e.level == "ECHO"])
            # neuere Version installiert -> Exit
            be.reg_write("HKLM", key, "DisplayVersion", 0, "2.0")
            res, runner, be = self._run(path, backend=be)
            self.assertEqual(res.status, Status.SUCCESS)
            self.assertEqual(res.message, "Schon installiert: 2.0")
            self.assertNotIn("V_Done", res.variables)

    def test_uninstall_flow(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_package(tmp)
            be = SimulationBackend(read_real_registry=False)
            res, runner, be = self._run(path, backend=be)
            self.assertEqual(res.status, Status.SUCCESS)
            be.actions.clear()
            res2, runner2, be = self._run(path, mode="uninstall", backend=be)
            self.assertEqual(res2.status, Status.SUCCESS, res2.summary())
            # Set-Zeilen laufen rueckwaerts mit, Variablen aus [Set:Win64] gesetzt
            self.assertEqual(res2.variables["V_Arch"], "x64")
            self.assertEqual(res2.variables["ErrorLogMessage"], "Deinstallation")
            ops = [(a.kind, a.operation) for a in res2.actions]
            self.assertIn(("Programm", "starten"), ops)
            self.assertIn(("Datei", "loeschen"), ops)
            self.assertIn(("Verknuepfung", "loeschen"), ops)
            # Reihenfolge: -Call vor -Del (Zeilen rueckwaerts)
            targets = [a.target for a in res2.actions if a.kind in ("Programm", "Datei")]
            self.assertLess([i for i, t in enumerate(targets) if "uninstall.exe" in t][0],
                            [i for i, t in enumerate(targets) if "Demo.log" in t][0])
            # Nur -Zeilen: der Installationsaufruf lief nicht
            self.assertFalse(any("setup64.exe" in a.target for a in res2.actions))
            self.assertFalse(be.reg_key_exists("HKLM", "SOFTWARE\\Acme\\Demo", "Installed"))
            self.assertFalse(be.reg_key_exists("HKLM", "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Matrix42 - Acme Demo 1.2.3"))
            self.assertEqual(res2.variables["V_Done"] if "V_Done" in res2.variables else "", "")

    def test_mixed_mode_executes_programs(self):
        # Mischmodus: Programmaufrufe laufen wirklich, der echte Rueckgabewert landet in %ErrorLevel%
        text = MINI.replace('Call "%Src%\\%V_SourceDir%\\%V_Installer%" /S', 'Call sh -c "exit 7"')
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_package(tmp, text)
            be = SimulationBackend(read_real_registry=False)
            be.execute_programs = True
            res, runner, be = self._run(path, backend=be)
            self.assertEqual(res.status, Status.FAILURE)
            self.assertEqual(res.error_level, "7")
            prog = [a for a in res.actions if a.kind == "Programm"]
            self.assertTrue(prog and prog[0].executed and "wirklich" in prog[0].detail)
            # Einzelfall ueber den call_hook
            be = SimulationBackend(read_real_registry=False)
            be.call_hook = lambda cmd, hidden: SimulationBackend.EXECUTE
            res, runner, be = self._run(path, backend=be)
            self.assertEqual(res.error_level, "7")
            be = SimulationBackend(read_real_registry=False)
            be.call_hook = lambda cmd, hidden: 0
            res, runner, be = self._run(path, backend=be)
            self.assertEqual(res.status, Status.SUCCESS)

    def test_command_line_switches(self):
        opts = RunOptions.from_command_line('Setup.exe "C:\\p\\Setup.inf" /S2 /U /AW')
        self.assertEqual((opts.mode, opts.user_part, opts.display_level), ("uninstall", True, 2))
        self.assertEqual(opts.switches(), "/S2 /U /AW")

    def test_once_rule_and_force(self):
        text = MINI.replace("[Set:Registered]\n", "[Set:Registered]\n#Set:Twice\n#Set:Twice\n#!Set:Twice\n") + \
            "\n[Set:Twice]\nEcho twice\n"
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_package(tmp, text)
            res, runner, be = self._run(path)
            self.assertEqual([e.text for e in res.log if e.level == "ECHO"].count("twice"), 2)
            res, runner, be = self._run(path, once_rule=False)
            self.assertEqual([e.text for e in res.log if e.level == "ECHO"].count("twice"), 3)

    def test_real_templates_run(self):
        for name in ("MSI.inf", "EXE.inf"):
            inf = load_inf(os.path.join(TEMPLATE_DIR, name))
            for mode in ("install", "uninstall"):
                res = Runner(inf, SimulationBackend(read_real_registry=False), RunOptions(mode=mode)).run()
                self.assertIn(res.status, (Status.SUCCESS, Status.FAILURE), f"{name} {mode}: {res.summary()}")
                self.assertFalse(any("Interner Fehler" in e.text for e in res.log), name)

    def test_platform_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_package(tmp, MINI.replace("Platform=*", "Platform=x64"))
            res, runner, be = self._run(path, bits=32)
            self.assertEqual(res.status, Status.FAILURE)
            self.assertIn("x64", res.message)

    def test_step_hook_and_stop(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_package(tmp)
            inf = load_inf(path)
            seen = []

            def hook(st, runner):
                seen.append(st.number)
                if len(seen) == 3:
                    runner.stop_flag.set()

            res = Runner(inf, SimulationBackend(read_real_registry=False), RunOptions(), step_hook=hook).run()
            self.assertEqual(res.status, Status.STOPPED)
            self.assertEqual(len(seen), 3)


class ValidatorTests(unittest.TestCase):
    def test_clean_package(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = _write_package(tmp)
            findings = validate(load_inf(path))
            errors = [f for f in findings if f.level == "Fehler"]
            self.assertEqual(errors, [], [str(f) for f in errors])
            texts = " ".join(f.text for f in findings)
            self.assertIn("V_List", texts)   # nirgends definiert -> Warnung

    def test_findings(self):
        broken = MINI.replace('Then "Set:Skip" EndIf', 'Then "Set:Missing"') \
                     .replace("[Set:Fail]", "[Set:Fail]\nIf DoesRegKeyExist (\"SOFTWARE\\x\") == \"1\" Then \"Set:Skip\" EndIf") \
                     .replace('HKLM,"SOFTWARE\\Acme\\Demo","Installed",0x00010001,"1"', 'HKLM,"SOFTWARE\\Acme\\Demo","Installed",0x00010001,"eins"')
        findings = validate(parse_inf(broken))
        texts = [f.text for f in findings]
        self.assertTrue(any("EndIf fehlt" in t for t in texts), texts)
        self.assertTrue(any("Set:Missing" in t and "existiert aber nicht" in t for t in texts), texts)
        self.assertTrue(any("HKLM,Schluessel" in t for t in texts), texts)
        self.assertTrue(any("REG_DWORD" in t for t in texts), texts)

    def test_templates_have_no_errors(self):
        for name in ("MSI.inf", "EXE.inf"):
            findings = validate(load_inf(os.path.join(TEMPLATE_DIR, name)))
            errors = [str(f) for f in findings if f.level == "Fehler"]
            self.assertEqual(errors, [], name)


class PackageTests(unittest.TestCase):
    def test_create_find_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            installer = os.path.join(tmp, "app-setup.exe")
            with open(installer, "wb") as fh:
                fh.write(b"MZ")
            spec = PackageSpec(template="EXE.inf", developer="Acme", product="Tool", version="2.0",
                               author="Tester", installer=installer, install_params="/S",
                               uninstall_params="/S", display_name="Acme Tool", arch="x64",
                               platform="x64", processes=[("tool.exe", "Acme Tool")])
            store = os.path.join(tmp, "store")
            path = create_package(spec, store)
            self.assertTrue(path.endswith(os.path.join("Acme", "Tool", "2.0", "Install", "Setup.inf")))
            self.assertTrue(os.path.isfile(os.path.join(store, "Acme", "Tool", "2.0", "Files", "app-setup.exe")))
            inf = load_inf(path)
            self.assertEqual(inf.encoding, "cp1252")
            self.assertEqual(inf.value("Application", "ProductName"), "Tool")
            self.assertEqual(inf.value("Setup", "Platform"), "x64")
            self.assertIsNone(inf.find("Set:Win32"))
            self.assertEqual(inf.find("Set:Win64").get("Set V_UnattendFileName"), "app-setup.exe")
            self.assertEqual(inf.find("Set:Win64").get("Set V_UnattendDisplayName"), "Acme Tool")
            self.assertIn("tool.exe", inf.find("Processes").get("Proc1"))
            self.assertTrue(any("AskKillProcesses 600, Proc1" == ln.text for ln in inf.find("Set:CloseApplication").lines))
            self.assertIn("Tester", inf.value("SetupInfo", "Author"))
            self.assertEqual([str(f) for f in validate(inf) if f.level == "Fehler"], [])
            # Simulation laeuft durch
            res = Runner(inf, SimulationBackend(read_real_registry=False), RunOptions()).run()
            self.assertIn(res.status, (Status.SUCCESS, Status.FAILURE))
            pkgs = find_packages(store)
            self.assertEqual(len(pkgs), 1)
            self.assertEqual(pkgs[0].label, "Acme Tool 2.0")
            zip_path = os.path.join(tmp, "out.zip")
            n = export_zip(pkgs[0].root, zip_path)
            self.assertGreaterEqual(n, 2)
            with self.assertRaises(FileExistsError):
                create_package(spec, store)

    def test_reg_import(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "x.reg")
            with open(path, "w", encoding="utf-16") as fh:
                fh.write('Windows Registry Editor Version 5.00\r\n\r\n'
                         '[HKEY_LOCAL_MACHINE\\SOFTWARE\\Acme\\Demo]\r\n'
                         '"Name"="Wert \\"x\\""\r\n"Zahl"=dword:0000000a\r\n"Weg"=-\r\n'
                         '@="Standard"\r\n\r\n[-HKEY_CURRENT_USER\\Software\\Old]\r\n')
            lines = import_reg_file(path)
            self.assertEqual(lines[0], 'HKLM,"SOFTWARE\\Acme\\Demo"')
            self.assertIn('HKLM,"SOFTWARE\\Acme\\Demo","Name",0x00000000,"Wert "x""', lines)
            self.assertIn('HKLM,"SOFTWARE\\Acme\\Demo","Zahl",0x00010001,"10"', lines)
            self.assertIn('-HKLM,"SOFTWARE\\Acme\\Demo","Weg"', lines)
            self.assertIn('HKLM,"SOFTWARE\\Acme\\Demo","",0x00000000,"Standard"', lines)
            self.assertIn('-HKCU,"Software\\Old"', lines)


if __name__ == "__main__":
    unittest.main(verbosity=1)
