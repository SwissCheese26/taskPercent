// Tab "Peripherie": Maus, Tastatur, Controller, Headsets usw. mit Akkustand und Pin fuer die Taskleiste.
(function () {
  const root = $('periph-root'), lead = $('periph-lead');
  const KIND = { mouse: 'Maus', keyboard: 'Tastatur', gamepad: 'Controller', headset: 'Headset', other: 'Gerät' };
  let timer, pinned = new Set();

  function glyphCanvas(kind, tone) { // iOS-App-Symbol: farbige Kachel mit weissem Glyph
    const c = el('canvas'); c.width = c.height = 96; c.style.cssText = 'width:48px;height:48px;flex:none'; const g = c.getContext('2d');
    g.fillStyle = tone; g.beginPath(); g.roundRect(0, 0, 96, 96, 22); g.fill(); drawGlyph(g, kind, 48, 48, 56, '#fff'); return c;
  }
  function card(d) {
    const tone = d.Battery == null ? '#8E8E93' : (d.Battery <= 15 ? '#FF3B30' : d.Battery <= 30 ? '#FF9500' : '#007AFF');
    const barTone = GLYPH_TONES[batteryTone(d.Battery)];
    const c = el('div', 'card'); const row = el('div', 'row');
    const left = el('div', 'grow'); left.append(el('div', 'name', esc(d.Name)), el('div', 'meta', KIND[d.Kind] + ' · ' + d.Bus));
    row.append(glyphCanvas(d.Kind, tone), left);
    const pct = el('div'); pct.style.cssText = 'text-align:right;min-width:90px';
    pct.append(el('div', 'name', d.Battery == null ? '—' : d.Battery + '%'));
    const bar = el('div', 'meter'); bar.style.marginTop = '6px';
    const fill = el('i'); fill.style.cssText = `width:${d.Battery ?? 0}%;background:${barTone}`; bar.append(fill); pct.append(bar);
    if (d.Battery == null) pct.append(el('div', 'meta', 'Akku unbekannt'));
    row.append(pct);
    const pin = el('button', pinned.has(d.Id) ? 'primary' : 'ghost', pinned.has(d.Id) ? 'In Taskleiste ✓' : 'In Taskleiste'); pin.style.minWidth = '140px';
    pin.setAttribute('aria-pressed', String(pinned.has(d.Id)));
    pin.onclick = async () => { const on = !pinned.has(d.Id); on ? pinned.add(d.Id) : pinned.delete(d.Id); await api.periphPin(d.Id, on); refresh(); };
    row.append(pin); c.append(row); return c;
  }
  async function refresh() {
    const [r, p] = await Promise.all([api.periphList(), api.periphPinned()]);
    pinned = new Set(p.ok ? p.data : []);
    if (!r.ok) { lead.textContent = 'Peripherie konnte nicht gelesen werden: ' + r.error; return; }
    lead.textContent = 'Angeschlossene Geräte mit Akkustand. Mit „In Taskleiste“ bekommt ein Gerät sein eigenes Tray-Icon – blinkend unter 15 %.';
    root.innerHTML = '';
    if (!r.data.length) { root.append(el('p', 'note', 'Keine Peripherie-Geräte gefunden.')); return; }
    const order = ['mouse', 'keyboard', 'gamepad', 'headset', 'other'];
    r.data.sort((a, b) => order.indexOf(a.Kind) - order.indexOf(b.Kind)).forEach((d) => root.append(card(d)));
    root.append(el('p', 'note', 'Den Akkustand melden nur Geräte, die Windows ihn mitteilen (viele Bluetooth-Mäuse/-Tastaturen und Headsets). Kabelgebundene Geräte zeigen keinen Akku.'));
  }
  tabs.periph = { open() { refresh(); clearInterval(timer); timer = setInterval(refresh, 30000); }, close() { clearInterval(timer); } };
})();
