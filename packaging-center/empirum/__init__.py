"""Empirum-Setup.inf: Parser, Variablen, Interpreter, Pruefung.

Das Paket bildet nach, was der Empirum-Interpreter (Setup.exe) mit einer
Setup.inf macht, damit sich Pakete ohne Empirum-Server lokal testen lassen.
Es haengt von keiner externen Bibliothek ab.
"""

from .inf import InfFile, Section, Line, load_inf, parse_inf
from .runner import Runner, RunOptions, RunResult, Status
from .backend import SimulationBackend, WindowsBackend, make_backend
from .validator import validate, Finding
from .package import Package, find_packages, create_package, export_zip
from .pipeline import build_package, run_roundtrip, BuildResult, RoundtripResult

__all__ = [
    "InfFile", "Section", "Line", "load_inf", "parse_inf",
    "Runner", "RunOptions", "RunResult", "Status",
    "SimulationBackend", "WindowsBackend", "make_backend",
    "validate", "Finding",
    "Package", "find_packages", "create_package", "export_zip",
    "build_package", "run_roundtrip", "BuildResult", "RoundtripResult",
]
