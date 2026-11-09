// Tray-Icon (32x32) als PNG-DataURL, gezeichnet im Renderer. Schlicht: nur die Zahl, Farbe nur wenn es zaehlt.
const TRAY = { green: '#30D158', orange: '#FF9F0A', red: '#FF453A' };
const isDarkTaskbar = () => !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches;

function drawTrayIcon(percent, state, inverted) {
  const S = 32, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const base = isDarkTaskbar() ? '#FFFFFF' : '#1D1D1F';
  let fg = base;
  if (state === 'charging') fg = TRAY.green; else if (state === 'warn') fg = TRAY.orange; else if (state === 'critical') fg = TRAY.red;

  if (inverted) { // Blink-Phase unter der Schwelle: roter Grund, weisse Zahl
    g.beginPath(); g.roundRect(0, 0, S, S, 9); g.fillStyle = TRAY.red; g.fill(); fg = '#FFFFFF';
  }
  const txt = percent == null ? '--' : String(percent);
  g.font = `600 ${txt.length >= 3 ? 19 : 25}px "Segoe UI Variable Display", "Segoe UI", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
  g.fillText(txt, S / 2, 17);
  if (state === 'charging' && !inverted) { // kleiner Blitz
    g.beginPath(); g.moveTo(28, 1); g.lineTo(23.5, 7); g.lineTo(26.5, 7); g.lineTo(24.5, 11.5); g.lineTo(30, 5); g.lineTo(27, 5); g.closePath(); g.fill();
  }
  return c.toDataURL('image/png');
}
