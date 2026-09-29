`INC-20260929-0830 | P3 | Windows-System | wartet auf Nutzer | Bluescreen DRIVER_IRQL_NOT_LESS_OR_EQUAL beim Andocken, Dell Latitude`

**Einordnung**

DRIVER_IRQL_NOT_LESS_OR_EQUAL ist Bug Check 0xD1: Ein Treiber im Kernel hat auf Speicher zugegriffen, den er in diesem Moment nicht anfassen durfte, meist über einen ungültigen Zeiger. Schuld ist also sehr wahrscheinlich ein Treiber und nicht Windows selbst. Welcher, verrät die `.sys`-Zeile, die du dir nicht gemerkt hast. Die steht aber oft auch im Ereignisprotokoll und sicher im Speicherabbild, das holen wir uns. Dass es vor allem beim Andocken passiert, lenkt den Verdacht auf Treiber, die genau dann anspringen: Netzwerkchip im Dock, Grafik für die externen Monitore, USB-C/Thunderbolt.

Priorität P3: Auswirkung mittel (dein Arbeitsgerät stürzt wiederholt ab, ein Workaround ist noch nicht bestätigt), Dringlichkeit mittel (arbeiten geht, aber jeder Absturz kostet ungespeicherte Arbeit). Annahme, weil ich keine Prioritätsregeln deines Arbeitgebers kenne. Zweite Annahme: Firmenlaptop mit eigener IT. Ein Journal früherer Fälle gibt es in dieser Sitzung nicht. Eine aktuelle, von Microsoft bestätigte Dock-Störung unter Windows 11 habe ich bei einer kurzen Suche nicht gefunden. Bekannt ist aber genau dieser Stopcode mit dem Realtek-USB-Netzwerktreiber `rtux64w10.sys`, der in vielen Docks steckt, teils nach einem Treiberupdate über Windows Update. Bei dir ist das noch unbelegt.

**Sofort, damit du arbeiten kannst**

1. Bis zur Klärung ohne Dock arbeiten: WLAN statt Dock-LAN, Monitor wenn möglich direkt an den Laptop.
2. Brauchst du das Dock: vorher alles speichern. Einen Versuch wert, bei dir aber nicht belegt: Laptop herunterfahren, andocken, dann einschalten, statt im laufenden Betrieb anzustecken.
3. Stürzt er angedockt trotzdem ab, einmal ohne Netzwerkkabel am Dock versuchen. Bleibt er dann stabil, ist der Netzwerkchip im Dock der erste Verdächtige.

**Hypothesen und woran man sie in der Ausgabe erkennt**

- **H1 Treiber eines Dock-Geräts** (Realtek USB GbE, DisplayLink, Thunderbolt/USB4): Der Fehlerbericht nennt eine dieser `.sys`, und dieselbe `oem…inf` steht bei den Dock-Geräten und bei den Treiberpaketen der letzten Tage.
- **H2 Grafiktreiber beim Umschalten auf die externen Monitore**: Der Fehlerbericht nennt `igdkmd64.sys`, `nvlddmkm.sys` oder `dxgkrnl.sys`, und im Update-Verlauf oder bei den Treiberpaketen taucht ein neuer Grafiktreiber auf.
- **H3 VPN- oder Sicherheitssoftware**, die sich beim Andocken an den neuen Netzwerkadapter hängt: Der Fehlerbericht nennt einen Treiber dieses Herstellers oder `tcpip.sys`/`ndis.sys`/`netio.sys`, und bei den Programmen der letzten 14 Tage steht ein Update von VPN-Client oder Virenschutz.
- **H4 Hardware** (Arbeitsspeicher, Dock, Kabel): Die Bluescreen-Einträge zeigen wechselnde Stopcodes, oder es gibt Kernel-Power 41 ohne vorherigen Bluescreen-Eintrag.

**Befehl für den Laptop**

In ein normales PowerShell-Fenster einfügen, am besten **nicht angedockt**. Adminrechte sind nicht nötig; mit Adminrechten listet der Block zusätzlich die Speicherabbilder. Er liest nur, ändert nichts und legt die Ausgabe zusätzlich in `%TEMP%\bluescreen.txt` ab (Modell, Treiber, Programme, keine Passwörter).

```powershell
$seit = (Get-Date).AddDays(-14)
function K($t, $n = 300) { $t = ("$t" -replace '\s+', ' ').Trim(); if ($t.Length -gt $n) { $t.Substring(0, $n) + ' ...' } else { $t } }
& {
  '== System'
  $cs = Get-CimInstance Win32_ComputerSystem; $os = Get-CimInstance Win32_OperatingSystem; $bios = Get-CimInstance Win32_BIOS
  $cv = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
  $admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  "$($cs.Model) | BIOS $($bios.SMBIOSBIOSVersion) vom $($bios.ReleaseDate) | $($os.Caption) $($cv.DisplayVersion) Build $($os.BuildNumber).$($cv.UBR)"
  "Domäne: $($cs.PartOfDomain) | Admin: $admin | letzter Start: $($os.LastBootUpTime)"

  '== Bluescreens und unerwartete Neustarts (1001 = Bluescreen mit Stopcode, 41 = Kernel-Power, 6008 = unerwartet)'
  Get-WinEvent -FilterHashtable @{ LogName = 'System'; Id = 1001, 41, 6008; StartTime = $seit } -ErrorAction SilentlyContinue |
    Select-Object TimeCreated, ProviderName, Id, @{ n = 'Meldung'; e = { K $_.Message 260 } } | Format-Table -AutoSize -Wrap

  '== Fehlerberichte zu Bluescreens (der Fehlerbucket nennt oft schon den Treiber)'
  Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'Windows Error Reporting'; Id = 1001; StartTime = $seit } -ErrorAction SilentlyContinue |
    Where-Object { $_.Message -match 'BlueScreen|LiveKernelEvent' } | Select-Object -First 10 TimeCreated, @{ n = 'Meldung'; e = { K $_.Message 500 } } | Format-Table -AutoSize -Wrap

  '== Speicherabbilder'
  Get-ChildItem "$env:windir\Minidump\*.dmp", "$env:windir\MEMORY.DMP" -ErrorAction SilentlyContinue |
    Select-Object FullName, LastWriteTime, @{ n = 'MB'; e = { [int]($_.Length / 1MB) } } | Format-Table -AutoSize
  if (-not $admin) { '(Minidump-Ordner ist nur als Administrator lesbar)' }

  '== Treiberpakete, die in den letzten 14 Tagen dazukamen'
  Get-ChildItem "$env:windir\INF\oem*.inf" -ErrorAction SilentlyContinue | Where-Object { $_.CreationTime -gt $seit } | Sort-Object CreationTime -Descending | ForEach-Object {
    [pscustomobject]@{ Inf = $_.Name; Angelegt = $_.CreationTime
      Klasse   = K (Select-String -LiteralPath $_.FullName -Pattern '^\s*Class\s*=' -List).Line 40
      Anbieter = K (Select-String -LiteralPath $_.FullName -Pattern '^\s*Provider\s*=' -List).Line 40
      Version  = K (Select-String -LiteralPath $_.FullName -Pattern '^\s*DriverVer\s*=' -List).Line 60 }
  } | Format-Table -AutoSize -Wrap

  '== Dock, USB-C/Thunderbolt, Grafik und Netzwerk mit Treiber (auch gerade nicht angeschlossene Geräte)'
  Get-PnpDevice -ErrorAction SilentlyContinue |
    Where-Object { $_.Class -eq 'Display' -or ($_.Class -eq 'Net' -and $_.FriendlyName -notmatch 'WAN Miniport|Bluetooth|Kernel') -or $_.FriendlyName -match 'Dock|DisplayLink|USB GbE|Realtek USB|Thunderbolt|USB4' } | ForEach-Object {
      $p = Get-PnpDeviceProperty -InstanceId $_.InstanceId -KeyName DEVPKEY_Device_DriverVersion, DEVPKEY_Device_DriverInfPath -ErrorAction SilentlyContinue
      [pscustomobject]@{ Geraet = $_.FriendlyName; Status = $_.Status
        Version = ($p | Where-Object KeyName -eq 'DEVPKEY_Device_DriverVersion').Data
        Inf     = ($p | Where-Object KeyName -eq 'DEVPKEY_Device_DriverInfPath').Data }
    } | Sort-Object Geraet, Version -Unique | Format-Table -AutoSize -Wrap

  '== Zusätzliche Netzwerkkomponenten (VPN, Sicherheitssoftware)'
  Get-NetAdapterBinding -ErrorAction SilentlyContinue | Where-Object { $_.ComponentID -notlike 'ms_*' -and $_.Enabled } |
    Sort-Object ComponentID -Unique | Format-Table DisplayName, ComponentID -AutoSize

  '== Programme, installiert oder aktualisiert in den letzten 14 Tagen'
  Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
    Where-Object { "$($_.InstallDate)" -match '^\d{8}$' -and $_.InstallDate -ge $seit.ToString('yyyyMMdd') } |
    Sort-Object InstallDate -Descending | Format-Table InstallDate, DisplayName, DisplayVersion -AutoSize

  '== Windows Update, letzte 20 Vorgänge ohne Defender-Signaturen (auch Treiber und Firmware)'
  $s = (New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher()
  $s.QueryHistory(0, [math]::Min($s.GetTotalHistoryCount(), 150)) | Where-Object { $_.Title -notmatch 'KB2267602' } | Select-Object -First 20 |
    Format-Table Date, @{ n = 'Ergebnis'; e = { switch ($_.ResultCode) { 2 { 'ok' } 3 { 'mit Fehlern' } 4 { 'fehlgeschlagen' } default { $_ } } } }, @{ n = 'Titel'; e = { K $_.Title 110 } } -AutoSize -Wrap
} | Out-String -Width 250 | Tee-Object -FilePath "$env:TEMP\bluescreen.txt"
```

**Was ich von dir brauche**

- Die Ausgabe hier rein, oder die Datei `%TEMP%\bluescreen.txt`.
- Stürzt er auch ab, wenn er gar nicht am Dock hängt, oder nur beim Anstecken und im angedockten Betrieb?
- Welches Dock ist es (Modell steht unten drauf, zum Beispiel WD19S oder WD22TB4), und hat sich seit dem Wochenende am Arbeitsplatz etwas geändert: anderes Dock, anderer Monitor, eine Update- oder Neustartmeldung?
- Falls bis dahin noch ein Bluescreen kommt: ein Handyfoto davon. Die Zeile unter dem Stopcode nennt die `.sys`.

**Danach**

Steht der Treiber fest, schlage ich dir den Fix mit Weg zurück vor: Treiber zurücksetzen oder die Version installieren, die Dell zu BIOS und Dock-Firmware passend anbietet. Das ist eine Änderung, die du vorher freigibst, und auf einem Firmenlaptop meist Sache der IT. Nennt das Ereignisprotokoll den Treiber nicht, bleibt die Auswertung des Speicherabbilds mit WinDbg (`!analyze -v`). Dafür braucht es Adminrechte, also du selbst oder eure IT.

**Quellen**

- Microsoft Learn, Bug Check 0xD1 DRIVER_IRQL_NOT_LESS_OR_EQUAL: https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/bug-check-0xd1--driver-irql-not-less-or-equal
- Microsoft Q&A, DRIVER_IRQL_NOT_LESS_OR_EQUAL mit rtux64w10.sys: https://learn.microsoft.com/en-us/answers/questions/5650832/how-to-fix-driver-irql-not-less-or-equal-what-fail
- Microsoft Q&A, Realtek USB GbE Family Controller: Update über Windows Update führt zu Bluescreen: https://learn.microsoft.com/en-us/answers/questions/625988/realtek-lan-other-hardware-realtek-usb-gbe-family
- HP Community, Bluescreen mit rtux64w10.sys nur bei LAN über das Dock: https://h30434.www3.hp.com/t5/Notebook-Wireless-and-Networking/BSOD-with-rtux64w10-sys/td-p/8000168
- Dell, Treiberanleitung für die Docks WD19 und WD22TB4: https://www.dell.com/support/kbdoc/en-pa/000128783/driver-installation-guide-for-dell-docking-station-wd19
- Microsoft Learn, Kernel-Speicherabbild mit WinDbg auswerten: https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/analyzing-a-kernel-mode-dump-file-with-windbg
