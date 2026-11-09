// Tab "Geräte": Wiedergabe- und Aufnahmegeräte mit Lautstärke und Stummschaltung.
(function () {
  const root = $('devices-root'), lead = $('devices-lead');
  let timer;

  function card(d) {
    const c = el('div', 'card' + (d.Volume < 0 ? ' dim' : ''));
    const top = el('div', 'row between');
    const left = el('div', 'grow');
    left.append(el('div', 'name', esc(d.Name)), el('div', 'meta', d.Flow === 'render' ? 'Wiedergabe' : 'Aufnahme'));
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

  // ---- Bluetooth + einmalige Admin-Freigabe
  const EXPLAIN = `<p>Um Bluetooth-Geräte zu <b>trennen oder wieder zu verbinden</b>, muss Windows das Gerät kurz deaktivieren – das darf nur ein Administrator.</p>
    <ul><li>Du siehst die Windows-Abfrage <b>nur ein einziges Mal</b> – nicht bei jedem Start.</li>
    <li>Es wird eine geplante Aufgabe angelegt, die ausschließlich „Bluetooth-Gerät trennen/verbinden“ kann – sonst nichts.</li>
    <li>Lautstärke, Mikrofon, Hörtest und Klang brauchen <b>keine</b> Admin-Rechte.</li>
    <li>Du kannst die Freigabe jederzeit hier wieder entfernen.</li></ul>`;
  let adminOk = false;
  async function ensureAdmin() {
    if (adminOk) return true;
    const choice = await ask({ title: 'Einmalige Admin-Freigabe', html: EXPLAIN, buttons: [{ label: 'Abbrechen', value: false }, { label: 'Einmalig freigeben', primary: true, value: true }] });
    if (!choice) return false;
    const r = await api.adminSetup();
    if (!r.ok) { await ask({ title: 'Freigabe nicht erteilt', html: '<p>' + esc(r.error) + '</p>', buttons: [{ label: 'OK', primary: true, value: 1 }] }); return false; }
    adminOk = true; return true;
  }
  function btCard(d) {
    const c = el('div', 'card');
    const row = el('div', 'row between'); const left = el('div', 'grow');
    left.append(el('div', 'name', esc(d.Name)), el('div', 'meta', 'Bluetooth'));
    const badge = el('span', 'badge' + (d.Connected ? ' on' : ''), d.Connected ? 'Verbunden' : d.Disabled ? 'Getrennt' : 'Nicht verbunden');
    const btn = el('button', d.Connected ? 'ghost' : 'primary', d.Connected ? 'Trennen' : 'Verbinden');
    btn.onclick = async () => {
      if (!(await ensureAdmin())) return;
      btn.disabled = true; btn.textContent = '…';
      const r = await api.btAction(d.Id, d.Connected ? 'disconnect' : 'connect');
      if (!r.ok) await ask({ title: 'Aktion fehlgeschlagen', html: '<p>' + esc(r.error) + '</p>', buttons: [{ label: 'OK', primary: true, value: 1 }] });
      refreshBt();
    };
    row.append(left, badge, btn); c.append(row); return c;
  }
  async function refreshBt() {
    const box = $('bt-root'); const r = await api.btList();
    box.innerHTML = '';
    if (!r.ok) { box.append(el('p', 'note', 'Bluetooth konnte nicht gelesen werden: ' + esc(r.error))); return; }
    if (!r.data.length) { box.append(el('p', 'note', 'Keine gekoppelten Bluetooth-Geräte gefunden.')); return; }
    r.data.forEach((d) => box.append(btCard(d)));
  }
  async function adminCard() {
    const s = await api.adminStatus(); adminOk = !!(s.ok && s.data);
    const c = $('admin-root'); c.innerHTML = '';
    const card = el('div', 'card'); const row = el('div', 'row between');
    const l = el('div', 'grow'); l.append(el('div', 'name', 'Admin-Freigabe'), el('div', 'meta', adminOk ? 'Eingerichtet – keine weitere Abfrage nötig' : 'Nur für Bluetooth trennen/verbinden nötig'));
    row.append(l, el('span', 'badge' + (adminOk ? ' on' : ''), adminOk ? 'Aktiv' : 'Nicht aktiv'));
    const b = el('button', 'ghost', adminOk ? 'Entfernen' : 'Einrichten…');
    b.onclick = async () => { if (adminOk) { await api.adminRemove(); } else { await ensureAdmin(); } adminCard(); };
    row.append(b); card.append(row); c.append(card);
  }

  root.innerHTML = '<div id="admin-root"></div><h3>Bluetooth</h3><div id="bt-root"></div><div id="audio-root"></div>';
  async function refreshAudio() {
    const r = await api.audioList();
    if (!r.ok) { lead.textContent = 'Geräte konnten nicht gelesen werden: ' + r.error; return; }
    lead.textContent = 'Lautstärke und Stummschaltung deiner Audiogeräte – ohne Admin-Rechte.';
    const box = $('audio-root');
    if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return; // Bedienung nicht stoeren
    box.innerHTML = '';
    for (const [flow, title] of [['render', 'Wiedergabe'], ['capture', 'Aufnahme']]) {
      const list = r.data.filter((d) => d.Flow === flow); if (!list.length) continue;
      box.append(el('h3', null, title)); list.forEach((d) => box.append(card(d)));
    }
  }
  tabs.devices = { open() { adminCard(); refreshBt(); refreshAudio(); clearInterval(timer); timer = setInterval(refreshAudio, 4000); }, close() { clearInterval(timer); } };
  tabs.devices.open();
})();
