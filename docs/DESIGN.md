# Design: "Obsidian Cell"

Tiefes Schwarzblau, ein einziger Akzent pro Zustand, der Rest ist Typografie und Licht. Der Akku ist ein **Ring aus 20 Zellen** (je 5 %), die aufleuchten wie LEDs.

## Tokens (`src/ui/tokens.css`)
| Gruppe | Werte |
|---|---|
| Fläche | `#0A0D12` Fenster · `#10151C` erhöht · `#171E28` Controls · `#222B38` Linie |
| Text | `#E8EEF6` · `#8895A7` gedimmt · `#566274` leise |
| Zustand | normal `#5CF2C8` · lädt `#C6FF4D` · knapp `#FFB224` · kritisch `#FF4D5E` |
| Schrift | Display: Bahnschrift (Fallback Segoe UI) · Mono: Cascadia Mono für Labels |
| Abstand | 4-px-Raster (4/8/12/16/24/32), Radius 14 / 8 / Pille |
| Motion | 140 ms Hover · 320 ms State · 900 ms Einblenden; `prefers-reduced-motion` schaltet alles ab |

Zustand wird nur über `data-state` am `<body>` gesetzt; `--tone`, Glow und Hintergrundschimmer folgen daraus.

## Komponenten
- **Flyout** (360×548): Header (Wortmarke + Status-Chip) → Ring + große Zahl → Stat-Leiste → Schwellen-Stepper → Footer (Switch, Aktionen).
- **Toast** (400×132): Zahl in Koralle pulsierend, Text, Balken der in 12 s ausläuft; Klick schließt.
- **Tray-Icon** (32 px): dunkle Kachel, Zahl in Zustandsfarbe, Balken unten; kritisch blinkt gegen eine invertierte (farbige) Kachel.

## Barrierefreiheit
Statuswechsel via `role=status`/`aria-live`, Toast `role=alert`, sichtbarer Fokusring in Zustandsfarbe, Zustand nie nur über Farbe (Chip-Text + Unterzeile).
