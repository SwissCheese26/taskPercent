# taskPercent

Zeigt den Akkustand als **Zahl direkt im Tray-Icon** der Windows-11-Taskleiste – und warnt bei **15 % oder weniger**.

| Zustand | Icon |
|---|---|
| > 30 % | dunkel, weisse Zahl |
| ≤ 30 % | gelb |
| ≤ 15 % (Akkubetrieb) | **rot, blinkend** + Windows-Benachrichtigung + Warnfenster unten rechts |
| am Netzteil | grün |

## Benutzen

1. `BatteryTray.ps1` irgendwohin legen (z. B. `C:\Tools\taskPercent\`).
2. Rechtsklick → **Mit PowerShell ausführen**
   (oder: `powershell -ExecutionPolicy Bypass -File BatteryTray.ps1`).
3. Rechtsklick aufs Icon → **Mit Windows starten** für Autostart. **Warnung testen** zeigt das Warnfenster.

> **Windows 11 versteckt neue Icons** im Überlauf (`^`-Pfeil). Einmal das Icon von dort in die Taskleiste ziehen,
> oder: Einstellungen → Personalisierung → Taskleiste → *Weitere Taskleistensymbole* → „PowerShell" einschalten.

Schwellwerte (`$WarnThreshold` usw.) stehen oben im Skript. Keine Installation, keine Zusatzpakete.
