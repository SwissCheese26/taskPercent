// Geräte-Fenster: Tab-Router, Modal-Helfer und gemeinsame Utilities.
const $ = (id) => document.getElementById(id);
const api = window.api || { // Browser-Vorschau ohne Electron: Demo-Daten
  closeDevices() {},
  audioList: async () => ({ ok: true, data: [
    { Id: 'a', Name: 'Lautsprecher (Realtek Audio)', Flow: 'render', Volume: 42, Muted: false, IsDefault: true },
    { Id: 'b', Name: 'Kopfhörer (WH-1000XM5)', Flow: 'render', Volume: 65, Muted: false, IsDefault: false },
    { Id: 'c', Name: 'Mikrofon (Headset)', Flow: 'capture', Volume: 80, Muted: true, IsDefault: true } ] }),
  btList: async () => ({ ok: true, data: [
    { Name: 'WH-1000XM5', Id: 'BTHENUM\\DEV_1', Connected: true, Disabled: false },
    { Name: 'Galaxy Buds2', Id: 'BTHENUM\\DEV_2', Connected: false, Disabled: true } ] }),
  btAction: async () => ({ ok: true }), adminStatus: async () => ({ ok: true, data: false }),
  adminSetup: async () => ({ ok: true }), adminRemove: async () => ({ ok: true }),
  periphList: async () => ({ ok: true, data: [
    { Id: 'm', Name: 'MX Master 3S', Kind: 'mouse', Bus: 'Bluetooth', Battery: 82 },
    { Id: 'k', Name: 'Keychron K8', Kind: 'keyboard', Bus: 'Bluetooth', Battery: 27 },
    { Id: 'g', Name: 'Xbox Wireless Controller', Kind: 'gamepad', Bus: 'Bluetooth', Battery: 9 },
    { Id: 'h', Name: 'WH-1000XM5', Kind: 'headset', Bus: 'Bluetooth', Battery: 64 },
    { Id: 'w', Name: 'Logitech Webcam', Kind: 'other', Bus: 'USB', Battery: null } ] }),
  onDevicesTab() {}, periphPin: async () => ({ ok: true }), periphPinned: async () => ({ ok: true, data: ['k'] }),
  presetList: async () => ({ ok: true, data: { active: 'meeting', canUndo: true, presets: [
    { id: 'meeting', name: 'Meeting', color: '#007AFF', icon: 'video', desc: 'Ruhiger Pegel, Mikro an, Stimmen im Fokus', summary: 'Warnung 20% · Ausgabe 55% · Mikro 85%' },
    { id: 'gaming', name: 'Gaming', color: '#AF52DE', icon: 'game', desc: 'Lauter, Controller- und Headset-Akku im Blick', summary: 'Warnung 15% · Ausgabe 70% · Mikro 80%' },
    { id: 'music', name: 'Musik', color: '#FF2D55', icon: 'music', desc: 'Moderate Lautstärke, Mikro aus, mehr Bass', summary: 'Ausgabe 45% · Mikro stumm' },
    { id: 'travel', name: 'Unterwegs', color: '#34C759', icon: 'bolt', desc: 'Früheste Warnung, alle Akkus sichtbar', summary: 'Warnung 30% · Ausgabe 35% · Mikro stumm' },
    { id: 'night', name: 'Nacht', color: '#5856D6', icon: 'moon', desc: 'Sehr leise, Bass gedämpft, Mikro aus', summary: 'Warnung 20% · Ausgabe 15% · Mikro stumm' },
    { id: 'c1', name: 'Mein Setup', color: '#8E8E93', icon: 'star', desc: 'Eigene Voreinstellung', summary: 'Warnung 15% · Ausgabe 40%', custom: true } ] } }),
  presetApply: async () => ({ ok: true, data: { notes: [], canUndo: true } }), presetUndo: async () => ({ ok: true }), presetSave: async () => ({ ok: true }), presetDelete: async () => ({ ok: true }),
  fxGet: async () => ({ ok: true, data: {} }), onPresetsChanged() {},
  audioVolume: async () => ({ ok: true }), audioMute: async () => ({ ok: true }),
};
const tabs = {}; // Feature-Module registrieren sich hier: tabs.mic = { open(), close() }

function showTab(name) {
  document.querySelectorAll('nav [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.id !== 'tab-' + name));
  Object.entries(tabs).forEach(([k, t]) => (k === name ? t.open && t.open() : t.close && t.close()));
}
document.querySelectorAll('nav [role=tab]').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
$('close').onclick = () => api.closeDevices();
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.closeDevices(); });

// Modal: ask({title, html, buttons:[{label, primary, value}]}) -> Promise(value)
function ask({ title, html, buttons }) {
  return new Promise((resolve) => {
    $('modal-title').textContent = title; $('modal-body').innerHTML = html;
    const box = $('modal-actions'); box.innerHTML = '';
    buttons.forEach((b) => {
      const el = document.createElement('button'); el.className = b.primary ? 'primary' : 'ghost'; el.textContent = b.label;
      el.onclick = () => { $('modal').hidden = true; resolve(b.value); }; box.appendChild(el);
    });
    $('modal').hidden = false; box.lastChild.focus();
  });
}
// Slider-Fuellung (CSS-Variable) aktuell halten
function paintRange(r) { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%'); }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

// BiquadFilter erzeugen (frequency/gain sind AudioParams, nicht direkt zuweisbar)
function biquad(ctx, type, freq, q) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; return f; }

// Tab per Query (?tab=periph) oder per IPC oeffnen
document.addEventListener('DOMContentLoaded', () => { const t = new URLSearchParams(location.search).get('tab'); showTab(t && tabs[t] ? t : 'presets'); });
if (api.onDevicesTab) api.onDevicesTab((t) => tabs[t] && showTab(t));
