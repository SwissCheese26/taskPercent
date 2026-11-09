// Geräte-Fenster: Tab-Router, Modal-Helfer und gemeinsame Utilities.
const $ = (id) => document.getElementById(id);
const api = window.api;
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
