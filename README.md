# taskPercent

Akku-Prozente als **Zahl direkt im Windows-11-Tray** – mit Flyout im „Obsidian Cell"-Design und **Warnung bei ≤ 15 %**.
Technik: Electron (Main + Renderer), Vanilla HTML/CSS/JS, kein Framework.

## Starten (Windows, einmalig `npm install`)

```bash
npm install
npm start                 # oder: npx taskpercent
npx taskpercent show      # Flyout öffnen
npx taskpercent test      # Warnung ausprobieren
npx taskpercent quit      # beenden
npx taskpercent --simulate 14    # Akku simulieren (60c = 60 % am Netz)
npm link                  # optional: danach überall `taskpercent`
npm run dist              # portable .exe in dist/
```

## Features
- **Tray-Icon** mit Prozentzahl, Füllbalken und Zustandsfarbe (mint / amber / koralle / lime beim Laden, Blitz).
- **Flyout** per Klick: 20-Segment-Ring (je 5 %), Restzeit, Status, einstellbare Warnschwelle (5–30 %), Autostart-Schalter.
- **Warnung** (≤ Schwelle, nicht am Netzteil): blinkendes Icon, Windows-Benachrichtigung und eigener Toast unten rechts mit ablaufendem Balken. Neu scharf erst bei Schwelle + 5 % oder nach dem Einstecken.
- Win11 versteckt neue Tray-Icons im `^`-Überlauf – einmal in die Taskleiste ziehen.

## Geräte verwalten (Flyout → „Geräte verwalten", oder `npx taskpercent devices`)
- **Geräte:** Lautstärke und Stummschaltung aller Wiedergabe-/Aufnahmegeräte, Bluetooth-Geräte trennen/verbinden.
- **Mikrofon-Labor:** Pegelanzeige, Live-Test, 5-s-Aufnahme mit Wiedergabe, Echo, Hall, Bass, Höhen, Rauschunterdrückung.
- **Hörtest:** 6 Frequenzen pro Ohr, Audiogramm mit Auswertung (Orientierung, kein medizinischer Test).
- **Klang & Bass:** EQ (5 Bänder), Presets, Stereo-Breite, Demo-Beat / Bass-Sweep mit Live-Spektrum.

**Admin-Rechte:** Nur für Bluetooth trennen/verbinden. Beim ersten Versuch erklärt die App warum und zeigt **einmalig** die Windows-Abfrage.
Dabei wird die geplante Aufgabe `taskPercentHelper` angelegt (Skript in `%ProgramData%\taskPercent`, für Benutzer schreibgeschützt, Whitelist: nur Bluetooth-Geräte trennen/verbinden).
Danach keine Abfrage mehr; Entfernen jederzeit im Tab „Geräte". Alles andere läuft ohne Admin. Das Konto muss Administrator sein.

**Grenzen:** Effekte/EQ wirken in der App (Test, Monitor, Aufnahme, Vorschau), nicht systemweit – dafür bräuchte es einen Audiotreiber (z. B. Equalizer APO).

Designsystem: [docs/DESIGN.md](docs/DESIGN.md). Das ursprüngliche PowerShell-Skript liegt als `legacy-BatteryTray.ps1` bei.
