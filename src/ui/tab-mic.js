// Tab "Mikrofon-Labor": Pegelanzeige, Live-Monitor, Aufnahme-Test und Effekte (Echo, Hall, Bass, Höhen).
// Die Effekte wirken im Test/Monitor/Aufnahme dieser App - nicht systemweit (dafuer braeuchte es einen Audiotreiber).
(function () {
  const root = $('mic-root');
  const P = { gain: 100, bass: 0, treble: 0, echoTime: 0, echoFb: 0, echoMix: 0, reverb: 0 };
  const PRESETS = {
    Clean: { gain: 100, bass: 0, treble: 0, echoTime: 0, echoFb: 0, echoMix: 0, reverb: 0 },
    Echo: { gain: 100, bass: 0, treble: 0, echoTime: 320, echoFb: 45, echoMix: 55, reverb: 0 },
    Halle: { gain: 100, bass: 0, treble: 2, echoTime: 0, echoFb: 0, echoMix: 0, reverb: 65 },
    'Tief & warm': { gain: 110, bass: 9, treble: -3, echoTime: 0, echoFb: 0, echoMix: 0, reverb: 10 },
    Radio: { gain: 130, bass: -10, treble: 8, echoTime: 90, echoFb: 15, echoMix: 20, reverb: 0 },
  };
  const SLIDERS = [
    ['gain', 'Eingangspegel', 0, 200, 1, '%'], ['bass', 'Bass', -12, 12, 1, ' dB'], ['treble', 'Höhen', -12, 12, 1, ' dB'],
    ['echoTime', 'Echo-Abstand', 0, 800, 10, ' ms'], ['echoFb', 'Echo-Wiederholung', 0, 80, 1, '%'], ['echoMix', 'Echo-Stärke', 0, 100, 1, '%'], ['reverb', 'Hall', 0, 100, 1, '%'],
  ];
  const OPTS = [['noiseSuppression', 'Rauschunterdrückung'], ['echoCancellation', 'Echo-Unterdrückung (Gerät)'], ['autoGainControl', 'Automatische Pegelregelung']];
  const opt = { noiseSuppression: true, echoCancellation: false, autoGainControl: false };

  root.innerHTML = `
    <p class="lead">Teste dein Mikrofon und probiere Effekte aus. Die Effekte gelten für diesen Test, den Live-Monitor und die Probeaufnahme.</p>
    <div class="card">
      <div class="row"><label class="meta" for="mic-dev">Mikrofon</label><select id="mic-dev" class="grow"></select></div>
      <div class="meter" style="margin:16px 0 6px"><i id="mic-meter"></i></div>
      <div class="meta" id="mic-status">Bereit</div>
      <div class="row" style="margin-top:14px; flex-wrap:wrap">
        <button class="primary" id="mic-live">Live-Test starten</button>
        <button class="ghost" id="mic-rec">5 s aufnehmen &amp; abspielen</button>
        <audio id="mic-play" controls style="height:34px; display:none"></audio>
      </div>
      <p class="note" id="mic-warn">Tipp: Beim Live-Test Kopfhörer tragen, sonst koppelt der Lautsprecher zurück (Pfeifen).</p>
    </div>
    <h3>Effekte</h3><div class="pills" id="mic-presets"></div>
    <div class="card" style="margin-top:12px" id="mic-sliders"></div>
    <h3>Mikrofon-Verarbeitung</h3>
    <div class="card" id="mic-opts"></div>`;

  let ctx, stream, nodes, live = false, raf, recording = false;
  const outs = {};

  // ---- UI aufbauen
  Object.keys(PRESETS).forEach((n) => { const b = el('button', 'ghost', n); b.onclick = () => { Object.assign(P, PRESETS[n]); syncSliders(); apply(); document.querySelectorAll('#mic-presets button').forEach((x) => x.classList.toggle('on', x === b)); }; $('mic-presets').append(b); });
  SLIDERS.forEach(([k, label, min, max, step, unit]) => {
    const row = el('div', 'slider'); const r = el('input'); Object.assign(r, { type: 'range', min, max, step, value: P[k] }); r.id = 'sl-' + k; r.setAttribute('aria-label', label);
    const o = el('output'); outs[k] = o; row.append(el('span', null, label), r, o); $('mic-sliders').append(row);
    r.oninput = () => { P[k] = +r.value; paint(k, r, unit); apply(); }; paint(k, r, unit);
  });
  function paint(k, r, unit) { paintRange(r); outs[k].textContent = (k === 'bass' || k === 'treble') && P[k] > 0 ? '+' + P[k] + unit : P[k] + unit; }
  function syncSliders() { SLIDERS.forEach(([k, , , , , unit]) => { const r = $('sl-' + k); r.value = P[k]; paint(k, r, unit); }); }
  OPTS.forEach(([k, label]) => {
    const l = el('label', 'switch'); l.style.margin = '6px 0'; const i = el('input'); i.type = 'checkbox'; i.checked = opt[k];
    i.onchange = async () => { opt[k] = i.checked; if (stream) await openMic(); };
    l.append(i, el('span', 'track', '<i></i>'), document.createTextNode(label)); $('mic-opts').append(l);
  });
  $('mic-opts').append(el('p', 'note', 'Änderungen starten das Mikrofon kurz neu. „Echo-Unterdrückung“ nicht mit dem Live-Test kombinieren, wenn du Echo-Effekte hören willst.'));

  // ---- Audiograph
  function impulse(c) { // synthetischer Hall: abklingendes Rauschen
    const len = c.sampleRate * 2.2, buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    return buf;
  }
  function build() {
    ctx = new AudioContext(); const n = {};
    n.src = ctx.createMediaStreamSource(stream);
    n.gain = ctx.createGain();
    n.bass = biquad(ctx, 'lowshelf', 200);
    n.treble = biquad(ctx, 'highshelf', 4000);
    n.mix = ctx.createGain();
    n.delay = ctx.createDelay(1.0); n.fb = ctx.createGain(); n.echoWet = ctx.createGain();
    n.conv = Object.assign(ctx.createConvolver(), { buffer: impulse(ctx) }); n.revWet = ctx.createGain();
    n.master = ctx.createGain(); n.analyser = ctx.createAnalyser(); n.analyser.fftSize = 1024;
    n.monitor = ctx.createGain(); n.rec = ctx.createMediaStreamDestination();
    n.src.connect(n.gain).connect(n.bass).connect(n.treble);
    n.treble.connect(n.master);                       // trocken
    n.treble.connect(n.delay); n.delay.connect(n.fb).connect(n.delay); n.delay.connect(n.echoWet).connect(n.master); // Echo
    n.treble.connect(n.conv).connect(n.revWet).connect(n.master);                                                // Hall
    n.master.connect(n.analyser); n.master.connect(n.rec); n.master.connect(n.monitor).connect(ctx.destination);
    nodes = n; apply();
  }
  function apply() {
    if (!nodes) return; const t = ctx.currentTime, s = 0.03;
    nodes.gain.gain.setTargetAtTime(P.gain / 100, t, s);
    nodes.bass.gain.setTargetAtTime(P.bass, t, s); nodes.treble.gain.setTargetAtTime(P.treble, t, s);
    nodes.delay.delayTime.setTargetAtTime(Math.max(0.001, P.echoTime / 1000), t, s);
    nodes.fb.gain.setTargetAtTime(P.echoFb / 100, t, s); nodes.echoWet.gain.setTargetAtTime(P.echoTime ? P.echoMix / 100 : 0, t, s);
    nodes.revWet.gain.setTargetAtTime(P.reverb / 100 * 1.5, t, s);
    nodes.monitor.gain.setTargetAtTime(live ? 1 : 0, t, s);
  }
  async function openMic() {
    closeMic(true);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: $('mic-dev').value ? { exact: $('mic-dev').value } : undefined, ...opt } });
    } catch (e) { $('mic-status').textContent = 'Kein Zugriff aufs Mikrofon: ' + e.message; return false; }
    build(); meterLoop();
    $('mic-status').textContent = 'Mikrofon aktiv: ' + stream.getAudioTracks()[0].label; return true;
  }
  function closeMic(keepUi) {
    cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); if (ctx) ctx.close();
    stream = ctx = nodes = null; if (!keepUi) { live = false; $('mic-live').textContent = 'Live-Test starten'; $('mic-meter').style.width = '0'; $('mic-status').textContent = 'Bereit'; }
  }
  function meterLoop() {
    const buf = new Uint8Array(nodes.analyser.fftSize);
    const tick = () => { if (!nodes) return; nodes.analyser.getByteTimeDomainData(buf); let sum = 0; for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
      $('mic-meter').style.width = Math.min(100, Math.sqrt(sum / buf.length) * 260) + '%'; raf = requestAnimationFrame(tick); };
    tick();
  }
  async function listDevices() {
    const sel = $('mic-dev'), keep = sel.value;
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    sel.innerHTML = ''; sel.append(new Option('Standard-Mikrofon', '')); devs.forEach((d, i) => sel.append(new Option(d.label || 'Mikrofon ' + (i + 1), d.deviceId))); if (keep) sel.value = keep;
  }
  $('mic-dev').onchange = () => { if (stream) openMic(); };

  $('mic-live').onclick = async () => {
    if (live) { closeMic(); return; }
    if (!stream && !(await openMic())) return;
    await listDevices(); live = true; apply(); $('mic-live').textContent = 'Live-Test stoppen'; $('mic-status').textContent = 'Live – du hörst dich selbst (Kopfhörer!)';
  };
  $('mic-rec').onclick = async () => {
    if (recording) return; if (!stream && !(await openMic())) return; await listDevices();
    recording = true; const btn = $('mic-rec'); btn.disabled = true;
    const chunks = []; const mr = new MediaRecorder(nodes.rec.stream);
    mr.ondataavailable = (e) => chunks.push(e.data);
    mr.onstop = () => { const a = $('mic-play'); a.src = URL.createObjectURL(new Blob(chunks, { type: 'audio/webm' })); a.style.display = ''; a.play(); recording = false; btn.disabled = false; btn.textContent = '5 s aufnehmen & abspielen'; $('mic-status').textContent = 'Wiedergabe der Aufnahme'; if (!live) closeMic(true); };
    mr.start(); let left = 5; btn.textContent = 'Aufnahme… ' + left; $('mic-status').textContent = 'Sprich jetzt!';
    const iv = setInterval(() => { left--; btn.textContent = 'Aufnahme… ' + left; if (left <= 0) { clearInterval(iv); setTimeout(() => mr.stop(), P.echoTime || P.reverb ? 1500 : 200); btn.textContent = 'Fertig…'; } }, 1000);
  };

  tabs.mic = { open() { listDevices(); api.fxGet().then((r) => { const n = r.ok && r.data.mic; if (n) [...document.querySelectorAll('#mic-presets button')].find((b) => b.textContent === n)?.click(); }); }, close() { closeMic(); const a = $('mic-play'); a.pause(); } };
})();
