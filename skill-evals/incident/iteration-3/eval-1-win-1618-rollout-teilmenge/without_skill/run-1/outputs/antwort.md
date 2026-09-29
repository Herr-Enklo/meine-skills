Kurz eingeordnet: 1618 heißt `ERROR_INSTALL_ALREADY_RUNNING` und kommt vom Windows Installer. Als dein Paket auf diesen 14 Clients starten wollte, lief dort gerade eine andere MSI-Installation, und Windows lässt immer nur eine gleichzeitig zu. Am Paket selbst liegt das nicht, sonst wären nicht 216 Clients sauber durchgelaufen. Es war eine Kollision im Zeitfenster. Bei 1618 bricht msiexec ab, bevor es etwas ändert, deshalb sollte auf den 14 Clients noch die alte Version laufen. Die Priorität ist niedrig, und bis morgen früh ist das gut zu schaffen.

Was nachts typischerweise dazwischenfunkt:

- Windows Update/WSUS installiert zur selben Zeit (z. B. .NET oder andere MSI-basierte Updates)
- ein anderes Empirum-Paket, das in derselben Nacht auf genau diesen Clients lief
- der Updater einer anderen Software, der selbst msiexec aufruft
- eine hängengebliebene Installation von vorher, oft zusammen mit einem ausstehenden Neustart

## 1. Ursache prüfen (ca. 10 Minuten)

Exportier die 14 Clients aus Empirum und schau, ob sie etwas gemeinsam haben: Standort, OU, Update-Ring, zusätzliche Pakete in derselben Nacht. Danach fragst du per PowerShell-Remoting ab, was auf den Clients los war:

```powershell
# Die 14 Clientnamen, einer pro Zeile
$clients = Get-Content C:\temp\npp_1618.txt
# Beginn des Rollout-Fensters letzte Nacht, bitte anpassen
$ab = Get-Date '2026-09-28 20:00'

Invoke-Command -ComputerName $clients -ArgumentList $ab -ScriptBlock {
    param($ab)
    function Ereignisse($log, $quelle) {
        (Get-WinEvent -FilterHashtable @{ LogName = $log; ProviderName = $quelle; StartTime = $ab } -ErrorAction SilentlyContinue |
            Sort-Object TimeCreated |
            ForEach-Object { '{0:dd.MM. HH:mm} [{1}] {2}' -f $_.TimeCreated, $_.Id, ($_.Message -split "`r?`n")[0] }) -join "`n"
    }
    $exe = "$env:ProgramFiles\Notepad++\notepad++.exe", "${env:ProgramFiles(x86)}\Notepad++\notepad++.exe" |
        Where-Object { Test-Path $_ } | Select-Object -First 1
    $v = if ($exe) { (Get-Item $exe).VersionInfo }
    [pscustomobject]@{
        NppVersion         = if ($v) { '{0}.{1}.{2}' -f $v.FileMajorPart, $v.FileMinorPart, $v.FileBuildPart } else { 'nicht installiert' }
        NeustartAusstehend = (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') -or
                             (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired')
        MsiProzesse        = (Get-CimInstance Win32_Process -Filter "Name='msiexec.exe'").CommandLine -join "`n"
        MsiEreignisse      = Ereignisse 'Application' 'MsiInstaller'
        WindowsUpdate      = Ereignisse 'System' 'Microsoft-Windows-WindowsUpdateClient'
    }
} | Format-List PSComputerName, NppVersion, NeustartAusstehend, MsiProzesse, MsiEreignisse, WindowsUpdate
```

So liest du das Ergebnis:

- **MsiEreignisse:** Kurz vor dem Fehlerzeitpunkt steht dort, welches Produkt gerade installiert wurde. 1040/1042 sind Beginn und Ende einer Installer-Transaktion, 11707/11708 eine erfolgreiche bzw. fehlgeschlagene Installation, der Produktname steht jeweils im Text. Wenn es auf allen 14 dasselbe Produkt ist, hast du den Verursacher.
- **WindowsUpdate:** Installationen um dieselbe Uhrzeit sprechen für eine Überschneidung mit dem Update-Fenster.
- **MsiProzesse:** `msiexec.exe /V` ist nur der Installer-Dienst und kein Problem. Läuft jetzt noch ein msiexec mit `/i` oder `/x`, hängt dort eine Installation. Die blockiert auch jeden neuen Versuch.
- **NeustartAusstehend = True:** Diese Clients vor dem nächsten Versuch neu starten.
- **NppVersion = nicht installiert:** Dann hat das Paket die alte Version vorher schon entfernt, bevor die Installation scheiterte. Diese Clients zuerst nachziehen, denn dort fehlt Notepad++ gerade ganz.

Falls WinRM bei euch nicht offen ist: Auf ein oder zwei der Clients reicht auch ein Blick in die Ereignisanzeige (Anwendung, Quelle MsiInstaller, rund um die Fehlerzeit aus Empirum).

## 2. Die 14 Clients nachinstallieren

1. Clients mit hängendem msiexec oder ausstehendem Neustart neu starten. Eine hängende Installation würde ich per Neustart beenden und nicht per Kill.
2. In Empirum das Paket nur für diese 14 Clients neu anstoßen (Reinstall setzen bzw. neu zuweisen, dann die Clients aktivieren).
3. Den Zeitpunkt so wählen, dass Notepad++ nicht offen ist. Sonst sind Dateien gesperrt und du bekommst statt 1618 einen anderen Fehler oder einen Neustartbedarf. Also heute nach Feierabend oder heute Nacht, aber **nicht im selben Zeitfenster**, falls Schritt 1 zeigt, dass dort regelmäßig Windows Update oder ein anderes Paket läuft. Sonst stehen morgen dieselben Clients wieder auf Fehler.

## 3. Morgen früh kontrollieren

In Empirum müssen alle 230 auf OK stehen. Für die 14 lässt du das Skript oben noch einmal laufen, `NppVersion` muss dann 8.8.5 zeigen.

## Damit es beim nächsten Rollout nicht wieder passiert

1618 erledigt sich durch Warten. SCCM und Intune behandeln den Code deshalb standardmäßig als „später erneut versuchen“. Für Empirum gibt es zwei Wege:

- Im Paket vor dem msiexec-Aufruf warten, bis kein anderer Installer mehr läuft, oder bei Rückgabe 1618 nach ein paar Minuten automatisch erneut versuchen (z. B. bis zu 10 Versuche im Abstand von 2 Minuten).
- Rollout-Fenster so legen, dass sie sich nicht mit den Installationszeiten von Windows Update und anderen Paketen überschneiden.

Für 8.8.5 gibt es übrigens kein offizielles MSI. Euer Paket ist also entweder umgepackt, oder es ruft msiexec für etwas anderes auf, etwa zum Deinstallieren der Vorversion. Genau um diesen Aufruf muss die Warteschleife. Wenn du mir sagst, wie das Paket gebaut ist (Empirum-Skript, PowerShell-Wrapper, MSI), schreibe ich dir die passende Variante.

## Nebenbei zur Version

Notepad++ 8.8.5 ist vom August 2025, aktuell ist die 8.9-Reihe (zuletzt 8.9.8). Ende 2025 hat 8.8.9 eine Lücke im eingebauten Updater (WinGUp) geschlossen: Update-Downloads wurden in Einzelfällen auf manipulierte Server umgeleitet, und bis dahin wurden Zertifikat und Signatur des heruntergeladenen Installers nicht geprüft. Wenn 8.8.5 bei euch bewusst die freigegebene Version ist, passt das. Sonst würde ich die 14 jetzt zwar sauberziehen, danach aber zeitnah alle 230 auf eine aktuelle Version bringen. Seit 8.8.8 gibt es dafür auch ein offizielles MSI. Den Auto-Updater würde ich im Paket in jedem Fall abschalten, damit die Versionen über Empirum laufen und nicht über die Clients selbst.

Quellen:
- [Notepad++ v8.8.5 Download](https://notepad-plus-plus.org/downloads/v8.8.5/)
- [Notepad++ v8.8.9: Vulnerability-fix](https://notepad-plus-plus.org/news/v889-released/)
- [Notepad++ v8.8.8 Release](https://notepad-plus-plus.org/news/v888-released/)
- [Master Packager: Notepad++ Now Has an Official MSI](https://blog.masterpackager.com/Notepad-plus-plus-MSI)
- [Notepad++ Community: Release 8.9.8](https://community.notepad-plus-plus.org/topic/27639/notepad-release-8.9.8)
