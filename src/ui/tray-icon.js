// Zeichnet das Tray-Icon (32x32) als PNG-DataURL. Laeuft im Renderer (Canvas).
const TONES = { normal: '#5CF2C8', charging: '#C6FF4D', warn: '#FFB224', critical: '#FF4D5E' };

function drawTrayIcon(percent, state, inverted) {
  const S = 32, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const tone = TONES[state];
  const bg = inverted ? tone : '#0A0D12';
  const fg = inverted ? '#0A0D12' : tone;

  g.beginPath(); g.roundRect(0, 0, S, S, 8); g.fillStyle = bg; g.fill();
  if (!inverted) { g.lineWidth = 1.5; g.strokeStyle = tone + '66'; g.beginPath(); g.roundRect(.75, .75, S - 1.5, S - 1.5, 7.5); g.stroke(); }

  const txt = percent == null ? '--' : String(percent);
  const px = txt.length >= 3 ? 16 : 22;
  g.font = `700 ${px}px Bahnschrift, "Segoe UI", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
  g.fillText(txt, S / 2, 13);

  // Fuellstand-Balken unten
  g.fillStyle = fg + '40'; g.fillRect(4, 25, S - 8, 3);
  g.fillStyle = fg; g.fillRect(4, 25, Math.max(2, (S - 8) * (percent || 0) / 100), 3);

  if (state === 'charging') { // kleiner Blitz oben rechts
    g.fillStyle = fg; g.beginPath();
    g.moveTo(27, 1); g.lineTo(22, 7.5); g.lineTo(25, 7.5); g.lineTo(23, 12); g.lineTo(29, 5.5); g.lineTo(26, 5.5); g.closePath(); g.fill();
  }
  return c.toDataURL('image/png');
}
