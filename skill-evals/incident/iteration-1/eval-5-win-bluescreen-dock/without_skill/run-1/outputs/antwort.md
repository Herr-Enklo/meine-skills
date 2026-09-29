Das lässt sich meistens gut eingrenzen. DRIVER_IRQL_NOT_LESS_OR_EQUAL (Stopcode 0xD1) bedeutet: Ein Treiber hat auf Speicher zugegriffen, auf den er in diesem Moment nicht zugreifen durfte. Die .sys-Datei unter dem Stopcode („Fehlerursache: …“) ist genau dieser Treiber und damit der wichtigste Hinweis.

Weil es fast immer beim Andocken passiert, kommen vor allem die Treiber für die Geräte im Dock in Frage:

- der LAN-Anschluss im Dock (bei Dell-Docks meist ein Realtek-USB-Netzwerkchip, Dateiname z. B. rtux64w10.sys)
- DisplayLink, falls dein Dock damit arbeitet (z. B. Dell D6000; Dateien mit „dl“ oder „DisplayLink“ im Namen)
- Thunderbolt/USB4 oder der Intel-Grafiktreiber (igdkmd….sys), der beim Anschließen der Monitore zu tun bekommt
- seltener ein VPN- oder Virenschutz-Treiber, der sich in den Netzwerkverkehr einhängt, sobald das Dock-LAN aktiv wird

## Bis es gelöst ist

- Vor dem Andocken alles speichern.
- Laptop ausgeschaltet ans Dock hängen und erst dann einschalten. Das Einstecken im laufenden Betrieb ist oft genau der Moment, in dem der Treiber abstürzt.
- Wenn du WLAN hast: Im Geräte-Manager unter „Netzwerkadapter“ den USB-/Dock-LAN-Adapter testweise deaktivieren. Hören die Abstürze dann auf, ist der Verursacher gefunden.
- BitLocker: Nach mehreren Abstürzen kann Windows beim Start nach dem Wiederherstellungsschlüssel fragen. Leg ihn vorsorglich bereit (privat unter aka.ms/myrecoverykey mit deinem Microsoft-Konto, bei einem Firmengerät hat ihn die IT).

## 1. Den Treibernamen herausfinden

Windows legt bei jedem Bluescreen eine kleine Absturzdatei unter `C:\Windows\Minidump` ab. Am einfachsten liest du sie mit dem kostenlosen Tool **BlueScreenView** von NirSoft aus (läuft ohne Installation). Es zeigt für jeden Absturz Datum, Stopcode und in der Spalte „Caused By Driver“ den Treiber. Wer es genauer will: WinDbg aus dem Microsoft Store, Dump öffnen, `!analyze -v` eingeben.

Ohne Zusatztools siehst du im Zuverlässigkeitsverlauf (Win+R, `perfmon /rel`) wenigstens, wann genau die Abstürze waren. Und falls es noch mal passiert: Bluescreen mit dem Handy fotografieren.

## 2. Was hat sich seit gestern geändert?

Wenn es seit Montag (28.09.) passiert, gibt es fast immer einen Auslöser kurz davor:

- Einstellungen > Windows Update > Updateverlauf, besonders unter „Treiberupdates“
- Dell Command Update oder SupportAssist: Wurden BIOS, Treiber oder Dock-Firmware aktualisiert?
- Neues oder anderes Dock, anderer Monitor, neues USB-Gerät am Dock, neue VPN- oder Sicherheitssoftware?

## 3. Beheben

- **Treiber wurde gestern aktualisiert:** Geräte-Manager > Gerät > Eigenschaften > Treiber > „Vorheriger Treiber“. Bleibt es danach stabil, das Update zurückhalten, bis Dell oder Microsoft nachbessern.
- **Treiber ist eher alt:** Dell Command Update starten und alles einspielen, vor allem BIOS, Intel-Grafik, Chipsatz/Thunderbolt und den Realtek-USB-LAN-Treiber. Für Dell-Docks (WD19, WD22TB4 usw.) gibt es auf der Dell-Supportseite des Docks zusätzlich ein eigenes Firmware-Update. DisplayLink-Treiber am besten direkt beim Hersteller (Synaptics) holen.
- **Treiber gehört zu VPN- oder Virenschutz-Software:** diese aktualisieren oder testweise deinstallieren.
- **Analyse zeigt nur Windows-Dateien** wie ntoskrnl.exe, ndis.sys oder tcpip.sys: Das ist oft nur die Stelle des Absturzes, nicht der Verursacher (bei ndis/tcpip spricht es trotzdem stark für einen Netzwerktreiber). Dann zusätzlich in einem Terminal als Administrator `sfc /scannow` und `DISM /Online /Cleanup-Image /RestoreHealth` laufen lassen und mit `mdsched.exe` den Arbeitsspeicher testen.
- **Gegenprobe:** anderes Kabel, anderer USB-C-Port, wenn möglich ein anderes Dock. Tritt es dort nicht auf, liegt es am Dock bzw. seiner Firmware.

## Firmenlaptop?

Latitudes sind oft Dienstgeräte. Falls das bei dir so ist und du keine Adminrechte hast, gib das direkt an eure IT weiter: Stopcode, Uhrzeiten der Abstürze, Dock-Modell und die Dateien aus `C:\Windows\Minidump`. Gut möglich, dass gestern zentral ein Treiber verteilt wurde und Kollegen dasselbe Problem haben.

## Damit ich gezielter helfen kann

1. Welches Dock ist es (Modell steht auf der Unterseite, z. B. WD19S, WD22TB4, D6000) und welches Latitude-Modell?
2. Welchen Treiber zeigt BlueScreenView an?
3. Stürzt er auch ohne Dock ab?
4. Privat- oder Firmengerät?

Mit dem Treibernamen kann ich dir sagen, welches Update oder welcher Rollback konkret hilft.

Quellen:
- [Dell: Blue Screen (BSOD) Errors and Stop Code Issues in Windows](https://www.dell.com/support/contents/en-us/article/product-support/self-support-knowledgebase/fix-common-issues/blue-screen)
- [Windows Central: How to troubleshoot 'IRQL not less or equal' error on Windows 11](https://www.windowscentral.com/software-apps/windows-11/how-to-troubleshoot-irql-not-less-or-equal-error-on-windows-11)
