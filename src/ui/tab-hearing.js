// Tab "Hörtest": Reintöne pro Ohr und Frequenz, Lautstärke steigt langsam, Klick = gehört. Ergebnis als Audiogramm.
// Hinweis: Ohne Kalibrierung zeigen die Werte nur RELATIVE Unterschiede - kein medizinischer Test.
(function () {
  const root = $('hearing-root');
  const FREQS = [250, 500, 1000, 2000, 4000, 8000];
  const EARS = [['L', 'Links', -1], ['R', 'Rechts', 1]];
  const MIN_DB = -80, MAX_DB = -6, STEP_DB = 4, BEEP_MS = 800;
  let ctx, osc, gain, timer, abort = false;
  let results = { L: {}, R: {} };

  root.innerHTML = `
    <p class="lead">Ein Ton wird langsam lauter. Drücke <b>„Ich höre es“</b> (oder Leertaste), sobald du ihn gerade so wahrnimmst. Getestet werden 6 Frequenzen pro Ohr.</p>
    <div class="card" id="h-intro">
      <ul class="note" style="margin:0 0 12px 18px"><li>Kopfhörer aufsetzen, ruhiger Raum</li><li>Systemlautstärke auf ca. 50 % stellen und währenddessen <b>nicht verändern</b></li><li>Die Töne starten sehr leise – bleib bei Unsicherheit lieber beim ersten sicheren Hören</li></ul>
      <button class="primary" id="h-start">Hörtest starten</button>
    </div>
    <div class="card" id="h-run" hidden>
      <div class="row between"><div><div class="meta" id="h-ear">—</div><div class="big" id="h-freq">—</div></div><div class="meta" id="h-prog">—</div></div>
      <div class="meter" style="margin:14px 0"><i id="h-level"></i></div>
      <div class="row"><button class="primary" id="h-hear" style="height:48px; flex:1; font-size:16px">Ich höre es</button><button class="ghost" id="h-stop">Abbrechen</button></div>
    </div>
    <div id="h-result" hidden>
      <h3>Dein Audiogramm</h3>
      <canvas class="chart" id="h-chart" width="1400" height="520"></canvas>
      <div class="card" style="margin-top:12px" id="h-summary"></div>
      <p class="note">Je weiter oben die Kurve, desto leiser konnte der Ton sein. Das ist ein Orientierungstest mit deinem Gerät – kein Ersatz für einen Hörtest beim Ohrenarzt oder Akustiker.</p>
    </div>`;

  const dbToGain = (db) => Math.pow(10, db / 20);
  function stopAudio() { clearInterval(timer); if (osc) { try { osc.stop(); } catch {} } if (ctx) ctx.close(); ctx = osc = gain = null; }

  // Misst einen Schwellenwert; resolved mit dB (oder MAX_DB bei "nicht gehoert").
  function measure(freq, pan) {
    return new Promise((resolve) => {
      ctx = new AudioContext(); osc = ctx.createOscillator(); osc.frequency.value = freq;
      const p = ctx.createStereoPanner(); p.pan.value = pan; gain = ctx.createGain(); gain.gain.value = 0;
      osc.connect(gain).connect(p).connect(ctx.destination); osc.start();
      let db = MIN_DB, done = false;
      const finish = (v) => { if (done) return; done = true; $('h-hear').onclick = null; stopAudio(); resolve(v); };
      $('h-hear').onclick = () => finish(db);
      window._hStop = () => finish(null);
      const beep = () => {
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(dbToGain(db), t + 0.03);
        gain.gain.setValueAtTime(dbToGain(db), t + BEEP_MS / 1000 - 0.05); gain.gain.linearRampToValueAtTime(0, t + BEEP_MS / 1000);
        $('h-level').style.width = ((db - MIN_DB) / (MAX_DB - MIN_DB)) * 100 + '%';
        if (db >= MAX_DB) { setTimeout(() => finish(MAX_DB + 1), BEEP_MS); return; }
        db = Math.min(MAX_DB, db + STEP_DB);
      };
      beep(); timer = setInterval(beep, BEEP_MS + 450);
    });
  }

  async function run() {
    results = { L: {}, R: {} }; abort = false;
    $('h-intro').hidden = true; $('h-result').hidden = true; $('h-run').hidden = false;
    let n = 0; const total = EARS.length * FREQS.length;
    for (const [key, label, pan] of EARS) for (const f of FREQS) {
      if (abort) break;
      $('h-ear').textContent = label.toUpperCase() + 'ES OHR'; $('h-freq').textContent = f >= 1000 ? f / 1000 + ' kHz' : f + ' Hz'; $('h-prog').textContent = ++n + ' / ' + total;
      await new Promise((r) => setTimeout(r, 900));
      const v = await measure(f, pan); if (v === null) { abort = true; break; } results[key][f] = v;
    }
    $('h-run').hidden = true;
    if (abort) { $('h-intro').hidden = false; return; }
    showResult();
  }
  $('h-start').onclick = run;
  $('h-stop').onclick = () => { abort = true; if (window._hStop) window._hStop(); };
  document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !$('h-run').hidden) { e.preventDefault(); $('h-hear').click(); } });

  function showResult() {
    $('h-result').hidden = false;
    const all = EARS.flatMap(([k]) => FREQS.map((f) => results[k][f])); const best = Math.min(...all);
    const rel = (k, f) => results[k][f] - best; // 0 = bestes Ergebnis
    draw(rel);
    const sum = $('h-summary'); sum.innerHTML = '';
    const hints = [];
    for (const [k, label] of EARS) {
      const avg = FREQS.reduce((a, f) => a + rel(k, f), 0) / FREQS.length;
      sum.append(el('div', 'row between', `<span class="name">${label}</span><span class="meta">Ø ${avg.toFixed(0)} dB über deinem besten Wert</span>`));
      FREQS.filter((f) => rel(k, f) >= 24).forEach((f) => hints.push(`${label}: ${f >= 1000 ? f / 1000 + ' kHz' : f + ' Hz'} deutlich leiser wahrgenommen`));
    }
    const diff = FREQS.reduce((a, f) => a + rel('L', f) - rel('R', f), 0) / FREQS.length;
    if (Math.abs(diff) >= 8) hints.push(`Das ${diff > 0 ? 'rechte' : 'linke'} Ohr wirkt im Schnitt empfindlicher (≈ ${Math.abs(diff).toFixed(0)} dB)`);
    sum.append(el('p', 'note', hints.length ? 'Auffälligkeiten:<br>• ' + hints.join('<br>• ') : 'Keine auffälligen Unterschiede zwischen Frequenzen und Ohren.'));
  }
  function draw(rel) {
    const c = $('h-chart'), g = c.getContext('2d'), W = c.width, H = c.height, L = 90, R = 30, T = 30, B = 70;
    g.clearRect(0, 0, W, H); g.font = '22px "Segoe UI", system-ui, sans-serif'; g.textBaseline = 'middle';
    const x = (f) => L + (Math.log2(f / 250) / Math.log2(8000 / 250)) * (W - L - R), MAX = 60, y = (d) => T + (Math.min(d, MAX) / MAX) * (H - T - B);
    const cv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(); g.strokeStyle = cv('--sep'); g.fillStyle = cv('--text-3'); g.lineWidth = 1.5;
    for (let d = 0; d <= MAX; d += 20) { g.beginPath(); g.moveTo(L, y(d)); g.lineTo(W - R, y(d)); g.stroke(); g.textAlign = 'right'; g.fillText(d + ' dB', L - 12, y(d)); }
    FREQS.forEach((f) => { g.beginPath(); g.moveTo(x(f), T); g.lineTo(x(f), H - B); g.stroke(); g.textAlign = 'center'; g.fillText(f >= 1000 ? f / 1000 + 'k' : f, x(f), H - B + 28); });
    g.fillStyle = cv('--text-2'); g.textAlign = 'left'; g.fillText('↑ leiser hörbar', L + 10, T + 14);
    [['L', cv('--accent'), 'Links'], ['R', cv('--orange'), 'Rechts']].forEach(([k, col, name], i) => {
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 4; g.beginPath();
      FREQS.forEach((f, j) => (j ? g.lineTo(x(f), y(rel(k, f))) : g.moveTo(x(f), y(rel(k, f))))); g.stroke();
      FREQS.forEach((f) => { g.beginPath(); g.arc(x(f), y(rel(k, f)), 8, 0, 7); g.fill(); });
      g.fillText('● ' + name, W - R - 190 + i * 0, T + 14 + i * 28);
    });
  }
  tabs.hearing = { open() {}, close() { abort = true; stopAudio(); $('h-run').hidden = true; $('h-intro').hidden = false; } };
})();
