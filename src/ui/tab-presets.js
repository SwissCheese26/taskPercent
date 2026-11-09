// Tab "Voreinstellungen": ein Klick setzt Warnschwelle, Lautstärke, Mikrofon, Taskleisten-Pins und Vorschau-Effekte.
(function () {
  const root = $('presets-root');
  const ICONS = {
    video: '<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3"/>',
    game: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10v5M4.5 12.5h5M16 11h.01M18 14h.01"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    bolt: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 3.5-3 6.5a2.5 2.5 0 0 1-5 0"/><path d="M12 9.5a1.5 1.5 0 0 1 3 0"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  };
  let state = null, banner = '';

  function tile(p) {
    const t = el('div', 'ico', `<svg viewBox="0 0 24 24">${ICONS[p.icon] || ICONS.star}</svg>`);
    t.style.cssText = `background:${p.color};width:44px;height:44px;border-radius:11px`; t.firstChild.style.cssText = 'width:24px;height:24px'; return t;
  }
  function card(p) {
    const active = state.active === p.id;
    const c = el('div', 'card'); const row = el('div', 'row');
    const mid = el('div', 'grow'); mid.append(el('div', 'name', esc(p.name)), el('div', 'meta', esc(p.desc)), el('div', 'meta', esc(p.summary || '')));
    mid.lastChild.style.opacity = '.8';
    row.append(tile(p), mid);
    if (p.custom) { const del = el('button', 'ghost', 'Löschen'); del.onclick = async () => { await api.presetDelete(p.id); load(); }; row.append(del); }
    if (active) row.append(el('span', 'badge on', 'Aktiv'));
    const b = el('button', active ? 'ghost' : 'primary', active ? 'Erneut anwenden' : 'Aktivieren');
    b.onclick = async () => {
      b.disabled = true; const r = await api.presetApply(p.id);
      banner = r.ok ? (r.data.notes.length ? 'Angewendet mit Hinweisen: ' + r.data.notes.join('; ') : `„${p.name}“ ist aktiv.`) : 'Fehlgeschlagen: ' + r.error;
      load();
    };
    row.append(b); c.append(row); return c;
  }
  async function load() {
    const r = await api.presetList(); if (!r.ok) { root.textContent = r.error; return; }
    state = r.data; root.innerHTML = '';
    if (banner || state.canUndo) {
      const bar = el('div', 'card'); const row = el('div', 'row between'); row.append(el('span', null, esc(banner || 'Zuletzt geändert.')));
      if (state.canUndo) { const u = el('button', 'ghost', 'Rückgängig'); u.onclick = async () => { await api.presetUndo(); banner = 'Rückgängig gemacht.'; load(); }; row.append(u); }
      bar.append(row); root.append(bar);
    }
    state.presets.filter((p) => !p.custom).forEach((p) => root.append(card(p)));
    const mine = state.presets.filter((p) => p.custom);
    root.append(el('h3', null, 'Eigene'));
    mine.forEach((p) => root.append(card(p)));
    const save = el('button', 'ghost', 'Aktuellen Zustand als Voreinstellung sichern…'); save.style.marginTop = '4px';
    save.onclick = async () => {
      const v = await ask({ title: 'Voreinstellung sichern', html: '<p>Speichert Warnschwelle, Lautstärke und Stummschaltung von Standard-Lautsprecher und -Mikrofon sowie deine Taskleisten-Icons.</p><input id="preset-name" type="text" placeholder="Name" maxlength="30" style="width:100%;margin-top:12px;height:36px;border:0;border-radius:8px;background:var(--surface-2);color:var(--text);padding:0 12px;font:14px var(--font)">', buttons: [{ label: 'Abbrechen', value: false }, { label: 'Sichern', primary: true, value: true }] });
      if (!v) return; const name = $('modal-body').querySelector('input').value;
      const r2 = await api.presetSave(name); banner = r2.ok ? `„${name}“ gesichert.` : r2.error; load();
    };
    root.append(save);
    root.append(el('p', 'note', 'Wirkt systemweit: Warnschwelle, Lautstärke/Stummschaltung des Standardgeräts, Taskleisten-Icons. Mikrofon- und Klang-Einstellungen aus der Voreinstellung (Effekte, Equalizer) sind eine Vorschau innerhalb der App. Auch per Tray-Menü oder <code>taskpercent preset Meeting</code>.'));
  }
  api.onPresetsChanged && api.onPresetsChanged(() => { if (!$('tab-presets').hidden) load(); });
  tabs.presets = { open() { load(); }, close() {} };
})();
