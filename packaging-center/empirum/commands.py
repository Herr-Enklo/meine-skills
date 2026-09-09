"""Befehlskatalog der Setup.inf-Skriptsprache.

Der Katalog speist die Codevervollstaendigung (Strg+Leertaste), die
Befehlsreferenz im Editor und die Paketpruefung (unbekannte Befehle).
Die Beschreibungen fassen zusammen, was aus den Empirum-Vorlagen, den
Beispielpaketen und der oeffentlichen Dokumentation belegt ist.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CommandInfo:
    name: str
    syntax: str
    description: str
    group: str
    uninstall_hint: str = ""


COMMANDS: list[CommandInfo] = [
    # Ablauf
    CommandInfo("#", "#Sektion[, FLAGS]",
                "Ruft eine Sektion auf. FLAGS: DONTDELETE (nur Installation), DELETE (nur "
                "Deinstallation), WINDOWS64/WINDOWS32 (nur bei passender Bitbreite), MACHINE "
                "(Maschinenteil), CLIENT (Benutzerteil, braucht /AW). Eine Sektion laeuft pro "
                "Lauf nur einmal; #!Sektion erzwingt einen weiteren Durchlauf.", "Ablauf"),
    CommandInfo("If", 'If <Bedingung> [| <Bedingung>] [& <Bedingung>] Then "Sektion" [Else "Sektion"] EndIf',
                "Einzeilige Verzweigung. Bedingungen vergleichen mit ==, <>, !=, <, >, <=, >= oder "
                "rufen Funktionen wie DoesRegKeyExist(...) auf. | ist ODER, & ist UND. Die Zweige "
                "sind Sektionsnamen. If-Zeilen laufen bei Installation und Deinstallation.", "Ablauf"),
    CommandInfo("For", "For <Variable>,<Start>,<Ende>,<Schritt>,<Sektion>",
                "Zaehlschleife: ruft die Sektion fuer jeden Wert auf, die Laufvariable ist in der "
                "Sektion als %Variable% verfuegbar.", "Ablauf"),
    CommandInfo("Exit", "Exit [Meldung]",
                "Beendet das Skript vorzeitig mit Erfolg. Neustartanforderungen bleiben erhalten.",
                "Ablauf"),
    CommandInfo("Abort", "Abort [Meldung]",
                "Bricht ab; Empirum meldet FAILURE, das Paket wird beim naechsten Lauf erneut versucht.",
                "Ablauf"),
    CommandInfo("AbortSilent", "AbortSilent [Meldung]",
                "Bricht ab, ohne dass die Konsole einen Fehler zeigt; Neustartanforderungen verfallen.",
                "Ablauf"),
    CommandInfo("AbortReboot", "AbortReboot [Meldung]",
                "Bricht ab, Status 'Reboot Pending'; das Paket startet nach dem Neustart erneut.",
                "Ablauf"),
    CommandInfo("Sleep", "Sleep <Millisekunden>", "Wartet die angegebene Zeit.", "Ablauf"),
    CommandInfo("AddMeter", "AddMeter <Anzahl>",
                "Fortschrittsbalken: fuegt Schritte hinzu (-1 = ein Schritt ohne Gesamtzahl).", "Ablauf"),
    CommandInfo("Echo", "Echo <Text>", "Schreibt den Text ins Protokoll.", "Ablauf"),
    CommandInfo("ErrorLogMsg", "ErrorLogMsg <Text>",
                "Schreibt eine Fehlermeldung in das Empirum-Fehlerprotokoll (wird immer sofort uebertragen).",
                "Ablauf"),
    CommandInfo("Prompt", "Prompt <Variable>",
                "Fragt den Benutzer nach einem Wert (Definition in [Prompts]). Nur mit /S2 oder /S3 sichtbar.",
                "Ablauf"),
    # Variablen
    CommandInfo("Set", "Set <Variable>=<Wert>  |  Set <Variable> = <Funktion>(...)",
                "Weist einen Wert zu. Die rechte Seite wird einmal expandiert; %% bleibt als % "
                "stehen und wird erst durch ReplaceEnv aufgeloest. Funktionen: GetUninstallKeyName, "
                "Tokenize, Len, RemoveFromLeft, RemoveFromRight, ReadXmlText, Left, Right, Mid, "
                "UpperCase, LowerCase, Trim, Replace, DoesRegKeyExist, DoesFileExist, DoesPathExist, "
                "DoesTextInFileExist.", "Variablen"),
    CommandInfo("ReplaceEnv", "ReplaceEnv <Variable>",
                "Expandiert den gespeicherten Wert der Variable erneut (Registry- und INI-Zugriffe, "
                "die mit %% aufgeschoben wurden).", "Variablen"),
    CommandInfo("Increment", "Increment (<Variable>, <Zahl>)", "Erhoeht die Variable um die Zahl.", "Variablen"),
    CommandInfo("Decrement", "Decrement (<Variable>, <Zahl>)", "Verringert die Variable um die Zahl.", "Variablen"),
    # Programme
    CommandInfo("Call", "Call <Programm> [Parameter]",
                "Startet ein Programm mit sichtbarem Fenster und wartet auf das Ende. Der Rueckgabewert "
                "steht danach in %ErrorLevel%. CallTimeOut aus [Application] begrenzt die Laufzeit.",
                "Programme"),
    CommandInfo("CallHidden", "CallHidden <Programm> [Parameter]",
                "Wie Call, aber ohne sichtbares Fenster.", "Programme"),
    CommandInfo("CallAsync", "CallAsync <Programm> [Parameter]",
                "Startet ein Programm, ohne auf das Ende zu warten.", "Programme"),
    CommandInfo("MsiExec", "MsiExec /I \"Datei.msi\" ... | MsiExec /X {GUID} ...",
                "Windows-Installer-Aufruf (wie Call MsiExec). Rueckgabe 0 = OK, 3010 = Neustart noetig, "
                "1641 = Neustart eingeleitet, 1603 = Fehler, 1605 = Produkt nicht installiert.", "Programme"),
    CommandInfo("KillProcess", 'KillProcess "<Prozess.exe>",<Flag>',
                "Beendet einen Prozess sofort.", "Programme"),
    CommandInfo("AskKillProcesses", "AskKillProcesses <Sekunden>, <Prozess-ID>[, ...]",
                "Zeigt den Dialog zum Schliessen laufender Programme aus [Processes]; nach Ablauf "
                "der Zeit gilt CONTINUE oder ABORT des Eintrags.", "Programme"),
    CommandInfo("WaitUntilProcessExists", "WaitUntilProcessExists <Prozess.exe>[, <Sekunden>]",
                "Wartet, bis ein Prozess laeuft.", "Programme"),
    CommandInfo("WaitWhileProcessExists", "WaitWhileProcessExists <Prozess.exe>[, <Sekunden>]",
                "Wartet, solange ein Prozess laeuft.", "Programme"),
    # Dateien
    CommandInfo("Copy", 'Copy "<Quelle>", "<Ziel>"', "Kopiert eine Datei.", "Dateien"),
    CommandInfo("Del", 'Del "<Datei>"', "Loescht eine Datei (Platzhalter erlaubt).", "Dateien"),
    CommandInfo("DelTree", 'DelTree "<Ordner>"', "Loescht einen Ordner samt Inhalt.", "Dateien"),
    CommandInfo("MkDir", 'MkDir "<Ordner>"', "Legt einen Ordner an.", "Dateien"),
    CommandInfo("RmDir", 'RmDir "<Ordner>"', "Entfernt einen leeren Ordner.", "Dateien"),
    CommandInfo("Rename", 'Rename "<Alt>", "<Neu>"', "Benennt eine Datei um.", "Dateien"),
    CommandInfo("Kopierzeile", "<Disk>:<Quelle>, <Ziel>, <FLAGS>, <Groesse>",
                "Kopiert eine Datei aus dem Paket. Leeres Ziel = %ApplicationDir%. FLAGS: NORMAL "
                "(nur wenn neuer), ALWAYS, OPTIONAL (Quelle darf fehlen), USEFILENAME, DIRECTORY, "
                "CLIENT, DONTDELETE (bleibt bei Deinstallation), SHAREDDLL, WINDOWS32, WINDOWS64, "
                "SETUP (gehoert zum Interpreter), NOSIZEWARNING. Bei Deinstallation wird die Datei "
                "wieder geloescht.", "Dateien"),
    # Registry
    CommandInfo("Registryzeile", 'HKLM,"Schluessel","Wert",<Typ>,"Daten"   |   -HKLM,"Schluessel"[,"Wert"]',
                "Nur in [Reg:...]-Sektionen. Typ 0x00000000 = REG_SZ, 0x00010001 = REG_DWORD, "
                "0x00020000 = REG_EXPAND_SZ, 0x00010000 = REG_MULTI_SZ, 0x00000001 = REG_BINARY. "
                "Fuehrendes - loescht den Wert bzw. den ganzen Schluessel. HKCU-Zeilen gehoeren in "
                "eine CLIENT-Sektion.", "Registry"),
    CommandInfo("Verknuepfungszeile", '"<Pfad\\Name>", "<Ziel>", "<Parameter>", "<Arbeitsordner>", <Beschreibung>, "<Icon-Datei>", <Icon-Index>[, <Fenster>, <Hotkey>]',
                "Nur in [Shell:...]-Sektionen. Legt eine Verknuepfung (.lnk) an; bei Deinstallation "
                "wird sie entfernt.", "Verknuepfungen"),
    # Neustart
    CommandInfo("SetReboot", "SetReboot <0-5>",
                "Fordert einen Neustart beim Agenten an (der Benutzer kann ihn je nach Agentenkonfiguration "
                "verschieben). Typisch nach MSI-Rueckgabe 3010.", "Neustart"),
    CommandInfo("SystemShutdown", 'SystemShutdown "<Text>", <Neustart 0/1>, <Erzwingen 0/1>, <Sekunden>, <Async 0/1>',
                "Faehrt den Rechner herunter oder startet ihn neu, nicht verschiebbar.", "Neustart"),
    # Dienste
    CommandInfo("StartService", "StartService <Dienst>", "Startet einen Windows-Dienst.", "Dienste"),
    CommandInfo("StopService", "StopService <Dienst>", "Haelt einen Windows-Dienst an.", "Dienste"),
]

FUNCTIONS: dict[str, str] = {
    "DoesRegKeyExist": 'DoesRegKeyExist("HKLM,Schluessel[,Wert]")  ->  "1" oder "0"',
    "DoesFileExist": 'DoesFileExist("<Datei>")  ->  "1" oder "0"',
    "DoesPathExist": 'DoesPathExist("<Ordner>")  ->  "1" oder "0"',
    "DoesDirExist": 'DoesDirExist("<Ordner>")  ->  "1" oder "0"',
    "DoesTextInFileExist": 'DoesTextInFileExist("<Text>", "<Datei>")  ->  "1" oder "0"',
    "GetUninstallKeyName": 'GetUninstallKeyName("<DisplayName oder Muster*>"[, x86|x64])  ->  Schluesselname unter ...\\Uninstall oder ""',
    "Tokenize": 'Tokenize (<Variable>[, "<Trenner>"])  ->  Anzahl; Teile stehen in %Variable1%, %Variable2% ...',
    "Len": 'Len ("<Text>")  ->  Laenge',
    "RemoveFromLeft": 'RemoveFromLeft (<Text>, <Anzahl>)  ->  Text ohne die ersten Zeichen (und ohne umschliessende Anfuehrungszeichen)',
    "RemoveFromRight": 'RemoveFromRight (<Text>, <Anzahl>)  ->  Text ohne die letzten Zeichen',
    "Left": 'Left ("<Text>", <Anzahl>)',
    "Right": 'Right ("<Text>", <Anzahl>)',
    "Mid": 'Mid ("<Text>", <Start>, <Anzahl>)',
    "UpperCase": 'UpperCase ("<Text>")',
    "LowerCase": 'LowerCase ("<Text>")',
    "Trim": 'Trim ("<Text>")',
    "Replace": 'Replace ("<Text>", "<Suchen>", "<Ersetzen>")',
    "ReadXmlText": 'ReadXmlText("<Datei>", "<XPath>")  ->  Text des ersten Treffers',
    "GetFileVersion": 'GetFileVersion("<Datei>")  ->  Dateiversion oder ""',
    "IsProcessRunning": 'IsProcessRunning("<Prozess.exe>")  ->  "1" oder "0"',
}

SECTION_FLAGS = ["DONTDELETE", "DELETE", "WINDOWS64", "WINDOWS32", "MACHINE", "CLIENT",
                 "ADMIN", "SHARED", "ALWAYS"]

COPY_FLAGS = ["NORMAL", "ALWAYS", "OPTIONAL", "USEFILENAME", "DIRECTORY", "CLIENT",
              "DONTDELETE", "SHAREDDLL", "WINDOWS32", "WINDOWS64", "SETUP",
              "NOSIZEWARNING", "COPYALWAYS"]

APPLICATION_KEYS = [
    "ProductName", "DeveloperName", "Version", "Revision", "SetupName", "BackgroundColor",
    "BackgroundPicture", "Logo", "CopyDialogRect", "UserKeyName", "MachineKeyName",
    "UninstallKeyName", "UninstallDisplayName", "UninstallString", "ReinstallString",
    "UninstallDisplayIcon", "UninstallOptions", "ReinstallMode", "SrcDir", "ApplicationDir",
    "SetupInfDir", "DataDir", "AskUninstallOld", "ShellLinks", "CommonShellLinks",
    "CreateUnresolvableShellLinks", "UseStringSection", "UseSysStringSection", "DateWarning",
    "SizeWarning", "Reboot", "PreventExternalReboot", "StartServicesOnReboot", "CallTimeOut",
    "AbortAfterCallTimeOut", "DisableCancelButton", "ShowEndMessage", "EndMessage", "AskInfo",
    "InfoText", "Prompts",
]

BUILTIN_VARIABLES = [
    "ProductName", "DeveloperName", "Version", "Revision", "Src", "App", "ApplicationDir",
    "SetupInfDir", "ErrorLevel", "ProgramFilesDir", "ProgramFilesDirx86", "ProgramFiles",
    "CommonFilesDir", "CommonAppData", "CommonDesktop", "CommonPrograms", "CommonStartup",
    "Programs", "Desktop", "Personal", "AppData", "LocalAppData", "UserProfile", "Sendto",
    "System", "windir", "SystemDrive", "Temp", "ComputerName", "WindowsUser", "UserDomain",
    "DomainName", "EmpirumServer", "SetupBits", "CommonSetupDir", "WindowsVersion",
    "OS.DisplayString", "Language", "Company", "SoftwareDepotDistributionFlags",
]


def command_names() -> list[str]:
    names = [c.name for c in COMMANDS if not c.name.endswith("zeile") and c.name != "#"]
    return names


def lookup(name: str) -> CommandInfo | None:
    wanted = name.strip().lower()
    for c in COMMANDS:
        if c.name.lower() == wanted:
            return c
    return None


def completion_words() -> list[str]:
    words = set(command_names())
    words.update(FUNCTIONS.keys())
    words.update(SECTION_FLAGS)
    words.update(COPY_FLAGS)
    words.update("%" + v + "%" for v in BUILTIN_VARIABLES)
    words.update(["Then", "Else", "EndIf", "EndIf"])
    return sorted(words, key=str.lower)
