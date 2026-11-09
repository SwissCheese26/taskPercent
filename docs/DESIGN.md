# Design

Ruhig, hell/dunkel nach Systemeinstellung, an Apple-Systemfarben angelehnt. Kein Neon, keine Glows, keine Mono-Labels.

## Tokens (`src/ui/tokens.css`)
| | Hell | Dunkel |
|---|---|---|
| Fenster / Karte | `#F5F5F7` / `#FFFFFF` | `#1C1C1E` / `#2C2C2E` |
| Text · sekundär | `#1D1D1F` · `#6E6E73` | `#F5F5F7` · `#98989D` |
| Akzent (Buttons) | `#007AFF` | `#0A84FF` |
| Grün · Orange · Rot | `#34C759` `#FF9500` `#FF3B30` | `#30D158` `#FF9F0A` `#FF453A` |

Akkuzustand: normal/lädt = grün, knapp = orange, kritisch = rot (`data-state` am `<body>`).
Schrift: Segoe UI Variable (Display/Text). Radius 14 (Karten) / 9 (Controls). Bewegung 120–600 ms, `prefers-reduced-motion` aus.

## Komponenten
- **Flyout:** Titel + Status, durchgehender Fortschrittsring, gruppierte Liste (Status, Restzeit, Warnschwelle, Autostart), blauer Hauptknopf.
- **Geräte-Fenster:** Sidebar mit farbigen Symbolkacheln (wie iOS-Einstellungen), Karten mit sanftem Schatten, iOS-Schalter, runde Schieberegler.
- **Warnung:** Banner im Mitteilungsstil mit Symbolkachel, Titel, Text und Prozentzahl.
- **Tray-Icon:** nur die Zahl (hell/dunkel passend zur Taskleiste); Farbe nur bei Laden (grün), knapp (orange); kritisch blinkt gegen roten Grund.
