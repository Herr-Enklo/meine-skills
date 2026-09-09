"""Variablen und ihre Expansion.

Empirum schreibt Variablen als ``%Name%``. Der Interpreter ersetzt sie in
einem Durchlauf von links nach rechts:

* ``%Name%``            Wert der Variable (unbekannt = leer)
* ``%%``                ein literales ``%``; so schiebt man eine Ersetzung
                        auf, bis ``ReplaceEnv`` den Wert erneut expandiert
* ``%HKLM,"Key","Wert"%``   Registry lesen
* ``%\\\\srv\\x.ini,Sektion,Schluessel%``  INI-Datei lesen (Werte$-Freigabe)

``Set`` expandiert die rechte Seite einmal bei der Zuweisung. Was durch
``%%`` aufgeschoben wurde, expandiert erst ``ReplaceEnv``. Deshalb steht in
den Vorlagen hinter jedem ``Set V=%%HKLM,...%%`` ein ``ReplaceEnv V``.
"""

from __future__ import annotations

import os
import platform
import re
from typing import Callable

# Variablenname: Buchstaben, Ziffern, _ . ( ) - und $ (z. B. ProgramFiles(x86), OS.DisplayString)
_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_.()\-$]*$")
_REG_RE = re.compile(r"^(HKLM|HKCU|HKCR|HKU|HKCC|HKEY_[A-Z_]+)\s*,", re.IGNORECASE)


class Variables:
    """Variablentabelle ohne Beachtung der Gross-/Kleinschreibung."""

    def __init__(self) -> None:
        self._values: dict[str, str] = {}
        self._names: dict[str, str] = {}   # lower -> Schreibweise
        self.unknown: list[str] = []       # zur Diagnose: unbekannte Namen

    def set(self, name: str, value: str) -> None:
        key = name.strip().lower()
        self._values[key] = value
        self._names.setdefault(key, name.strip())

    def get(self, name: str, default: str | None = None) -> str | None:
        return self._values.get(name.strip().lower(), default)

    def has(self, name: str) -> bool:
        return name.strip().lower() in self._values

    def delete(self, name: str) -> None:
        self._values.pop(name.strip().lower(), None)

    def items(self) -> list[tuple[str, str]]:
        return sorted(((self._names[k], v) for k, v in self._values.items()),
                      key=lambda kv: kv[0].lower())

    def snapshot(self) -> dict[str, str]:
        return {self._names[k]: v for k, v in self._values.items()}

    def copy(self) -> "Variables":
        other = Variables()
        other._values = dict(self._values)
        other._names = dict(self._names)
        return other


class Expander:
    """Ersetzt ``%...%`` in Texten.

    ``reg_read(root, key, value)`` und ``ini_read(file, section, key)`` sind
    Rueckrufe des Backends; sie liefern "" wenn nichts gefunden wurde.
    """

    def __init__(self, variables: Variables,
                 reg_read: Callable[[str, str, str], str] | None = None,
                 ini_read: Callable[[str, str, str], str] | None = None,
                 on_unknown: Callable[[str], None] | None = None) -> None:
        self.vars = variables
        self.reg_read = reg_read or (lambda r, k, v: "")
        self.ini_read = ini_read or (lambda f, s, k: "")
        self.on_unknown = on_unknown

    def expand(self, text: str) -> str:
        if "%" not in text:
            return text
        out: list[str] = []
        i = 0
        n = len(text)
        while i < n:
            ch = text[i]
            if ch != "%":
                out.append(ch)
                i += 1
                continue
            # "%%" -> literales "%"
            if i + 1 < n and text[i + 1] == "%":
                out.append("%")
                i += 2
                continue
            j = text.find("%", i + 1)
            if j < 0:
                out.append(text[i:])
                break
            token = text[i + 1:j]
            resolved = self._resolve(token)
            if resolved is None:
                # nicht aufloesbar: "%" literal lassen, dahinter weitersuchen
                out.append("%")
                i += 1
                continue
            out.append(resolved)
            i = j + 1
        return "".join(out)

    def _resolve(self, token: str) -> str | None:
        t = token.strip()
        if not t:
            return None
        if _REG_RE.match(t):
            return self._resolve_registry(t)
        if _NAME_RE.match(t):
            value = self.vars.get(t)
            if value is None:
                if self.on_unknown:
                    self.on_unknown(t)
                return ""
            return value
        if "," in t and (".ini" in t.lower() or t.startswith("\\\\")):
            return self._resolve_ini(t)
        return None

    def _resolve_registry(self, token: str) -> str:
        from .inf import split_top_level, unquote
        parts = [unquote(p) for p in split_top_level(token, ",")]
        root = parts[0].strip().upper()
        key = parts[1].strip() if len(parts) > 1 else ""
        value = parts[2].strip() if len(parts) > 2 else ""
        try:
            return self.reg_read(root, key, value) or ""
        except Exception:
            return ""

    def _resolve_ini(self, token: str) -> str:
        from .inf import split_top_level, unquote
        parts = [unquote(p) for p in split_top_level(token, ",")]
        if len(parts) < 3:
            return ""
        try:
            return self.ini_read(parts[0].strip(), parts[1].strip(), parts[2].strip()) or ""
        except Exception:
            return ""


# -- Vordefinierte Variablen ------------------------------------------------

def default_environment(bits: int = 64) -> dict[str, str]:
    """Vordefinierte Variablen, wie Setup.exe sie auf einem Client setzt.

    Unter Windows kommen die echten Werte aus der Umgebung. Auf anderen
    Systemen (Simulation) werden uebliche Windows-Pfade angenommen; die
    Testumgebung im Editor kann jeden Wert ueberschreiben.
    """
    env = os.environ
    is_windows = platform.system() == "Windows"

    def e(name: str, fallback: str) -> str:
        return env.get(name, fallback) if is_windows else fallback

    program_files = e("ProgramW6432", e("ProgramFiles", "C:\\Program Files"))
    program_files_x86 = e("ProgramFiles(x86)", "C:\\Program Files (x86)")
    common_files = e("CommonProgramW6432", e("CommonProgramFiles", "C:\\Program Files\\Common Files"))
    common_files_x86 = e("CommonProgramFiles(x86)", "C:\\Program Files (x86)\\Common Files")
    program_data = e("ProgramData", "C:\\ProgramData")
    windir = e("SystemRoot", e("windir", "C:\\Windows"))
    system_drive = e("SystemDrive", "C:")
    temp = e("TEMP", "C:\\Windows\\Temp")
    user = e("USERNAME", "Tester")
    profile = e("USERPROFILE", f"C:\\Users\\{user}")
    appdata = e("APPDATA", f"{profile}\\AppData\\Roaming")
    local_appdata = e("LOCALAPPDATA", f"{profile}\\AppData\\Local")
    public = e("PUBLIC", "C:\\Users\\Public")
    computer = e("COMPUTERNAME", "TESTPC")
    domain = e("USERDOMAIN", "WORKGROUP")
    dns_domain = e("USERDNSDOMAIN", "")

    if bits == 32:
        program_files = program_files_x86
        common_files = common_files_x86

    values = {
        # Pfade
        "ProgramFilesDir": program_files,
        "ProgramFiles": program_files,
        "ProgramFilesDirx86": program_files_x86,
        "ProgramFiles(x86)": program_files_x86,
        "ProgramW6432": program_files,
        "CommonFilesDir": common_files,
        "CommonProgramFiles": common_files,
        "CommonFilesDirx86": common_files_x86,
        "CommonAppData": program_data,
        "ProgramData": program_data,
        "CommonDesktop": f"{public}\\Desktop",
        "CommonPrograms": f"{program_data}\\Microsoft\\Windows\\Start Menu\\Programs",
        "CommonStartMenu": f"{program_data}\\Microsoft\\Windows\\Start Menu",
        "CommonStartup": f"{program_data}\\Microsoft\\Windows\\Start Menu\\Programs\\StartUp",
        "Programs": f"{appdata}\\Microsoft\\Windows\\Start Menu\\Programs",
        "StartMenu": f"{appdata}\\Microsoft\\Windows\\Start Menu",
        "Startup": f"{appdata}\\Microsoft\\Windows\\Start Menu\\Programs\\Startup",
        "Desktop": f"{profile}\\Desktop",
        "Personal": f"{profile}\\Documents",
        "AppData": appdata,
        "LocalAppData": local_appdata,
        "UserProfile": profile,
        "Public": public,
        "Sendto": f"{appdata}\\Microsoft\\Windows\\SendTo",
        "Favorites": f"{profile}\\Favorites",
        "System": f"{windir}\\System32",
        "SystemDir": f"{windir}\\System32",
        "System32": f"{windir}\\System32",
        "SysWOW64": f"{windir}\\SysWOW64",
        "windir": windir,
        "WinDir": windir,
        "SystemRoot": windir,
        "SystemDrive": system_drive,
        "Temp": temp,
        "TMP": temp,
        # Rechner und Benutzer
        "ComputerName": computer,
        "WindowsUser": user,
        "UserName": user,
        "UserDomain": domain,
        "DomainName": dns_domain or domain,
        "LogonServer": e("LOGONSERVER", "\\\\DC01"),
        # Empirum
        "EmpirumServer": "EMPIRUM01",
        "Company": "",
        "SetupBits": str(bits),
        "Language": "09",
        "WindowsVersion": _windows_version(),
        "OS.DisplayString": _windows_display_string(),
        "OSVersion": _windows_version(),
        "ErrorLevel": "0",
        "SoftwareDepotDistributionFlags": "0",
    }
    return values


def _windows_version() -> str:
    if platform.system() == "Windows":
        try:
            v = platform.version()
            return v
        except Exception:
            pass
    return "10.0.22621"


def _windows_display_string() -> str:
    if platform.system() == "Windows":
        try:
            return f"Windows {platform.release()} {platform.version()}"
        except Exception:
            pass
    return "Windows 11 Enterprise (22H2)"
