// Tab "Klang & Bass": Equalizer-Vorschau mit Demo-Beat/Ton, Bass-Boost, Mitten, Höhen, Stereo-Breite und Frequenz-Analyzer.
// Systemweiter EQ braucht einen Audiotreiber (z. B. Equalizer APO) - hier wird der Klang in der Vorschau eingestellt und getestet.
(function () {
  const root = $('sound-root');
  const BANDS = [['b60', '60 Hz', 60], ['b250', '250 Hz', 250], ['b1k', '1 kHz', 1000], ['b4k', '4 kHz', 4000], ['b12k', '12 kHz', 12000]];
  const V = { b60: 0, b250: 0, b1k: 0, b4k: 0, b12k: 0, width: 100, vol: 50 };
  const PRE = {
    Flach: { b60: 0, b250: 0, b1k: 0, b4k: 0, b12k: 0 },
    'Bass-Boost': { b60: 10, b250: 4, b1k: 0, b4k: 0, b12k: 0 },
    'Bass + Höhen': { b60: 8, b250: 2, b1k: -2, b4k: 3, b12k: 6 },
    Stimme: { b60: -4, b250: 0, b1k: 4, b4k: 3, b12k: -2 },
    'Weich': { b60: 3, b250: 2, b1k: 0, b4k: -3, b12k: -6 },
  };
  root.innerHTML = `
    <p class="lead">Spiel einen Demo-Beat oder Testton ab und stell Bass, Mitten und Höhen so ein, wie es dir gefällt – mit Live-Frequenzanzeige.</p>
    <div class="card">
      <div class="row" style="flex-wrap:wrap">
        <button class="primary" id="s-beat">Demo-Beat abspielen</button>
        <button class="ghost" id="s-sweep">Bass-Sweep (30–200 Hz)</button>
        <button class="ghost" id="s-stop">Stopp</button>
        <span class="meta grow" id="s-status" style="text-align:right">Gestoppt</span>
      </div>
      <canvas class="chart" id="s-viz" width="1400" height="360" style="height:180px;margin-top:14px"></canvas>
    </div>
    <h3>Equalizer</h3><div class="pills" id="s-presets"></div>
    <div class="card" style="margin-top:12px" id="s-eq"></div>
    <div class="card"><div class="slider"><span>Stereo-Breite</span><input type="range" id="s-width" min="0" max="200" value="100" aria-label="Stereo-Breite"><output id="o-width">100%</output></div>
      <div class="slider"><span>Vorschau-Lautstärke</span><input type="range" id="s-vol" min="0" max="100" value="50" aria-label="Vorschau-Lautstärke"><output id="o-vol">50%</output></div></div>
    <p class="note">Achtung bei starkem Bass-Boost: erst leise testen, hohe Pegel können Kopfhörer und Gehör belasten.</p>`;

  let ctx, filters, master, an, srcNodes = [], raf, timers = [];
  const fmt = (k, v) => (k === 'width' || k === 'vol' ? v + '%' : (v > 0 ? '+' : '') + v + ' dB');

  Object.keys(PRE).forEach((n) => { const b = el('button', 'ghost', n); b.onclick = () => { Object.assign(V, PRE[n]); syncEq(); apply(); document.querySelectorAll('#s-presets button').forEach((x) => x.classList.toggle('on', x === b)); }; $('s-presets').append(b); });
  BANDS.forEach(([k, label]) => {
    const row = el('div', 'slider'); const r = el('input'); Object.assign(r, { type: 'range', min: -12, max: 12, step: 1, value: 0, id: 'eq-' + k }); r.setAttribute('aria-label', label);
    const o = el('output', null, '0 dB'); o.id = 'o-' + k; row.append(el('span', null, label), r, o); $('s-eq').append(row);
    r.oninput = () => { V[k] = +r.value; paintRange(r); o.textContent = fmt(k, V[k]); apply(); }; paintRange(r);
  });
  function syncEq() { BANDS.forEach(([k]) => { const r = $('eq-' + k); r.value = V[k]; paintRange(r); $('o-' + k).textContent = fmt(k, V[k]); }); }
  [['s-width', 'width'], ['s-vol', 'vol']].forEach(([id, k]) => { const r = $(id); paintRange(r); r.oninput = () => { V[k] = +r.value; paintRange(r); $('o-' + k).textContent = fmt(k, V[k]); apply(); }; });

  function ensure() {
    if (ctx) return;
    ctx = new AudioContext();
    filters = BANDS.map(([k, , f], i) => biquad(ctx, i === 0 ? 'lowshelf' : i === BANDS.length - 1 ? 'highshelf' : 'peaking', f, 1));
    master = ctx.createGain(); an = ctx.createAnalyser(); an.fftSize = 2048; an.minDecibels = -90; an.maxDecibels = 0; an.smoothingTimeConstant = 0.82;
    // Stereo-Breite per Mid/Side
    const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
    ctx.wid = { mm: ctx.createGain(), ms: ctx.createGain(), sm: ctx.createGain(), ss: ctx.createGain(), inv: ctx.createGain(), l: ctx.createGain(), r: ctx.createGain() };
    // L' = M + k*S ; R' = M - k*S  mit M=(L+R)/2, S=(L-R)/2
    const w = ctx.wid; w.inv.gain.value = -1;
    const M = ctx.createGain(), S = ctx.createGain(); M.gain.value = 0.5; S.gain.value = 0.5; w.k = ctx.createGain();
    const sIn = ctx.createGain(), sInv = ctx.createGain(); sInv.gain.value = -1;
    const lOut = ctx.createGain(), rOut = ctx.createGain();
    filters.reduce((a, b) => (a.connect(b), b));
    filters[filters.length - 1].connect(split);
    split.connect(M, 0); split.connect(M, 1);
    split.connect(S, 0); split.connect(sInv, 1); sInv.connect(S);
    S.connect(w.k); M.connect(lOut); w.k.connect(lOut); M.connect(rOut); w.k.connect(w.inv); w.inv.connect(rOut);
    lOut.connect(merge, 0, 0); rOut.connect(merge, 0, 1);
    merge.connect(master); master.connect(an); master.connect(ctx.destination);
    apply(); draw();
  }
  function apply() {
    if (!ctx) return; const t = ctx.currentTime;
    filters.forEach((f, i) => f.gain.setTargetAtTime(V[BANDS[i][0]], t, 0.03));
    ctx.wid.k.gain.setTargetAtTime(V.width / 100, t, 0.03);
    master.gain.setTargetAtTime(Math.pow(V.vol / 100, 2) * 1.2, t, 0.03);
  }
  function clearSources() { timers.forEach(clearInterval); timers = []; srcNodes.forEach((n) => { try { n.stop(); } catch {} }); srcNodes = []; }

  function beat() { // 112 BPM: Kick, Hi-Hat, Bass-Linie, Akkorde
    ensure(); clearSources(); const spb = 60 / 112 / 2; let step = 0, next = ctx.currentTime + 0.1;
    const bassNotes = [43.65, 43.65, 51.91, 43.65, 58.27, 58.27, 49, 49]; const chord = [[220, 261.6, 329.6], [196, 246.9, 293.7]];
    const env = (g, t, a, d, peak) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    const sched = () => { while (next < ctx.currentTime + 0.3) {
      const t = next, s = step % 16;
      if (s % 4 === 0) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); env(g, t, 0.005, 0.28, 1); o.connect(g).connect(filters[0]); o.start(t); o.stop(t + 0.35); }
      if (s % 2 === 1) { const b = ctx.createBufferSource(), len = ctx.sampleRate * 0.05, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; b.buffer = buf; const hp = biquad(ctx, 'highpass', 7000), g = ctx.createGain(); env(g, t, 0.002, 0.04, 0.25); b.connect(hp).connect(g).connect(filters[0]); b.start(t); }
      if (s % 2 === 0) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = bassNotes[(s / 2) % 8]; const lp = biquad(ctx, 'lowpass', 400); env(g, t, 0.01, spb * 0.9, 0.5); o.connect(lp).connect(g).connect(filters[0]); o.start(t); o.stop(t + spb); }
      if (s % 8 === 0) chord[(s / 8) % 2].forEach((f) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; env(g, t, 0.05, spb * 7, 0.12); o.connect(g).connect(filters[0]); o.start(t); o.stop(t + spb * 8); });
      next += spb; step++; } };
    sched(); timers.push(setInterval(sched, 100)); $('s-status').textContent = 'Demo-Beat läuft';
  }
  function sweep() {
    ensure(); clearSources(); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; g.gain.value = 0.6;
    const t = ctx.currentTime; o.frequency.setValueAtTime(30, t); o.frequency.exponentialRampToValueAtTime(200, t + 10);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.6, t + 0.2); g.gain.setValueAtTime(0.6, t + 9.7); g.gain.linearRampToValueAtTime(0, t + 10);
    o.connect(g).connect(filters[0]); o.start(t); o.stop(t + 10); srcNodes.push(o); $('s-status').textContent = 'Bass-Sweep 30 → 200 Hz (10 s)';
    o.onended = () => ($('s-status').textContent = 'Gestoppt');
  }
  function stop() { clearSources(); $('s-status').textContent = 'Gestoppt'; }
  $('s-beat').onclick = beat; $('s-sweep').onclick = sweep; $('s-stop').onclick = stop;

  function draw() {
    const c = $('s-viz'), g = c.getContext('2d'), W = c.width, H = c.height;
    const bins = new Uint8Array(an.frequencyBinCount);
    const tick = () => {
      if (!ctx) return; an.getByteFrequencyData(bins); g.clearRect(0, 0, W, H);
      const n = 64, bw = W / n; const nyq = ctx.sampleRate / 2;
      for (let i = 0; i < n; i++) {
        const f0 = 30 * Math.pow(18000 / 30, i / n), f1 = 30 * Math.pow(18000 / 30, (i + 1) / n);
        let m = 0; for (let b = Math.floor(f0 / nyq * bins.length); b <= Math.ceil(f1 / nyq * bins.length) && b < bins.length; b++) m = Math.max(m, bins[b]);
        const h = Math.max(4, (m / 255) ** 1.4 * (H - 10));
        g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(); g.beginPath(); g.roundRect(i * bw + 3, H - h, bw - 6, h, 4); g.fill();
      }
      raf = requestAnimationFrame(tick);
    }; cancelAnimationFrame(raf); tick();
  }
  tabs.sound = { open() { api.fxGet().then((r) => { const n = r.ok && r.data.eq; if (n) [...document.querySelectorAll('#s-presets button')].find((b) => b.textContent === n)?.click(); }); }, close() { stop(); cancelAnimationFrame(raf); if (ctx) ctx.close(); ctx = null; } };
})();
