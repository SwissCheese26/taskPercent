// Geraete-Glyphen (Canvas) fuer Tray-Icons und die Peripherie-Liste.
const GLYPH_TONES = { normal: '#34C759', warn: '#FF9500', critical: '#FF3B30', unknown: '#8E8E93' };
function batteryTone(b) { return b == null ? 'unknown' : b <= 15 ? 'critical' : b <= 30 ? 'warn' : 'normal'; }

function drawGlyph(g, kind, cx, cy, s, color) { // s = Kantenlaenge des Glyph-Bereichs
  g.save(); g.translate(cx - s / 2, cy - s / 2); g.scale(s / 20, s / 20);
  g.strokeStyle = g.fillStyle = color; g.lineWidth = 1.7; g.lineCap = g.lineJoin = 'round';
  g.beginPath();
  if (kind === 'mouse') { g.roundRect(5.5, 1.5, 9, 17, 4.5); g.moveTo(5.5, 8); g.lineTo(14.5, 8); g.moveTo(10, 1.5); g.lineTo(10, 8); g.stroke(); }
  else if (kind === 'keyboard') { g.roundRect(1.5, 4.5, 17, 11, 2.5); g.stroke(); for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { g.beginPath(); g.arc(5 + c * 3.3, 8 + r * 3.4, .7, 0, 7); g.fill(); } g.fillRect(6, 12.4, 8, 1.2); }
  else if (kind === 'gamepad') { g.moveTo(5, 5); g.lineTo(15, 5); g.quadraticCurveTo(19, 5, 19, 10); g.lineTo(19, 13); g.quadraticCurveTo(19, 16, 16.5, 15); g.lineTo(13, 12.5); g.lineTo(7, 12.5); g.lineTo(3.5, 15); g.quadraticCurveTo(1, 16, 1, 13); g.lineTo(1, 10); g.quadraticCurveTo(1, 5, 5, 5); g.stroke(); g.beginPath(); g.moveTo(5.5, 7.5); g.lineTo(5.5, 10.5); g.moveTo(4, 9); g.lineTo(7, 9); g.stroke(); g.beginPath(); g.arc(14.5, 8, .9, 0, 7); g.arc(12.5, 10, .9, 0, 7); g.fill(); }
  else if (kind === 'headset') { g.arc(10, 11, 7, Math.PI, 0); g.stroke(); g.beginPath(); g.roundRect(2, 10.5, 3.5, 6, 1.5); g.roundRect(14.5, 10.5, 3.5, 6, 1.5); g.fill(); }
  else { g.arc(10, 10, 7, 0, 7); g.stroke(); g.beginPath(); g.moveTo(7.5, 7); g.lineTo(12.5, 13); g.lineTo(10, 15); g.lineTo(10, 5); g.lineTo(12.5, 7); g.lineTo(7.5, 13); g.stroke(); }
  g.restore();
}
// Tray-Icon (32x32): Glyph + duenner Akku-Balken; kritisch blinkt gegen roten Grund
function drawDeviceTrayIcon(kind, battery, inverted) {
  const S = 32, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const dark = !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches;
  const tone = GLYPH_TONES[batteryTone(battery)];
  let fg = dark ? '#FFFFFF' : '#1D1D1F';
  if (inverted) { g.beginPath(); g.roundRect(0, 0, S, S, 9); g.fillStyle = GLYPH_TONES.critical; g.fill(); fg = '#FFFFFF'; }
  drawGlyph(g, kind, S / 2, 13, 21, fg);
  const barC = inverted ? '#FFFFFF' : tone;
  g.fillStyle = (dark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.18)'); if (inverted) g.fillStyle = 'rgba(255,255,255,.35)';
  g.beginPath(); g.roundRect(4, 25, S - 8, 4, 2); g.fill();
  if (battery != null) { g.fillStyle = barC; g.beginPath(); g.roundRect(4, 25, Math.max(4, (S - 8) * battery / 100), 4, 2); g.fill(); }
  return c.toDataURL('image/png');
}
