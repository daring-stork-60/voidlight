// Original synthesized sound: everything is generated with WebAudio, no audio files.
// Starts only after a user gesture (browser autoplay policy).
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let muted = false;
  let musicOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch (e) {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t0);
  }

  // Tiny ambient bass sequencer: a slow minor pulse, started on first gesture.
  const bassLine = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 73.42, 0, 65.41, 0];
  let step = 0;
  function startMusic() {
    if (!ctx || musicOn || muted) return;
    musicOn = true;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const f = bassLine[step % bassLine.length];
      step++;
      if (f) tone(f, 0.5, 'sine', 0.12);
    }, 240);
  }

  return {
    unlock() { if (ensure()) { if (ctx.state === 'suspended') ctx.resume(); startMusic(); } },
    shoot() { tone(880, 0.07, 'square', 0.08, 440); },
    enemyShoot() { tone(220, 0.12, 'sawtooth', 0.05, 160); },
    explosion() { noise(0.35, 0.35, 900); tone(120, 0.3, 'sawtooth', 0.15, 40); },
    pickup() { tone(660, 0.08, 'sine', 0.15); window.setTimeout(() => tone(990, 0.1, 'sine', 0.15), 60); },
    powerup() { [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => tone(f, 0.12, 'sine', 0.15), i * 70)); },
    hit() { tone(160, 0.25, 'sawtooth', 0.25, 60); noise(0.2, 0.2, 600); },
    nova() { tone(200, 0.7, 'sine', 0.3, 1200); noise(0.6, 0.25, 2400); },
    wave() { [392, 523, 659].forEach((f, i) => window.setTimeout(() => tone(f, 0.15, 'triangle', 0.15), i * 90)); },
    gameOver() { [392, 330, 262, 196].forEach((f, i) => window.setTimeout(() => tone(f, 0.3, 'triangle', 0.18), i * 160)); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    isMuted() { return muted; },
  };
}
