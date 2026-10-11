(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const presets = [...document.querySelectorAll('[data-minutes]')];
  let duration = 600000, remaining = duration, deadline = 0, state = 'ready';
  let endingSound = 'silent', context, audioEpoch = 0, wakeLock = null, lastSecond = -1;
  let nightMode = document.documentElement.dataset.theme === 'dark';
  const voices = new Set();
  const water = $('water');
  const waterContext = water.getContext?.('2d', { alpha: true });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let waterFraction = 1, waterFrame = 0, lastWaterFrame = 0;
  const announce = message => { $('announcement').textContent = message; };
  const readRemaining = () => state === 'running' ? Math.max(0, deadline - Date.now()) : remaining;
  const snapshot = () => ({ state, durationSeconds: duration / 1000, remainingSeconds: Math.ceil(readRemaining() / 1000), sound: endingSound });

  for (let i = 0; i < 60; i++) {
    const angle = i * Math.PI / 30;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const inner = i % 5 === 0 ? 175 : 180;
    for (const [name, value] of Object.entries({ x1: 200 + Math.sin(angle) * inner, y1: 200 - Math.cos(angle) * inner, x2: 200 + Math.sin(angle) * 184, y2: 200 - Math.cos(angle) * 184, class: 'tick' })) line.setAttribute(name, value);
    $('ticks').append(line);
  }

  function drawWater(now = 0) {
    if (!waterContext) return;
    const size = Math.max(1, water.clientWidth);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const pixels = Math.round(size * pixelRatio);
    if (water.width !== pixels || water.height !== pixels) {
      water.width = pixels;
      water.height = pixels;
    }
    const ctx = waterContext;
    ctx.setTransform(pixels / 400, 0, 0, pixels / 400, 0, 0);
    ctx.clearRect(0, 0, 400, 400);
    if (waterFraction <= 0) return;

    const time = reducedMotion.matches ? 0 : now / 1000;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(200, 200);
    ctx.arc(200, 200, 167, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * waterFraction);
    ctx.closePath();
    ctx.clip();

    // Deep, softly lit water. All highlights stay inside the remaining wedge.
    const depth = ctx.createLinearGradient(75, 35, 315, 370);
    depth.addColorStop(0, nightMode ? '#507d91' : '#8dbbc8');
    depth.addColorStop(.38, nightMode ? '#356278' : '#6399ad');
    depth.addColorStop(1, nightMode ? '#21465d' : '#346d88');
    ctx.fillStyle = depth;
    ctx.fillRect(33, 33, 334, 334);
    const light = ctx.createRadialGradient(122, 103, 12, 180, 170, 265);
    light.addColorStop(0, 'rgba(236,251,248,.33)');
    light.addColorStop(.6, 'rgba(212,239,238,.06)');
    light.addColorStop(1, 'rgba(12,59,80,.13)');
    ctx.fillStyle = light;
    ctx.fillRect(33, 33, 334, 334);

    // Wide rings move outward slowly, with tiny irregularities like pond ripples.
    const phase = (time * 4) % 31;
    for (let ring = 0; ring < 7; ring++) {
      const radius = 34 + ring * 31 + phase;
      if (radius > 188) continue;
      const strength = Math.max(0, 1 - radius / 205);
      const path = new Path2D();
      for (let point = 0; point <= 96; point++) {
        const angle = point / 96 * Math.PI * 2;
        const drift = Math.sin(angle * 3 + time * .28 + ring) * 2.6 + Math.sin(angle * 6 - time * .2) * 1.1;
        const r = radius + drift;
        const x = 198 + Math.cos(angle) * r;
        const y = 186 + Math.sin(angle) * r * .77;
        if (point === 0) path.moveTo(x, y); else path.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(17,70,91,${.1 * strength})`;
      ctx.lineWidth = 4.5;
      ctx.stroke(path);
      ctx.strokeStyle = `rgba(233,251,248,${.27 * strength})`;
      ctx.lineWidth = 1.6;
      ctx.stroke(path);
    }

    // Long, barely moving reflections make the surface feel open and quiet.
    for (let row = 0; row < 6; row++) {
      const y = 94 + row * 42;
      const start = 67 + (row % 3) * 15;
      const end = 328 - (row % 2) * 23;
      ctx.beginPath();
      for (let x = start; x <= end; x += 5) {
        const wave = Math.sin(x / 27 + time * .22 + row * .9) * 2.3 + Math.sin(x / 61 - time * .16) * 1.5;
        if (x === start) ctx.moveTo(x, y + wave); else ctx.lineTo(x, y + wave);
      }
      ctx.strokeStyle = `rgba(231,250,247,${row % 2 === 0 ? .095 : .055})`;
      ctx.lineWidth = row % 2 === 0 ? 1.8 : 1;
      ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(200, 200, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(24,67,83,.52)';
    ctx.fill();
    water.classList.add('is-ready');
  }

  function animateWater(now) {
    waterFrame = 0;
    if (document.visibilityState !== 'visible' || reducedMotion.matches) return;
    if (now - lastWaterFrame >= 40) {
      drawWater(now);
      lastWaterFrame = now;
    }
    waterFrame = requestAnimationFrame(animateWater);
  }
  function updateWaterMotion() {
    if (waterFrame) cancelAnimationFrame(waterFrame);
    waterFrame = 0;
    drawWater(performance.now());
    if (document.visibilityState === 'visible' && !reducedMotion.matches && waterContext) waterFrame = requestAnimationFrame(animateWater);
  }
  reducedMotion.addEventListener?.('change', updateWaterMotion);
  if (window.ResizeObserver) new ResizeObserver(() => drawWater(performance.now())).observe(water);
  else window.addEventListener('resize', () => drawWater(performance.now()));

  function render() {
    const left = readRemaining(), fraction = Math.max(0, Math.min(1, left / duration));
    waterFraction = fraction;
    const elapsedAngle = (1 - fraction) * Math.PI * 2;
    const x = 200 + 167 * Math.sin(elapsedAngle), y = 200 - 167 * Math.cos(elapsedAngle);
    $('sector').setAttribute('d', fraction >= .999999 ? 'M200 33 A167 167 0 1 1 199.999 33 Z' : fraction <= 0 ? '' : `M200 200 L${x} ${y} A167 167 0 ${fraction > .5 ? 1 : 0} 1 200 33 Z`);
    drawWater(performance.now());
    const seconds = Math.ceil(left / 1000);
    if (seconds !== lastSecond) {
      const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      $('time').textContent = text;
      $('time').setAttribute('aria-label', `${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds remaining`);
      $('dial').setAttribute('aria-label', `${Math.round(fraction * 100)} percent of selected time remains`);
      document.title = state === 'ready' ? 'Still · Calm visual timer' : `${text} · Still`;
      lastSecond = seconds;
    }
  }

  function updateControls() {
    const running = state === 'running';
    $('start').querySelector('span').textContent = running ? 'Pause timer' : state === 'paused' ? 'Resume timer' : state === 'finished' ? 'Start again' : 'Start timer';
    $('start').querySelector('path').setAttribute('d', running ? 'M7 5h3v14H7ZM15 5h3v14h-3Z' : 'm9 5 11 7-11 7Z');
    $('phase').textContent = running ? 'ONE THING AT A TIME' : state === 'paused' ? 'TAKE YOUR TIME' : state === 'finished' ? 'TIME COMPLETE' : 'YOUR TIME, AT YOUR PACE';
    $('session-title').textContent = state === 'finished' ? 'A moment to breathe.' : $('activity').value.trim() || 'A moment to focus.';
    $('time-caption').textContent = state === 'finished' ? 'Your time is complete.' : state === 'paused' ? 'paused · continue when you’re ready' : 'minutes remaining';
    document.body.classList.toggle('finished', state === 'finished');
    for (const button of presets) { button.disabled = running; button.setAttribute('aria-pressed', String(Number(button.dataset.minutes) * 60000 === duration)); }
    for (const control of $('custom-form').querySelectorAll('input, button')) control.disabled = running;
    lastSecond = -1;
    render();
  }

  function stopSound() {
    audioEpoch++;
    for (const voice of voices) { try { voice.stop(); } catch {} }
    voices.clear();
  }
  async function prepareAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('Audio unavailable');
    context ||= new AudioContext();
    if (context.state === 'suspended') await context.resume();
    return context;
  }
  async function armAudio() {
    const ctx = await prepareAudio();
    // A nearly silent pulse runs in a user gesture, so the final alert is not
    // silenced by browsers that require audio to be started by a button press.
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    gain.gain.value = .00001;
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(); oscillator.stop(ctx.currentTime + .025);
  }
  function endVoice(source, nodes) {
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      for (const node of nodes) { try { node.disconnect(); } catch {} }
    };
  }
  function playWindChime(ctx, now, level) {
    const notes = [[0, 783.99, 1], [.52, 1046.5, .72], [1.15, 659.25, .82], [1.78, 1174.66, .55]];
    for (const [offset, frequency, brightness] of notes) {
      const oscillator = ctx.createOscillator(), shimmer = ctx.createOscillator();
      const gain = ctx.createGain(), shimmerGain = ctx.createGain();
      const start = now + offset;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      shimmer.type = 'sine'; shimmer.frequency.value = frequency * 2.01;
      gain.gain.setValueAtTime(.00001, start);
      gain.gain.linearRampToValueAtTime(level * .24 * brightness, start + .11);
      gain.gain.exponentialRampToValueAtTime(.0001, start + 4.7);
      shimmerGain.gain.setValueAtTime(.00001, start);
      shimmerGain.gain.linearRampToValueAtTime(level * .025 * brightness, start + .09);
      shimmerGain.gain.exponentialRampToValueAtTime(.0001, start + 2.8);
      oscillator.connect(gain); gain.connect(ctx.destination);
      shimmer.connect(shimmerGain); shimmerGain.connect(ctx.destination);
      endVoice(oscillator, [oscillator, shimmer, gain, shimmerGain]);
      shimmer.onended = () => { try { shimmer.disconnect(); shimmerGain.disconnect(); } catch {} };
      oscillator.start(start); shimmer.start(start);
      oscillator.stop(start + 4.8); shimmer.stop(start + 2.9);
    }
  }
  function playOceanWave(ctx, now, level) {
    const length = Math.floor(ctx.sampleRate * 6.8);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let low = 0;
    for (let index = 0; index < length; index++) {
      low = low * .985 + (Math.random() * 2 - 1) * .015;
      samples[index] = low * 8;
    }
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 980; filter.Q.value = .45;
    gain.gain.setValueAtTime(.00001, now);
    gain.gain.linearRampToValueAtTime(level * .16, now + 1.1);
    gain.gain.linearRampToValueAtTime(level * .07, now + 2.8);
    gain.gain.linearRampToValueAtTime(level * .18, now + 4.2);
    gain.gain.exponentialRampToValueAtTime(.0001, now + 6.75);
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    endVoice(source, [source, filter, gain]);
    source.start(now); source.stop(now + 6.8);
  }
  async function playEndingSound() {
    stopSound();
    const epoch = audioEpoch;
    try {
      const ctx = await prepareAudio();
      if (epoch !== audioEpoch || endingSound === 'silent') return;
      const level = Number($('volume').value) / 100;
      if (level === 0) return;
      const now = ctx.currentTime;
      if (endingSound === 'chime') playWindChime(ctx, now, level);
      if (endingSound === 'ocean') playOceanWave(ctx, now, level);
    } catch { $('sound-description').textContent = 'Your browser could not start this sound. Try “Test this sound” once, then start the timer.'; }
  }
  async function keepAwake() {
    if (state !== 'running' || document.visibilityState !== 'visible' || wakeLock || !navigator.wakeLock) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (state !== 'running') { await lock.release(); return; }
      wakeLock = lock;
      $('awake-note').textContent = 'Keeping this screen awake while the timer runs.';
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; $('awake-note').textContent = 'Keep this tab open while your timer runs.'; });
    } catch { /* A denied wake lock does not prevent the timer from running. */ }
  }
  function releaseAwake() { if (wakeLock) { void wakeLock.release().catch(() => {}); wakeLock = null; } }
  function finish() {
    if (state !== 'running') return;
    remaining = 0; state = 'finished'; releaseAwake(); updateControls();
    announce('Your time is complete. A moment to breathe.');
    if (endingSound !== 'silent') void playEndingSound();
  }
  function start() {
    if (state === 'running') return;
    stopSound();
    if (remaining <= 0) remaining = duration;
    deadline = Date.now() + remaining; state = 'running';
    if (endingSound !== 'silent') void armAudio().catch(() => { $('sound-description').textContent = 'Your browser could not start this sound. Try “Test this sound” once, then start the timer.'; });
    updateControls(); void keepAwake(); announce('Timer started.');
  }
  function pause() {
    if (state !== 'running') return;
    remaining = readRemaining();
    if (remaining <= 0) { finish(); return; }
    state = 'paused'; releaseAwake(); updateControls(); announce('Timer paused.');
  }
  function reset() { stopSound(); state = 'ready'; remaining = duration; releaseAwake(); updateControls(); announce('Timer reset.'); }
  function setDuration(minutes) {
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 1 / 60 || minutes > 180) throw new Error('Choose a duration between 1 second and 180 minutes.');
    if (state === 'running') throw new Error('Pause the timer before changing its duration.');
    duration = Math.round(minutes * 60) * 1000;
    writeCustomDuration(duration / 1000);
    clearDurationError();
    reset();
    announce(`Timer set to ${Math.floor(duration / 60000)} minutes ${duration / 1000 % 60} seconds.`);
  }
  function setSound(kind) {
    endingSound = kind; stopSound();
    for (const option of document.querySelectorAll('[data-sound]')) option.setAttribute('aria-pressed', String(option.dataset.sound === kind));
    $('sound-settings').hidden = kind === 'silent';
    const descriptions = {
      silent: 'A gentle on-screen finish. No sound.',
      chime: 'Four warm chimes, spaced gently apart.',
      ocean: 'One soft, rolling ocean wave.'
    };
    $('sound-description').textContent = descriptions[kind];
    if (kind !== 'silent') void armAudio().catch(() => { $('sound-description').textContent = 'Select “Test this sound” once before starting your timer.'; });
  }
  $('start').addEventListener('click', () => state === 'running' ? pause() : start());
  $('reset').addEventListener('click', reset);
  presets.forEach(button => button.addEventListener('click', () => setDuration(Number(button.dataset.minutes))));
  function writeCustomDuration(seconds) {
    $('minutes').value = String(Math.floor(seconds / 60));
    $('seconds').value = String(seconds % 60);
  }
  function clearDurationError() {
    $('duration-error').hidden = true;
    $('duration-error').textContent = '';
    for (const id of ['minutes', 'seconds']) $(id).removeAttribute('aria-invalid');
  }
  function readCustomDuration() {
    if (!$('custom-form').reportValidity()) return null;
    return Number($('minutes').value) * 60 + Number($('seconds').value);
  }
  $('custom-form').addEventListener('input', clearDurationError);
  $('custom-form').addEventListener('submit', event => {
    event.preventDefault();
    if (state === 'running') return;
    const seconds = readCustomDuration();
    if (seconds === null) return;
    if (seconds < 1 || seconds > 10800) {
      $('duration-error').textContent = 'Choose a time from 1 second to 180 minutes.';
      $('duration-error').hidden = false;
      for (const id of ['minutes', 'seconds']) $(id).setAttribute('aria-invalid', 'true');
      $('minutes').focus();
      return;
    }
    setDuration(seconds / 60);
  });
  for (const [id, adjustment] of [['less-time', -60], ['more-time', 60]]) {
    $(id).addEventListener('click', () => {
      if (state === 'running') return;
      const seconds = readCustomDuration();
      if (seconds === null) return;
      writeCustomDuration(Math.max(1, Math.min(10800, seconds + adjustment)));
      clearDurationError();
    });
  }
  function applyTheme() {
    document.documentElement.dataset.theme = nightMode ? 'dark' : 'light';
    $('theme-toggle').setAttribute('aria-pressed', String(nightMode));
    $('theme-toggle').title = nightMode ? 'Turn off night mode' : 'Turn on night mode';
    document.querySelector('meta[name="theme-color"]').content = nightMode ? '#101b24' : '#f6f8fa';
    drawWater(performance.now());
  }
  $('theme-toggle').addEventListener('click', () => {
    nightMode = !nightMode;
    try { localStorage.setItem('still-theme', nightMode ? 'dark' : 'light'); } catch {}
    applyTheme();
  });
  applyTheme();
  $('activity').addEventListener('input', updateControls);
  document.querySelectorAll('[data-sound]').forEach(option => option.addEventListener('click', () => setSound(option.dataset.sound)));
  $('preview').addEventListener('click', () => { if (voices.size) stopSound(); else void playEndingSound(); });
  $('volume').addEventListener('input', () => { $('volume-value').value = `${$('volume').value}%`; stopSound(); });
  function setPresentation(enabled) {
    document.body.classList.toggle('presenting', enabled);
    $('fullscreen').querySelector('span').textContent = enabled ? 'Exit full screen' : 'Full screen';
  }
  $('fullscreen').addEventListener('click', async () => {
    if (document.body.classList.contains('presenting')) {
      setPresentation(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    } else {
      setPresentation(true);
      try { await document.documentElement.requestFullscreen(); } catch { /* The large classroom view also works without browser fullscreen permission. */ }
    }
  });
  document.addEventListener('fullscreenchange', () => setPresentation(Boolean(document.fullscreenElement)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setPresentation(false);
    if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,button,textarea,select,a,[contenteditable]')) return;
    event.preventDefault(); state === 'running' ? pause() : start();
  });
  const tick = () => { if (state === 'running') { if (readRemaining() <= 0) finish(); else render(); } };
  setInterval(tick, 100);
  document.addEventListener('visibilitychange', () => { tick(); updateWaterMotion(); if (document.visibilityState === 'visible') void keepAwake(); });
  updateControls();
  updateWaterMotion();

  // Progressive enhancement for browsers with WebMCP; no dependency or network access.
  if (document.modelContext?.registerTool) {
    const lifecycle = new AbortController();
    const register = tool => { try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {} };
    register({ name: 'read_timer', description: 'Read the current countdown, duration, and playback state.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: snapshot });
    register({ name: 'configure_timer', description: 'Set duration in minutes while stopped or paused. Resets the countdown without starting it.', inputSchema: { type: 'object', properties: { minutes: { type: 'number', minimum: 1 / 60, maximum: 180 } }, required: ['minutes'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: input => { setDuration(input?.minutes); return snapshot(); } });
    register({ name: 'control_timer', description: 'Start, pause, or reset the visible timer. Start uses the sound choice already selected by the user.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['start', 'pause', 'reset'] } }, required: ['action'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: input => { const actions = { start, pause, reset }; if (!input || !Object.hasOwn(actions, input.action)) throw new Error('Choose start, pause, or reset.'); actions[input.action](); return snapshot(); } });
    window.addEventListener('pagehide', event => { if (!event.persisted) lifecycle.abort(); });
  }
})();
