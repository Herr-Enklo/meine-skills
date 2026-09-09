"""Backends: Was der Interpreter mit dem System macht.

``SimulationBackend`` aendert nichts am Rechner. Lesende Zugriffe (Dateien,
unter Windows auch die Registry) gehen ans echte System, damit Bedingungen
wie ``DoesRegKeyExist`` realistisch ausgewertet werden. Schreibende
Zugriffe landen in einer Ueberlagerung, die spaetere Lesezugriffe im selben
Lauf sehen. Programme werden nicht gestartet; ihr Rueckgabewert kommt aus
einer Vorgabe oder, im Editor, aus einer Rueckfrage.

``WindowsBackend`` fuehrt alles wirklich aus (Registry, Dateien, Prozesse,
Verknuepfungen). Es ist fuer den Test auf einem Windows-Testrechner mit
Administratorrechten gedacht.
"""

from __future__ import annotations

import fnmatch
import os
import platform
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from typing import Callable

try:  # nur unter Windows vorhanden
    import winreg  # type: ignore
except ImportError:  # pragma: no cover - Linux/macOS
    winreg = None  # type: ignore

IS_WINDOWS = platform.system() == "Windows"

REG_SZ = 0x00000000
REG_BINARY = 0x00000001
REG_MULTI_SZ = 0x00010000
REG_DWORD = 0x00010001
REG_EXPAND_SZ = 0x00020000
FLG_NOCLOBBER = 0x00000002

_ROOT_ALIASES = {
    "HKLM": "HKLM", "HKEY_LOCAL_MACHINE": "HKLM",
    "HKCU": "HKCU", "HKEY_CURRENT_USER": "HKCU",
    "HKCR": "HKCR", "HKEY_CLASSES_ROOT": "HKCR",
    "HKU": "HKU", "HKEY_USERS": "HKU",
    "HKCC": "HKCC", "HKEY_CURRENT_CONFIG": "HKCC",
}

UNINSTALL_KEY = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
UNINSTALL_KEY_WOW = "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"


def normalize_root(root: str) -> str:
    return _ROOT_ALIASES.get(root.strip().upper(), root.strip().upper())


def reg_type_name(flags: int) -> str:
    if flags & REG_DWORD == REG_DWORD:
        return "REG_DWORD"
    if flags & REG_EXPAND_SZ:
        return "REG_EXPAND_SZ"
    if flags & REG_MULTI_SZ:
        return "REG_MULTI_SZ"
    if flags & REG_BINARY:
        return "REG_BINARY"
    return "REG_SZ"


def parse_reg_flags(text: str) -> int:
    t = text.strip()
    if not t:
        return REG_SZ
    try:
        return int(t, 16) if t.lower().startswith("0x") else int(t)
    except ValueError:
        return REG_SZ


@dataclass
class Action:
    """Eine Aenderung am System (simuliert oder ausgefuehrt)."""

    kind: str          # z. B. "Registry", "Datei", "Programm", "Verknuepfung"
    operation: str     # z. B. "schreiben", "loeschen", "kopieren", "starten"
    target: str
    detail: str = ""
    executed: bool = False

    def __str__(self) -> str:
        mode = "ausgefuehrt" if self.executed else "simuliert"
        d = f"  ({self.detail})" if self.detail else ""
        return f"[{mode}] {self.kind} {self.operation}: {self.target}{d}"


class Backend:
    """Gemeinsame Schnittstelle. Unterklassen fuellen die Methoden."""

    name = "Backend"
    executes = False

    def __init__(self) -> None:
        self.actions: list[Action] = []
        # Rueckfrage fuer Programmaufrufe (Simulation): liefert Exit-Code oder None
        self.call_hook: Callable[[str, bool], int | None] | None = None
        self.default_exit_code = 0
        self.log: Callable[[str, str], None] = lambda level, text: None

    def record(self, kind: str, operation: str, target: str, detail: str = "") -> Action:
        a = Action(kind, operation, target, detail, executed=self.executes)
        self.actions.append(a)
        return a

    # Programme
    def run(self, cmdline: str, hidden: bool = False, timeout: float | None = None,
            wait: bool = True) -> int:
        raise NotImplementedError

    # Dateien
    def file_exists(self, path: str) -> bool:
        raise NotImplementedError

    def dir_exists(self, path: str) -> bool:
        raise NotImplementedError

    def text_in_file(self, text: str, path: str) -> bool:
        try:
            with open(path, "rb") as fh:
                data = fh.read()
        except OSError:
            return False
        for enc in ("utf-8", "utf-16", "cp1252"):
            try:
                content = data.decode(enc)
            except UnicodeDecodeError:
                continue
            if text.lower() in content.lower():
                return True
        return False

    def copy_file(self, src: str, dst: str, only_if_newer: bool = False) -> bool:
        raise NotImplementedError

    def delete_file(self, path: str) -> bool:
        raise NotImplementedError

    def delete_tree(self, path: str) -> bool:
        raise NotImplementedError

    def make_dir(self, path: str) -> bool:
        raise NotImplementedError

    def remove_dir(self, path: str) -> bool:
        raise NotImplementedError

    def rename(self, old: str, new: str) -> bool:
        raise NotImplementedError

    # Registry
    def reg_read(self, root: str, key: str, value: str = "") -> str:
        raise NotImplementedError

    def reg_key_exists(self, root: str, key: str, value: str | None = None) -> bool:
        raise NotImplementedError

    def reg_subkeys(self, root: str, key: str) -> list[str]:
        raise NotImplementedError

    def reg_write(self, root: str, key: str, value: str, flags: int, data: str) -> None:
        raise NotImplementedError

    def reg_delete_value(self, root: str, key: str, value: str) -> None:
        raise NotImplementedError

    def reg_delete_key(self, root: str, key: str) -> None:
        raise NotImplementedError

    # Verknuepfungen, Prozesse, Sonstiges
    def create_shortcut(self, link: str, target: str, args: str = "", workdir: str = "",
                        description: str = "", icon: str = "", icon_index: int = 0) -> None:
        raise NotImplementedError

    def delete_shortcut(self, link: str) -> None:
        raise NotImplementedError

    def process_exists(self, name: str) -> bool:
        return _process_exists(name)

    def kill_process(self, name: str) -> bool:
        raise NotImplementedError

    def service_control(self, name: str, action: str) -> int:
        raise NotImplementedError

    def sleep(self, ms: int) -> None:
        time.sleep(ms / 1000.0)

    def ini_read(self, path: str, section: str, key: str) -> str:
        return _ini_read(path, section, key)

    def read_xml(self, path: str, xpath: str) -> str:
        return _read_xml(path, xpath)

    def file_version(self, path: str) -> str:
        return _file_version(path)

    # Hilfen
    def find_uninstall_key(self, display_name: str, arch: str = "") -> str:
        """Schluesselname unter ...\\Uninstall zu einem DisplayName (Muster mit * erlaubt)."""
        arch = arch.strip().strip('"').lower()
        if arch in ("x86", "32", "wow"):
            keys = [UNINSTALL_KEY_WOW]
        elif arch in ("x64", "64"):
            keys = [UNINSTALL_KEY]
        else:
            keys = [UNINSTALL_KEY, UNINSTALL_KEY_WOW]
        pattern = display_name.strip().strip('"')
        if not pattern:
            return ""
        for base in keys:
            for sub in self.reg_subkeys("HKLM", base):
                if sub.lower() == pattern.lower():
                    return sub
                name = self.reg_read("HKLM", base + "\\" + sub, "DisplayName")
                if name and fnmatch.fnmatchcase(name.lower(), pattern.lower()):
                    return sub
        return ""


# --------------------------------------------------------------------------
# Simulation

class SimulationBackend(Backend):
    name = "Simulation"
    executes = False

    def __init__(self, read_real_registry: bool = True, read_real_files: bool = True) -> None:
        super().__init__()
        self.read_real_registry = read_real_registry and winreg is not None
        self.read_real_files = read_real_files
        self.real = WindowsBackend() if winreg is not None else None
        # Ueberlagerung: (root, key.lower()) -> {value.lower(): (name, flags, data)}
        self.reg: dict[tuple[str, str], dict[str, tuple[str, int, str]]] = {}
        self.reg_key_names: dict[tuple[str, str], str] = {}
        self.reg_deleted_keys: set[tuple[str, str]] = set()
        self.reg_deleted_values: set[tuple[str, str, str]] = set()
        self.files_created: dict[str, str] = {}
        self.files_deleted: set[str] = set()
        self.dirs_created: set[str] = set()
        self.shortcuts: dict[str, str] = {}
        self.killed: list[str] = []
        self.simulate_sleep = False
        # Vorgaben fuer Exit-Codes: Muster (fnmatch auf Kommandozeile) -> Code
        self.exit_code_rules: list[tuple[str, int]] = []

    # -- Programme ---------------------------------------------------------
    def run(self, cmdline: str, hidden: bool = False, timeout: float | None = None,
            wait: bool = True) -> int:
        code: int | None = None
        for pattern, value in self.exit_code_rules:
            if fnmatch.fnmatch(cmdline.lower(), pattern.lower()):
                code = value
                break
        if self.call_hook is not None:
            answer = self.call_hook(cmdline, hidden)
            if answer is not None:
                code = answer
        if code is None:
            code = self.default_exit_code
        how = "versteckt" if hidden else "sichtbar"
        self.record("Programm", "starten", cmdline, f"{how}, angenommener Rueckgabewert {code}")
        return code

    # -- Dateien -----------------------------------------------------------
    def _norm(self, path: str) -> str:
        return os.path.normpath(path).lower()

    def file_exists(self, path: str) -> bool:
        p = self._norm(path)
        if p in self.files_created:
            return True
        if p in self.files_deleted or self._under_deleted(p):
            return False
        return self.read_real_files and os.path.isfile(_local(path))

    def dir_exists(self, path: str) -> bool:
        p = self._norm(path)
        if p in self.dirs_created:
            return True
        if p in self.files_deleted:
            return False
        for created in list(self.files_created) + list(self.dirs_created):
            if created.startswith(p + os.sep) or created.startswith(p + "\\"):
                return True
        return self.read_real_files and os.path.isdir(_local(path))

    def _under_deleted(self, p: str) -> bool:
        return any(p.startswith(d + "\\") or p.startswith(d + os.sep) for d in self.files_deleted)

    def copy_file(self, src: str, dst: str, only_if_newer: bool = False) -> bool:
        exists = self.file_exists(src)
        detail = "" if exists else "Quelle nicht gefunden"
        self.record("Datei", "kopieren", f"{src} -> {dst}", detail)
        if not exists:
            return False
        self.files_created[self._norm(dst)] = src
        self.files_deleted.discard(self._norm(dst))
        return True

    def delete_file(self, path: str) -> bool:
        self.record("Datei", "loeschen", path)
        p = self._norm(path)
        self.files_created.pop(p, None)
        self.files_deleted.add(p)
        return True

    def delete_tree(self, path: str) -> bool:
        self.record("Ordner", "loeschen (rekursiv)", path)
        p = self._norm(path)
        for k in list(self.files_created):
            if k == p or k.startswith(p + "\\") or k.startswith(p + os.sep):
                del self.files_created[k]
        self.dirs_created.discard(p)
        self.files_deleted.add(p)
        return True

    def make_dir(self, path: str) -> bool:
        self.record("Ordner", "anlegen", path)
        self.dirs_created.add(self._norm(path))
        return True

    def remove_dir(self, path: str) -> bool:
        self.record("Ordner", "entfernen", path)
        self.dirs_created.discard(self._norm(path))
        self.files_deleted.add(self._norm(path))
        return True

    def rename(self, old: str, new: str) -> bool:
        self.record("Datei", "umbenennen", f"{old} -> {new}")
        self.files_created[self._norm(new)] = old
        self.files_deleted.add(self._norm(old))
        return True

    # -- Registry ----------------------------------------------------------
    def _rk(self, root: str, key: str) -> tuple[str, str]:
        return normalize_root(root), key.strip().strip("\\").lower()

    def _key_deleted(self, rk: tuple[str, str]) -> bool:
        root, key = rk
        for droot, dkey in self.reg_deleted_keys:
            if droot == root and (key == dkey or key.startswith(dkey + "\\")):
                # Spaeter neu angelegt?
                return rk not in self.reg and not any(
                    r == root and k.startswith(key + "\\") for (r, k) in self.reg)
        return False

    def reg_read(self, root: str, key: str, value: str = "") -> str:
        rk = self._rk(root, key)
        v = value.strip().lower()
        if (rk[0], rk[1], v) in self.reg_deleted_values or self._key_deleted(rk):
            return ""
        entry = self.reg.get(rk, {}).get(v)
        if entry is not None:
            return entry[2]
        if self.read_real_registry and self.real is not None:
            return self.real.reg_read(root, key, value)
        return ""

    def reg_key_exists(self, root: str, key: str, value: str | None = None) -> bool:
        rk = self._rk(root, key)
        if self._key_deleted(rk):
            return False
        if value is not None and value != "":
            v = value.strip().lower()
            if (rk[0], rk[1], v) in self.reg_deleted_values:
                return False
            if v in self.reg.get(rk, {}):
                return True
            if self.read_real_registry and self.real is not None:
                return self.real.reg_key_exists(root, key, value)
            return False
        if rk in self.reg or any(r == rk[0] and k.startswith(rk[1] + "\\") for (r, k) in self.reg):
            return True
        if self.read_real_registry and self.real is not None:
            return self.real.reg_key_exists(root, key)
        return False

    def reg_subkeys(self, root: str, key: str) -> list[str]:
        rk = self._rk(root, key)
        names: dict[str, str] = {}
        if self.read_real_registry and self.real is not None:
            for n in self.real.reg_subkeys(root, key):
                names[n.lower()] = n
        prefix = rk[1] + "\\"
        for (r, k) in list(self.reg) + list(self.reg_key_names):
            if r == rk[0] and k.startswith(prefix):
                rest = k[len(prefix):].split("\\")[0]
                original = self.reg_key_names.get((r, prefix + rest), rest)
                names.setdefault(rest, original.split("\\")[-1])
        for (r, k) in self.reg_deleted_keys:
            if r == rk[0] and k.startswith(prefix):
                rest = k[len(prefix):].split("\\")[0]
                if (r, prefix + rest) not in self.reg and not self._recreated(r, prefix + rest):
                    names.pop(rest, None)
        return sorted(names.values(), key=str.lower)

    def _recreated(self, root: str, key: str) -> bool:
        return any(r == root and (k == key or k.startswith(key + "\\")) for (r, k) in self.reg)

    def reg_write(self, root: str, key: str, value: str, flags: int, data: str) -> None:
        rk = self._rk(root, key)
        self.reg.setdefault(rk, {})
        self.reg_key_names[rk] = key.strip().strip("\\")
        self.reg_deleted_values.discard((rk[0], rk[1], value.strip().lower()))
        # Schluessel gilt wieder als vorhanden
        self.reg_deleted_keys = {d for d in self.reg_deleted_keys
                                 if not (d[0] == rk[0] and (rk[1] == d[1] or rk[1].startswith(d[1] + "\\")))}
        if value != "" or data != "":
            if flags & FLG_NOCLOBBER and value.strip().lower() in self.reg[rk]:
                self.record("Registry", "schreiben (uebersprungen, NOCLOBBER)",
                            f"{rk[0]}\\{key}\\{value}")
                return
            self.reg[rk][value.strip().lower()] = (value.strip(), flags, data)
            self.record("Registry", "schreiben", f"{rk[0]}\\{key}\\{value or '(Standard)'}",
                        f"{reg_type_name(flags)} = {data}")
        else:
            self.record("Registry", "Schluessel anlegen", f"{rk[0]}\\{key}")

    def reg_delete_value(self, root: str, key: str, value: str) -> None:
        rk = self._rk(root, key)
        self.reg.get(rk, {}).pop(value.strip().lower(), None)
        self.reg_deleted_values.add((rk[0], rk[1], value.strip().lower()))
        self.record("Registry", "Wert loeschen", f"{rk[0]}\\{key}\\{value or '(Standard)'}")

    def reg_delete_key(self, root: str, key: str) -> None:
        rk = self._rk(root, key)
        for k in list(self.reg):
            if k[0] == rk[0] and (k[1] == rk[1] or k[1].startswith(rk[1] + "\\")):
                del self.reg[k]
        self.reg_deleted_keys.add(rk)
        self.record("Registry", "Schluessel loeschen", f"{rk[0]}\\{key}")

    # -- Sonstiges ---------------------------------------------------------
    def create_shortcut(self, link, target, args="", workdir="", description="", icon="", icon_index=0):
        self.shortcuts[self._norm(link)] = target
        self.record("Verknuepfung", "anlegen", link, f"-> {target} {args}".strip())

    def delete_shortcut(self, link):
        self.shortcuts.pop(self._norm(link), None)
        self.record("Verknuepfung", "loeschen", link)

    def kill_process(self, name: str) -> bool:
        self.killed.append(name)
        self.record("Prozess", "beenden", name)
        return True

    def service_control(self, name: str, action: str) -> int:
        self.record("Dienst", action, name)
        return 0

    def sleep(self, ms: int) -> None:
        if self.simulate_sleep:
            time.sleep(min(ms, 2000) / 1000.0)


# --------------------------------------------------------------------------
# Echte Ausfuehrung (Windows)

class WindowsBackend(Backend):
    name = "Windows (echte Ausfuehrung)"
    executes = True

    def __init__(self) -> None:
        super().__init__()
        self.allow_shutdown = False

    # -- Programme ---------------------------------------------------------
    def run(self, cmdline: str, hidden: bool = False, timeout: float | None = None,
            wait: bool = True) -> int:
        self.record("Programm", "starten", cmdline, "versteckt" if hidden else "sichtbar")
        kwargs: dict = {}
        if IS_WINDOWS:
            if hidden:
                si = subprocess.STARTUPINFO()  # type: ignore[attr-defined]
                si.dwFlags |= subprocess.STARTF_USESHOWWINDOW  # type: ignore[attr-defined]
                si.wShowWindow = 0
                kwargs["startupinfo"] = si
                kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
            proc = subprocess.Popen(cmdline, **kwargs)
        else:
            proc = subprocess.Popen(cmdline, shell=True)
        if not wait:
            return 0
        try:
            return proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            proc.kill()
            return -1

    # -- Dateien -----------------------------------------------------------
    def file_exists(self, path: str) -> bool:
        return os.path.isfile(_local(path))

    def dir_exists(self, path: str) -> bool:
        return os.path.isdir(_local(path))

    def copy_file(self, src: str, dst: str, only_if_newer: bool = False) -> bool:
        src_l, dst_l = _local(src), _local(dst)
        if not os.path.isfile(src_l):
            self.record("Datei", "kopieren", f"{src} -> {dst}", "Quelle nicht gefunden")
            return False
        if only_if_newer and os.path.isfile(dst_l) and os.path.getmtime(dst_l) >= os.path.getmtime(src_l):
            self.record("Datei", "kopieren (uebersprungen, Ziel ist aktuell)", f"{src} -> {dst}")
            return True
        os.makedirs(os.path.dirname(dst_l) or ".", exist_ok=True)
        shutil.copy2(src_l, dst_l)
        self.record("Datei", "kopieren", f"{src} -> {dst}")
        return True

    def delete_file(self, path: str) -> bool:
        import glob
        p = _local(path)
        ok = False
        for hit in glob.glob(p) if any(c in p for c in "*?") else [p]:
            if os.path.isfile(hit):
                os.remove(hit)
                ok = True
        self.record("Datei", "loeschen", path, "" if ok else "nicht vorhanden")
        return ok

    def delete_tree(self, path: str) -> bool:
        p = _local(path)
        ok = os.path.isdir(p)
        if ok:
            shutil.rmtree(p, ignore_errors=True)
        self.record("Ordner", "loeschen (rekursiv)", path, "" if ok else "nicht vorhanden")
        return ok

    def make_dir(self, path: str) -> bool:
        os.makedirs(_local(path), exist_ok=True)
        self.record("Ordner", "anlegen", path)
        return True

    def remove_dir(self, path: str) -> bool:
        try:
            os.rmdir(_local(path))
            self.record("Ordner", "entfernen", path)
            return True
        except OSError as exc:
            self.record("Ordner", "entfernen", path, str(exc))
            return False

    def rename(self, old: str, new: str) -> bool:
        try:
            os.replace(_local(old), _local(new))
            self.record("Datei", "umbenennen", f"{old} -> {new}")
            return True
        except OSError as exc:
            self.record("Datei", "umbenennen", f"{old} -> {new}", str(exc))
            return False

    # -- Registry ----------------------------------------------------------
    def _open(self, root: str, key: str, write: bool = False):
        if winreg is None:
            raise OSError("Registry nur unter Windows verfuegbar")
        roots = {
            "HKLM": winreg.HKEY_LOCAL_MACHINE, "HKCU": winreg.HKEY_CURRENT_USER,
            "HKCR": winreg.HKEY_CLASSES_ROOT, "HKU": winreg.HKEY_USERS,
            "HKCC": winreg.HKEY_CURRENT_CONFIG,
        }
        hroot = roots[normalize_root(root)]
        access = winreg.KEY_READ | winreg.KEY_WOW64_64KEY
        if write:
            access |= winreg.KEY_WRITE
            return winreg.CreateKeyEx(hroot, key.strip("\\"), 0, access)
        return winreg.OpenKey(hroot, key.strip("\\"), 0, access)

    def reg_read(self, root: str, key: str, value: str = "") -> str:
        if winreg is None:
            return ""
        try:
            with self._open(root, key) as h:
                data, kind = winreg.QueryValueEx(h, value)
        except OSError:
            return ""
        if isinstance(data, bytes):
            return data.hex()
        if isinstance(data, list):
            return "\n".join(str(x) for x in data)
        return str(data)

    def reg_key_exists(self, root: str, key: str, value: str | None = None) -> bool:
        if winreg is None:
            return False
        try:
            with self._open(root, key) as h:
                if value is None or value == "":
                    return True
                winreg.QueryValueEx(h, value)
                return True
        except OSError:
            return False

    def reg_subkeys(self, root: str, key: str) -> list[str]:
        if winreg is None:
            return []
        names: list[str] = []
        try:
            with self._open(root, key) as h:
                i = 0
                while True:
                    try:
                        names.append(winreg.EnumKey(h, i))
                        i += 1
                    except OSError:
                        break
        except OSError:
            pass
        return names

    def reg_write(self, root: str, key: str, value: str, flags: int, data: str) -> None:
        if winreg is None:
            raise OSError("Registry nur unter Windows verfuegbar")
        with self._open(root, key, write=True) as h:
            if value == "" and data == "":
                self.record("Registry", "Schluessel anlegen", f"{normalize_root(root)}\\{key}")
                return
            if flags & FLG_NOCLOBBER:
                try:
                    winreg.QueryValueEx(h, value)
                    self.record("Registry", "schreiben (uebersprungen, NOCLOBBER)",
                                f"{normalize_root(root)}\\{key}\\{value}")
                    return
                except OSError:
                    pass
            tname = reg_type_name(flags)
            if tname == "REG_DWORD":
                num = int(data.strip(), 16) if data.strip().lower().startswith("0x") else int(data.strip() or "0")
                winreg.SetValueEx(h, value, 0, winreg.REG_DWORD, num)
            elif tname == "REG_EXPAND_SZ":
                winreg.SetValueEx(h, value, 0, winreg.REG_EXPAND_SZ, data)
            elif tname == "REG_MULTI_SZ":
                winreg.SetValueEx(h, value, 0, winreg.REG_MULTI_SZ, data.split("\\0") if data else [])
            elif tname == "REG_BINARY":
                winreg.SetValueEx(h, value, 0, winreg.REG_BINARY, bytes.fromhex(data.replace(",", "").replace(" ", "")))
            else:
                winreg.SetValueEx(h, value, 0, winreg.REG_SZ, data)
        self.record("Registry", "schreiben", f"{normalize_root(root)}\\{key}\\{value or '(Standard)'}",
                    f"{reg_type_name(flags)} = {data}")

    def reg_delete_value(self, root: str, key: str, value: str) -> None:
        if winreg is None:
            return
        try:
            with self._open(root, key, write=True) as h:
                winreg.DeleteValue(h, value)
            self.record("Registry", "Wert loeschen", f"{normalize_root(root)}\\{key}\\{value}")
        except OSError as exc:
            self.record("Registry", "Wert loeschen", f"{normalize_root(root)}\\{key}\\{value}", str(exc))

    def reg_delete_key(self, root: str, key: str) -> None:
        if winreg is None:
            return
        # rekursiv: erst Unterschluessel
        for sub in self.reg_subkeys(root, key):
            self.reg_delete_key(root, key.rstrip("\\") + "\\" + sub)
        roots = {"HKLM": winreg.HKEY_LOCAL_MACHINE, "HKCU": winreg.HKEY_CURRENT_USER,
                 "HKCR": winreg.HKEY_CLASSES_ROOT, "HKU": winreg.HKEY_USERS,
                 "HKCC": winreg.HKEY_CURRENT_CONFIG}
        try:
            winreg.DeleteKeyEx(roots[normalize_root(root)], key.strip("\\"), winreg.KEY_WOW64_64KEY, 0)
            self.record("Registry", "Schluessel loeschen", f"{normalize_root(root)}\\{key}")
        except OSError as exc:
            self.record("Registry", "Schluessel loeschen", f"{normalize_root(root)}\\{key}", str(exc))

    # -- Sonstiges ---------------------------------------------------------
    def create_shortcut(self, link, target, args="", workdir="", description="", icon="", icon_index=0):
        if not link.lower().endswith(".lnk"):
            link = link + ".lnk"
        self.record("Verknuepfung", "anlegen", link, f"-> {target} {args}".strip())
        if not IS_WINDOWS:
            return
        os.makedirs(os.path.dirname(link) or ".", exist_ok=True)
        ps = (
            "$s=(New-Object -ComObject WScript.Shell).CreateShortcut(%s);"
            "$s.TargetPath=%s;$s.Arguments=%s;$s.WorkingDirectory=%s;$s.Description=%s;"
            "%s$s.Save()"
        ) % (_ps(link), _ps(target), _ps(args), _ps(workdir), _ps(description),
             f"$s.IconLocation={_ps(icon + ',' + str(icon_index))};" if icon else "")
        subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps],
                       capture_output=True)

    def delete_shortcut(self, link):
        if not link.lower().endswith(".lnk"):
            link = link + ".lnk"
        self.record("Verknuepfung", "loeschen", link)
        try:
            os.remove(_local(link))
        except OSError:
            pass

    def kill_process(self, name: str) -> bool:
        self.record("Prozess", "beenden", name)
        if IS_WINDOWS:
            r = subprocess.run(["taskkill", "/F", "/IM", name], capture_output=True)
            return r.returncode == 0
        r = subprocess.run(["pkill", "-f", name], capture_output=True)
        return r.returncode == 0

    def service_control(self, name: str, action: str) -> int:
        self.record("Dienst", action, name)
        if IS_WINDOWS:
            return subprocess.run(["sc", action, name], capture_output=True).returncode
        return 0

    def system_shutdown(self, reboot: bool, force: bool, seconds: int) -> None:
        self.record("System", "Neustart" if reboot else "Herunterfahren", f"in {seconds} s",
                    "ausgefuehrt" if self.allow_shutdown else "unterdrueckt (Testlauf)")
        if self.allow_shutdown and IS_WINDOWS:
            args = ["shutdown", "/r" if reboot else "/s", "/t", str(seconds)]
            if force:
                args.append("/f")
            subprocess.run(args)


def make_backend(simulate: bool = True) -> Backend:
    return SimulationBackend() if simulate else WindowsBackend()


# --------------------------------------------------------------------------
# Hilfsfunktionen

def _local(path: str) -> str:
    """Windows-Pfad fuer das lokale Betriebssystem zurechtbiegen.

    Unter Windows unveraendert. Auf anderen Systemen (Simulation) werden
    Backslashes zu Schraegstrichen, damit Paketdateien gefunden werden."""
    if IS_WINDOWS:
        return path
    return path.replace("\\", "/")


def _ps(text: str) -> str:
    return "'" + str(text).replace("'", "''") + "'"


def _process_exists(name: str) -> bool:
    name = name.strip().strip('"')
    if not name:
        return False
    try:
        if IS_WINDOWS:
            out = subprocess.run(["tasklist", "/FI", f"IMAGENAME eq {name}", "/NH"],
                                 capture_output=True, text=True).stdout
            return name.lower() in out.lower()
        out = subprocess.run(["pgrep", "-f", "-i", name], capture_output=True, text=True).stdout
        return bool(out.strip())
    except OSError:
        return False


def _ini_read(path: str, section: str, key: str) -> str:
    try:
        with open(_local(path), "rb") as fh:
            data = fh.read()
    except OSError:
        return ""
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("cp1252", errors="replace")
    current = ""
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith(";"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current = line[1:-1].strip().lower()
            continue
        if current == section.strip().lower() and "=" in line:
            k, _, v = line.partition("=")
            if k.strip().lower() == key.strip().lower():
                return v.strip()
    return ""


def _read_xml(path: str, xpath: str) -> str:
    import xml.etree.ElementTree as ET
    try:
        tree = ET.parse(_local(path))
    except (OSError, ET.ParseError):
        return ""
    root = tree.getroot()
    xp = xpath.strip()
    if xp.startswith("/"):
        parts = xp.strip("/").split("/", 1)
        if parts[0].split("[")[0] != root.tag:
            return ""
        xp = "./" + parts[1] if len(parts) > 1 else "."
    try:
        el = root.find(xp)
    except SyntaxError:
        return ""
    if el is None:
        return ""
    return (el.text or "").strip()


def _file_version(path: str) -> str:
    if not IS_WINDOWS:
        return ""
    ps = f"(Get-Item {_ps(path)}).VersionInfo.FileVersion"
    try:
        out = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps],
                             capture_output=True, text=True, timeout=30).stdout
        return out.strip()
    except (OSError, subprocess.TimeoutExpired):
        return ""
