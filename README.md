# Still

A quiet, browser-based visual timer for an external monitor or classroom smart board.

**Open the timer:** [lenguajelabs-design.github.io/VisualTime-](https://lenguajelabs-design.github.io/VisualTime-/)

The shrinking disc has a softly lit pond surface with slow ripples. It becomes still when the browser's reduced motion setting is on.

Open `dist/index.html` directly in a modern browser, or serve `dist` with `python3 -m http.server 4173 --directory dist`.

- Silent by default. Optional 196 Hz sine tone with a quiet harmonic, gradual attack and four-second fade; no repeating alarm.
- Quick presets and custom durations from 1 second to 180 minutes, with separate minutes/seconds and one-minute adjustments.
- Night mode dims the interface and pond, follows your system preference initially, and remembers your choice on this browser.
- Start, pause, resume, reset, and spacebar control.
- Full-screen classroom view, with a large-view fallback when browser fullscreen is unavailable.
- Countdown uses a wall-clock deadline to avoid interval drift. Background tabs update when the browser schedules them; a sleeping device cannot be guaranteed to sound on time. Keep the tab open. Screen wake lock is requested during playback where supported.
- No accounts, analytics, third-party fonts, or external requests in the timer itself. Hosted access may require the owner's sign-in.
- Sound comfort depends on the listener and speakers; preview begins only on request. Silent mode is always available.

Plain HTML, CSS, and JavaScript; no build required. The disc represents the proportion of the selected duration remaining, rather than a fixed 60-minute clock face.
