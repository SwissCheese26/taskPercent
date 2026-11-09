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
  periphPin: async () => ({ ok: true }), periphPinned: async () => ({ ok: true, data: ['k'] }),
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
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

// BiquadFilter erzeugen (frequency/gain sind AudioParams, nicht direkt zuweisbar)
function biquad(ctx, type, freq, q) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q; return f; }
