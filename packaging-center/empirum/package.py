"""Paketmodell: Ordnerstruktur, Suche, Anlegen aus Vorlage, ZIP-Export.

Ein Empirum-Paket liegt unter

    <PackageStore>\\<Hersteller>\\<Produkt>\\<Version>\\
        Install\\Setup.inf       (Skript, dazu Setup.ico, Logo.bmp)
        Files\\...               (Installer und Zusatzdateien)

``SrcDir=..`` in [Application] macht den Versionsordner zu %Src%.
"""

from __future__ import annotations

import os
import re
import shutil
import zipfile
from dataclasses import dataclass, field
from datetime import date

from .inf import InfFile, load_inf, parse_inf, decode_bytes

TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")


@dataclass
class Package:
    setup_inf: str
    developer: str = ""
    product: str = ""
    version: str = ""
    revision: str = ""
    method: str = ""
    description: str = ""
    platform: str = ""

    @property
    def install_dir(self) -> str:
        return os.path.dirname(self.setup_inf)

    @property
    def root(self) -> str:
        return os.path.dirname(self.install_dir)

    @property
    def label(self) -> str:
        return f"{self.developer} {self.product} {self.version}".strip()

    @classmethod
    def from_inf(cls, path: str) -> "Package":
        inf = load_inf(path)
        app = inf.find("Application")
        info = inf.find("SetupInfo")
        setup = inf.find("Setup")
        return cls(
            setup_inf=os.path.abspath(path),
            developer=(app.get("DeveloperName") if app else "") or "",
            product=(app.get("ProductName") if app else "") or "",
            version=(app.get("Version") if app else "") or "",
            revision=(app.get("Revision") if app else "") or "",
            method=(info.get("Method") if info else "") or "",
            description=(info.get("Description") if info else "") or "",
            platform=(setup.get("Platform") if setup else "") or "",
        )


def find_packages(root: str, max_depth: int = 6) -> list[Package]:
    """Alle Setup.inf unterhalb eines Ordners (Package Store) finden."""
    found: list[Package] = []
    root = os.path.abspath(root)
    base_depth = root.rstrip(os.sep).count(os.sep)
    for dirpath, dirnames, filenames in os.walk(root):
        depth = dirpath.count(os.sep) - base_depth
        if depth >= max_depth:
            dirnames[:] = []
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for name in filenames:
            if name.lower() == "setup.inf":
                try:
                    found.append(Package.from_inf(os.path.join(dirpath, name)))
                except Exception:
                    found.append(Package(setup_inf=os.path.join(dirpath, name)))
    found.sort(key=lambda p: (p.developer.lower(), p.product.lower(), _version_key(p.version)))
    return found


def _version_key(v: str):
    return tuple(int(x) if x.isdigit() else x for x in re.split(r"[.\-]", v))


def list_templates() -> list[str]:
    names = []
    if os.path.isdir(TEMPLATE_DIR):
        for n in sorted(os.listdir(TEMPLATE_DIR)):
            if n.lower().endswith(".inf"):
                names.append(n)
    return names


@dataclass
class PackageSpec:
    """Eingaben des Package Wizard."""

    template: str                  # Dateiname in templates/ oder voller Pfad
    developer: str
    product: str
    version: str
    revision: str = "0"
    author: str = ""
    description: str = ""
    installer: str = ""            # Pfad zur Installerdatei (wird nach Files\ kopiert)
    install_params: str = ""       # Parameter fuer Unattended-Setup
    uninstall_params: str = ""
    display_name: str = ""         # DisplayName unter ...\Uninstall
    arch: str = "x64"              # x64 | x86 | both
    platform: str = ""             # [Setup] Platform
    processes: list[tuple[str, str]] = field(default_factory=list)   # (exe, Beschreibung)
    order_number: str = ""
    requester: str = ""
    command_line_options: str = "/S0"
    copy_installer: bool = True
    extra: dict[str, str] = field(default_factory=dict)


def create_package(spec: PackageSpec, store: str) -> str:
    """Paketordner anlegen und Setup.inf aus der Vorlage erzeugen.

    Liefert den Pfad der neuen Setup.inf. Vorhandene Setup.inf werden nicht
    ueberschrieben."""
    template_path = spec.template if os.path.isabs(spec.template) else os.path.join(TEMPLATE_DIR, spec.template)
    with open(template_path, "rb") as fh:
        text, encoding, bom = decode_bytes(fh.read())
    inf = parse_inf(text)
    inf.encoding = encoding
    inf.bom = bom
    inf.newline = "\r\n"

    installer_name = os.path.basename(spec.installer) if spec.installer else ""
    today = date.today().strftime("%d.%m.%Y")
    replacements = {
        "{ProductName}": spec.product,
        "{DeveloperName}": spec.developer,
        "{Version}": spec.version,
        "{UnattInst}": installer_name,
        "{UnattInstPar}": spec.install_params,
    }
    for sec in inf.sections:
        for ln in sec.lines:
            for k, v in replacements.items():
                if k in ln.raw:
                    ln.raw = ln.raw.replace(k, v)

    app = inf.find("Application")
    if app:
        app.set("ProductName", spec.product)
        app.set("DeveloperName", spec.developer)
        app.set("Version", spec.version)
        app.set("Revision", spec.revision or "0")
    setup = inf.find("Setup")
    if setup and spec.platform:
        setup.set("Platform", spec.platform)
    info = inf.find("SetupInfo")
    if info:
        _set_padded(info, "Author", spec.author)
        _set_padded(info, "CreationDate", today)
        _set_padded(info, "Last Change", today)
        _set_padded(info, "Description", spec.description or f"{spec.product} {spec.version}")
        _set_padded(info, "Command line options", spec.command_line_options)
        if spec.order_number:
            _set_padded(info, "Auftragsnummer", spec.order_number)
        if spec.requester:
            _set_padded(info, "Besteller", spec.requester)
        for ln in info.lines:
            if ln.raw.startswith("1.00") and "Initialpaket" in ln.raw:
                ln.raw = f"1.00\t\t{today}\t{spec.author or ''}\t\tInitialpaket {spec.product} {spec.version}"

    # Architekturabschnitte
    for arch_sec, arch in (("Set:Win64", "x64"), ("Set:Win32", "x86")):
        sec = inf.find(arch_sec)
        if sec is None:
            continue
        for ln in sec.lines:
            kv = ln.key_value()
            if not kv:
                continue
            key = kv[0].lower()
            if key in ("set v_unattendfilename", "set v_msifilename") and installer_name:
                ln.raw = f"{kv[0]}={installer_name}"
            elif key == "set v_unattendparameter":
                ln.raw = f"{kv[0]}={spec.install_params}"
            elif key == "set v_unattenduninstparameter":
                ln.raw = f"{kv[0]}={spec.uninstall_params}"
            elif key in ("set v_unattenddisplayname", "set v_msidisplayname") and spec.display_name:
                ln.raw = f"{kv[0]}={spec.display_name}"
    if spec.arch in ("x64", "x86"):
        # nicht benoetigte Architektur aus [Product] entfernen
        other = "WINDOWS32" if spec.arch == "x64" else "WINDOWS64"
        product = inf.find("Product")
        if product:
            product.lines = [ln for ln in product.lines if other not in ln.raw.upper()]
        gone = "Set:Win32" if spec.arch == "x64" else "Set:Win64"
        inf.sections = [s for s in inf.sections if s.key != gone.lower()]
    procs = inf.find("Processes")
    if procs and spec.processes:
        procs.lines = [ln for ln in procs.lines if not ln.is_comment]
        for i, (exe, title) in enumerate(spec.processes, start=1):
            procs.lines.append(parse_inf(f"[x]\nProc{i}={exe}, {title or exe}, KILLPROCESS ABORT\n").sections[0].lines[0])
        product = inf.find("Product")
        ids = ", ".join(f"Proc{i}" for i in range(1, len(spec.processes) + 1))
        if product:
            for ln in product.lines:
                if "AskKillProcesses" in ln.raw and ln.is_comment:
                    ln.raw = f"-AskKillProcesses 600, {ids}"
        close = inf.find("Set:CloseApplication")
        if close:
            for ln in close.lines:
                if "AskKillProcesses" in ln.raw and ln.is_comment:
                    ln.raw = f"AskKillProcesses 600, {ids}"
    for key, value in spec.extra.items():
        sec_name, _, k = key.partition(".")
        sec = inf.find(sec_name)
        if sec and k:
            sec.set(k, value)

    folder = os.path.join(store, _safe(spec.developer), _safe(spec.product), _safe(spec.version))
    install_dir = os.path.join(folder, "Install")
    files_dir = os.path.join(folder, "Files")
    target = os.path.join(install_dir, "Setup.inf")
    if os.path.exists(target):
        raise FileExistsError(f"Es gibt schon eine Setup.inf: {target}")
    os.makedirs(install_dir, exist_ok=True)
    os.makedirs(files_dir, exist_ok=True)
    inf.renumber()
    inf.save(target)
    if spec.installer and spec.copy_installer and os.path.isfile(spec.installer):
        dst = os.path.join(files_dir, installer_name)
        if not os.path.exists(dst):
            shutil.copy2(spec.installer, dst)
    return target


def _set_padded(sec, key: str, value: str) -> None:
    """Schluessel in [SetupInfo] setzen und die Spaltenausrichtung behalten."""
    wanted = key.lower()
    for ln in sec.lines:
        kv = ln.key_value()
        if kv and kv[0].lower() == wanted:
            head = ln.raw.split("=", 1)[0]
            ln.raw = f"{head}= {value}"
            return
    sec.set(key, value)


def _safe(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*]', "_", name).strip() or "_"


def export_zip(package_root: str, zip_path: str, include_files: bool = True) -> int:
    """Paketordner als ZIP exportieren. Liefert die Zahl der Dateien."""
    count = 0
    package_root = os.path.abspath(package_root)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for dirpath, dirnames, filenames in os.walk(package_root):
            rel_dir = os.path.relpath(dirpath, package_root)
            if not include_files and rel_dir.split(os.sep)[0].lower() == "files":
                continue
            for name in filenames:
                full = os.path.join(dirpath, name)
                arc = os.path.normpath(os.path.join(rel_dir, name))
                zf.write(full, arc)
                count += 1
    return count


def import_reg_file(path: str) -> list[str]:
    """Eine .reg-Datei in Setup.inf-Registryzeilen umwandeln.

    Unterstuetzt REG_SZ, REG_DWORD, REG_EXPAND_SZ, REG_MULTI_SZ, REG_BINARY
    und geloeschte Schluessel/Werte (``[-HKEY...]`` bzw. ``"Name"=-``)."""
    with open(path, "rb") as fh:
        data = fh.read()
    text, _, _ = decode_bytes(data)
    lines: list[str] = []
    current_root = ""
    current_key = ""
    delete_key = False
    buffer = ""
    for raw in text.splitlines():
        line = raw.strip()
        if buffer:
            line = buffer + line
            buffer = ""
        if line.endswith("\\") and not line.startswith("["):
            buffer = line[:-1].strip()
            continue
        if not line or line.startswith(";") or line.lower().startswith("windows registry editor") or line.upper().startswith("REGEDIT"):
            continue
        if line.startswith("[") and line.endswith("]"):
            inner = line[1:-1]
            delete_key = inner.startswith("-")
            inner = inner.lstrip("-")
            root, _, key = inner.partition("\\")
            current_root = _short_root(root)
            current_key = key
            if delete_key:
                lines.append(f'-{current_root},"{current_key}"')
            elif key:
                lines.append(f'{current_root},"{current_key}"')
            continue
        if "=" not in line or delete_key:
            continue
        name, _, value = line.partition("=")
        name = name.strip()
        name = "" if name == "@" else name.strip('"')
        value = value.strip()
        if value == "-":
            lines.append(f'-{current_root},"{current_key}","{name}"')
            continue
        if value.startswith('"'):
            data_s = _reg_string(value)
            lines.append(f'{current_root},"{current_key}","{name}",0x00000000,"{data_s}"')
        elif value.lower().startswith("dword:"):
            lines.append(f'{current_root},"{current_key}","{name}",0x00010001,"{int(value[6:], 16)}"')
        elif value.lower().startswith("hex(2):"):
            lines.append(f'{current_root},"{current_key}","{name}",0x00020000,"{_hex_to_text(value[7:])}"')
        elif value.lower().startswith("hex(7):"):
            multi = _hex_to_text(value[7:]).replace(chr(0), "\\0")
            lines.append(f'{current_root},"{current_key}","{name}",0x00010000,"{multi}"')
        elif value.lower().startswith("hex:"):
            lines.append(f'{current_root},"{current_key}","{name}",0x00000001,"{value[4:].replace(" ", "")}"')
        else:
            lines.append(f'{current_root},"{current_key}","{name}",0x00000000,"{value}"')
    return lines


def _reg_string(value: str) -> str:
    """Zeichenkette aus einer .reg-Datei entpacken ("a \\"b\\" c" -> a "b" c)."""
    out: list[str] = []
    i = 1
    while i < len(value):
        ch = value[i]
        if ch == "\\" and i + 1 < len(value):
            out.append(value[i + 1])
            i += 2
            continue
        if ch == '"':
            break
        out.append(ch)
        i += 1
    return "".join(out)


def _short_root(root: str) -> str:
    return {
        "HKEY_LOCAL_MACHINE": "HKLM", "HKEY_CURRENT_USER": "HKCU", "HKEY_CLASSES_ROOT": "HKCR",
        "HKEY_USERS": "HKU", "HKEY_CURRENT_CONFIG": "HKCC",
    }.get(root.upper(), root)


def _hex_to_text(hexdata: str) -> str:
    raw = bytes(int(b, 16) for b in hexdata.replace(" ", "").split(",") if b)
    try:
        return raw.decode("utf-16-le").rstrip("\x00")
    except UnicodeDecodeError:
        return raw.hex()
