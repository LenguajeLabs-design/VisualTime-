(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const presets = [...document.querySelectorAll('[data-minutes]')];
  let duration = 600000, remaining = duration, deadline = 0, state = 'ready';
  let sound = false, context, audioEpoch = 0, wakeLock = null, lastSecond = -1;
  const voices = new Set();
  const announce = message => { $('announcement').textContent = message; };
  const readRemaining = () => state === 'running' ? Math.max(0, deadline - Date.now()) : remaining;
  const snapshot = () => ({ state, durationSeconds: duration / 1000, remainingSeconds: Math.ceil(readRemaining() / 1000), sound: sound ? 'soft tone' : 'silent' });

  for (let i = 0; i < 60; i++) {
    const angle = i * Math.PI / 30;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const inner = i % 5 === 0 ? 175 : 180;
    for (const [name, value] of Object.entries({ x1: 200 + Math.sin(angle) * inner, y1: 200 - Math.cos(angle) * inner, x2: 200 + Math.sin(angle) * 184, y2: 200 - Math.cos(angle) * 184, class: 'tick' })) line.setAttribute(name, value);
    $('ticks').append(line);
  }

  function render() {
    const left = readRemaining(), fraction = Math.max(0, Math.min(1, left / duration));
    const elapsedAngle = (1 - fraction) * Math.PI * 2;
    const x = 200 + 167 * Math.sin(elapsedAngle), y = 200 - 167 * Math.cos(elapsedAngle);
    $('sector').setAttribute('d', fraction >= .999999 ? 'M200 33 A167 167 0 1 1 199.999 33 Z' : fraction <= 0 ? '' : `M200 200 L${x} ${y} A167 167 0 ${fraction > .5 ? 1 : 0} 1 200 33 Z`);
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
    $('minutes').disabled = running;
    $('custom-form').querySelector('button').disabled = running;
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
  async function playTone() {
    stopSound();
    const epoch = audioEpoch;
    try {
      const ctx = await prepareAudio();
      if (epoch !== audioEpoch || !sound) return;
      const level = Number($('volume').value) / 100;
      if (level === 0) return;
      const now = ctx.currentTime;
      // Sine waves have no harsh high harmonics. A slow attack avoids a sharp onset.
      for (const [frequency, scale] of [[196, 1], [293.66, .25]]) {
        const oscillator = ctx.createOscillator(), gain = ctx.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(level * .22 * scale, now + .8);
        gain.gain.exponentialRampToValueAtTime(.0001, now + 3.6);
        gain.gain.linearRampToValueAtTime(0, now + 4);
        oscillator.connect(gain); gain.connect(ctx.destination);
        voices.add(oscillator);
        oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(now); oscillator.stop(now + 4.1);
      }
    } catch { $('sound-description').textContent = 'Sound is unavailable in this browser. The on-screen finish still works.'; }
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
    if (sound) void playTone();
  }
  function start() {
    if (state === 'running') return;
    stopSound();
    if (remaining <= 0) remaining = duration;
    deadline = Date.now() + remaining; state = 'running';
    if (sound) void prepareAudio().catch(() => { $('sound-description').textContent = 'Sound is unavailable. The on-screen finish still works.'; });
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
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < .1 || minutes > 180) throw new Error('Choose a duration between 0.1 and 180 minutes.');
    if (state === 'running') throw new Error('Pause the timer before changing its duration.');
    duration = Math.round(minutes * 60000); $('minutes').value = String(minutes); reset();
  }
  function setSound(enabled) {
    sound = enabled; stopSound();
    $('silent').setAttribute('aria-pressed', String(!sound)); $('tone').setAttribute('aria-pressed', String(sound));
    $('tone-settings').hidden = !sound;
    $('sound-description').textContent = sound ? 'One soft tone, then quiet.' : 'A gentle on-screen finish. No sound.';
    if (sound) void prepareAudio().catch(() => { $('sound-description').textContent = 'Sound is unavailable. The on-screen finish still works.'; });
  }
  $('start').addEventListener('click', () => state === 'running' ? pause() : start());
  $('reset').addEventListener('click', reset);
  presets.forEach(button => button.addEventListener('click', () => setDuration(Number(button.dataset.minutes))));
  $('custom-form').addEventListener('submit', event => { event.preventDefault(); if ($('minutes').checkValidity()) setDuration(Number($('minutes').value)); });
  $('activity').addEventListener('input', updateControls);
  $('silent').addEventListener('click', () => setSound(false));
  $('tone').addEventListener('click', () => setSound(true));
  $('preview').addEventListener('click', () => { if (voices.size) { stopSound(); } else void playTone(); });
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
  document.addEventListener('visibilitychange', () => { tick(); if (document.visibilityState === 'visible') void keepAwake(); });
  updateControls();

  // Progressive enhancement for browsers with WebMCP; no dependency or network access.
  if (document.modelContext?.registerTool) {
    const lifecycle = new AbortController();
    const register = tool => { try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {} };
    register({ name: 'read_timer', description: 'Read the current countdown, duration, and playback state.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: snapshot });
    register({ name: 'configure_timer', description: 'Set duration in minutes while stopped or paused. Resets the countdown without starting it.', inputSchema: { type: 'object', properties: { minutes: { type: 'number', minimum: .1, maximum: 180 } }, required: ['minutes'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: input => { setDuration(input?.minutes); return snapshot(); } });
    register({ name: 'control_timer', description: 'Start, pause, or reset the visible timer. Start uses the sound choice already selected by the user.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['start', 'pause', 'reset'] } }, required: ['action'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: input => { const actions = { start, pause, reset }; if (!input || !Object.hasOwn(actions, input.action)) throw new Error('Choose start, pause, or reset.'); actions[input.action](); return snapshot(); } });
    window.addEventListener('pagehide', event => { if (!event.persisted) lifecycle.abort(); });
  }
})();
