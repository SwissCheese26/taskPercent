// Tab "Peripherie": Maus, Tastatur, Controller, Headsets usw. mit Akkustand und Pin fuer die Taskleiste.
(function () {
  const root = $('periph-root'), lead = $('periph-lead');
  const KIND = { mouse: 'Maus', keyboard: 'Tastatur', gamepad: 'Controller', headset: 'Headset', camera: 'Kamera', other: 'Gerät' };
  const PLUG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/></svg>';
  let timer, pinned = new Set();

  function glyphCanvas(kind, tone) { // iOS-App-Symbol: farbige Kachel mit weissem Glyph
    const c = el('canvas'); c.width = c.height = 96; c.style.cssText = 'width:48px;height:48px;flex:none'; const g = c.getContext('2d');
    g.fillStyle = tone; g.beginPath(); g.roundRect(0, 0, 96, 96, 22); g.fill(); drawGlyph(g, kind, 48, 48, 56, '#fff'); return c;
  }
  function card(d) {
    const tone = d.Battery == null ? (d.Wired ? '#636366' : '#8E8E93') : (d.Battery <= 15 ? '#FF3B30' : d.Battery <= 30 ? '#FF9500' : '#007AFF');
    const barTone = GLYPH_TONES[batteryTone(d.Battery)];
    const c = el('div', 'card'); const row = el('div', 'row');
    const left = el('div', 'grow'); left.append(el('div', 'name', esc(d.Name)), el('div', 'meta', KIND[d.Kind] + ' · ' + d.Bus));
    row.append(glyphCanvas(d.Kind, tone), left);
    if (d.Wired) { const w = el('span', 'badge', PLUG + ' Kabel'); w.style.cssText = 'display:inline-flex;gap:6px;align-items:center;padding:4px 10px'; row.append(w); }
    const pct = el('div'); pct.style.cssText = 'text-align:right;min-width:90px';
    pct.append(el('div', 'name', d.Battery == null ? '—' : d.Battery + '%'));
    const bar = el('div', 'meter'); bar.style.marginTop = '6px';
    const fill = el('i'); fill.style.cssText = `width:${d.Battery ?? 0}%;background:${barTone}`; bar.append(fill); pct.append(bar);
    if (d.Battery == null) pct.append(el('div', 'meta', 'Akku unbekannt'));
    if (!d.Wired) row.append(pct);
    const pin = el('button', pinned.has(d.Id) ? 'primary' : 'ghost', pinned.has(d.Id) ? 'In Taskleiste ✓' : 'In Taskleiste'); pin.style.minWidth = '140px';
    pin.setAttribute('aria-pressed', String(pinned.has(d.Id)));
    pin.onclick = async () => { const on = !pinned.has(d.Id); on ? pinned.add(d.Id) : pinned.delete(d.Id); await api.periphPin(d.Id, on); refresh(); };
    row.append(pin); c.append(row); return c;
  }
  async function refresh() {
    const [r, p] = await Promise.all([api.periphList(), api.periphPinned()]);
    pinned = new Set(p.ok ? p.data : []);
    if (!r.ok) { lead.textContent = 'Peripherie konnte nicht gelesen werden: ' + r.error; return; }
    lead.textContent = 'Alle angeschlossenen Geräte: kabellose mit Akkustand, kabelgebundene mit Kabel-Anzeige. Mit „In Taskleiste“ bekommt ein Gerät sein eigenes Tray-Icon – kabellose blinken unter 15 %.';
    root.innerHTML = '';
    if (!r.data.length) { root.append(el('p', 'note', 'Keine Peripherie-Geräte gefunden.')); return; }
    const order = ['mouse', 'keyboard', 'gamepad', 'headset', 'camera', 'other'], by = (a, b) => order.indexOf(a.Kind) - order.indexOf(b.Kind);
    const wireless = r.data.filter((d) => !d.Wired).sort(by), wired = r.data.filter((d) => d.Wired).sort(by);
    if (wireless.length) { root.append(el('h3', null, 'Kabellos')); wireless.forEach((d) => root.append(card(d))); }
    if (wired.length) { root.append(el('h3', null, 'Kabelgebunden')); wired.forEach((d) => root.append(card(d))); }
    root.append(el('p', 'note', 'Den Akkustand melden nur Geräte, die Windows ihn mitteilen (viele Bluetooth-Mäuse/-Tastaturen und Headsets). Kabelgebundene Geräte haben keinen Akku und zeigen stattdessen „Kabel“.'));
  }
  tabs.periph = { open() { refresh(); clearInterval(timer); timer = setInterval(refresh, 30000); }, close() { clearInterval(timer); } };
})();
