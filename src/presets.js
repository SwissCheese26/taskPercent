// Eingebaute Voreinstellungen. Jedes Feld ist optional (fehlt = unveraendert).
//  threshold   Warnschwelle in % (5-30)
//  output/input  { volume: 0-100, muted: bool } fuer das aktuelle Standard-Wiedergabe-/Aufnahmegeraet
//  pinKinds    Peripherie-Arten, die in die Taskleiste gepinnt werden ('battery' = alle mit Akkuanzeige)
//  fx          { mic, eq } Namen von Vorschau-Presets in Mikrofon- bzw. Klang-Tab (wirken nur in der App)
const BUILTIN = [
  { id: 'meeting', name: 'Meeting', color: '#007AFF', icon: 'video', desc: 'Ruhiger Pegel, Mikro an, Stimmen im Fokus',
    threshold: 20, output: { volume: 55, muted: false }, input: { volume: 85, muted: false }, pinKinds: ['headset', 'mouse'], fx: { mic: 'Clean', eq: 'Stimme' } },
  { id: 'gaming', name: 'Gaming', color: '#AF52DE', icon: 'game', desc: 'Lauter, Controller- und Headset-Akku im Blick',
    threshold: 15, output: { volume: 70, muted: false }, input: { volume: 80, muted: false }, pinKinds: ['gamepad', 'headset', 'mouse'], fx: { mic: 'Clean', eq: 'Bass + Höhen' } },
  { id: 'music', name: 'Musik', color: '#FF2D55', icon: 'music', desc: 'Moderate Lautstärke, Mikro aus, mehr Bass',
    output: { volume: 45, muted: false }, input: { muted: true }, pinKinds: ['headset'], fx: { eq: 'Bass-Boost' } },
  { id: 'travel', name: 'Unterwegs', color: '#34C759', icon: 'bolt', desc: 'Früheste Warnung, alle Akkus sichtbar',
    threshold: 30, output: { volume: 35, muted: false }, input: { muted: true }, pinKinds: ['battery'], fx: { mic: 'Clean', eq: 'Flach' } },
  { id: 'night', name: 'Nacht', color: '#5856D6', icon: 'moon', desc: 'Sehr leise, Bass gedämpft, Mikro aus',
    threshold: 20, output: { volume: 15, muted: false }, input: { muted: true }, fx: { eq: 'Weich' } },
  { id: 'hearing', name: 'Hörtest', color: '#FF9500', icon: 'ear', desc: 'Genau 50 % Lautstärke, flacher Klang',
    output: { volume: 50, muted: false }, input: { muted: true }, fx: { eq: 'Flach' } },
];
module.exports = { BUILTIN };
