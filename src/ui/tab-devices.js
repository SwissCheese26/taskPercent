// Tab "Geräte": Wiedergabe- und Aufnahmegeräte mit Lautstärke und Stummschaltung.
(function () {
  const root = $('devices-root'), lead = $('devices-lead');
  let timer;

  function card(d) {
    const c = el('div', 'card' + (d.Volume < 0 ? ' dim' : ''));
    const top = el('div', 'row between');
    const left = el('div', 'grow');
    left.append(el('div', 'name', d.Name), el('div', 'meta', d.Flow === 'render' ? 'Wiedergabe' : 'Aufnahme'));
    const right = el('div', 'row');
    if (d.IsDefault) right.append(el('span', 'badge on', 'Standard'));
    top.append(left, right); c.append(top);

    if (d.Volume >= 0) {
      const row = el('div', 'slider');
      const mute = el('button', 'ghost', d.Muted ? 'Stumm' : 'Laut'); mute.style.width = '86px';
      const range = el('input'); range.type = 'range'; range.min = 0; range.max = 100; range.value = d.Volume; range.setAttribute('aria-label', 'Lautstärke ' + d.Name); paintRange(range);
      const out = el('output', null, d.Volume + '%');
      row.append(mute, range, out); row.style.gridTemplateColumns = '96px 1fr 60px'; c.append(row);
      let t; range.oninput = () => { paintRange(range); out.textContent = range.value + '%'; clearTimeout(t); t = setTimeout(() => api.audioVolume(d.Id, +range.value), 60); };
      mute.onclick = async () => { d.Muted = !d.Muted; mute.textContent = d.Muted ? 'Stumm' : 'Laut'; await api.audioMute(d.Id, d.Muted); };
    } else c.append(el('div', 'meta', 'Lautstärke für dieses Gerät nicht regelbar'));
    return c;
  }

  async function refresh() {
    const r = await api.audioList();
    if (!r.ok) { lead.textContent = 'Geräte konnten nicht gelesen werden: ' + r.error; return; }
    lead.textContent = 'Lautstärke und Stummschaltung deiner Audiogeräte – ohne Admin-Rechte.';
    // Aktive Bedienung nicht durch Refresh stoeren
    if (root.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    root.innerHTML = '';
    for (const [flow, title] of [['render', 'Wiedergabe'], ['capture', 'Aufnahme']]) {
      const list = r.data.filter((d) => d.Flow === flow); if (!list.length) continue;
      root.append(el('h3', null, title)); list.forEach((d) => root.append(card(d)));
    }
  }
  tabs.devices = { open() { refresh(); clearInterval(timer); timer = setInterval(refresh, 4000); }, close() { clearInterval(timer); } };
  tabs.devices.open();
})();
