// Web Audio synth. No audio files.
let ctx = null;
let master = null;
let muted = false;
let unlocked = false;

function ensure() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  return ctx;
}

export function setMuted(v) {
  muted = !!v;
  if (master) master.gain.value = muted ? 0 : 0.35;
}
export function isMuted() { return muted; }

export function unlock() {
  ensure();
  if (ctx.state === 'suspended') ctx.resume();
  unlocked = true;
}

function envGain(t, atk, hold, rel, peak = 1) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + atk);
  g.gain.linearRampToValueAtTime(peak, t + atk + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + atk + hold + rel);
  return g;
}

function burstNoise(dur, color) {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    // crude lowpass to vary brightness
    last = last * (1 - color) + w * color;
    d[i] = last;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

function play(fn) {
  if (muted || !unlocked) return;
  ensure();
  try { fn(ctx, master); } catch (e) { /* ignore audio errors */ }
}

export const sfx = {
  coin(mult = 1) {
    play((ctx, out) => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880 * mult, t);
      osc.frequency.exponentialRampToValueAtTime(1760 * mult, t + 0.08);
      const g = envGain(t, 0.005, 0.03, 0.12, 0.5);
      osc.connect(g).connect(out);
      osc.start(t); osc.stop(t + 0.2);
    });
  },
  glass() {
    play((ctx, out) => {
      const t = ctx.currentTime;
      [1300, 1800, 2600].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f + (Math.random() - 0.5) * 60;
        const g = envGain(t, 0.001, 0.01, 0.18 - i * 0.03, 0.22);
        osc.connect(g).connect(out);
        osc.start(t); osc.stop(t + 0.3);
      });
    });
  },
  can() {
    play((ctx, out) => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
      const g = envGain(t, 0.002, 0.02, 0.1, 0.25);
      osc.connect(g).connect(out);
      osc.start(t); osc.stop(t + 0.15);
      const n = burstNoise(0.08, 0.35);
      const ng = envGain(t, 0.001, 0.01, 0.07, 0.25);
      n.connect(ng).connect(out);
      n.start(t);
    });
  },
  plastic() {
    play((ctx, out) => {
      const t = ctx.currentTime;
      const n = burstNoise(0.1, 0.5);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 1.2;
      const g = envGain(t, 0.002, 0.015, 0.09, 0.3);
      n.connect(bp).connect(g).connect(out);
      n.start(t);
    });
  },
  fizz() {
    play((ctx, out) => {
      const t = ctx.currentTime;
      const n = burstNoise(0.45, 0.6);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1800;
      const g = envGain(t, 0.01, 0.1, 0.3, 0.3);
      n.connect(hp).connect(g).connect(out);
      n.start(t);
    });
  },
  smash() {
    play((ctx, out) => {
      const t = ctx.currentTime;
      const n = burstNoise(0.35, 0.95);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2200;
      const g = envGain(t, 0.001, 0.04, 0.3, 0.45);
      n.connect(lp).connect(g).connect(out);
      n.start(t);
      [540, 820, 1240].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.2);
        const og = envGain(t, 0.002, 0.03, 0.18, 0.18);
        osc.connect(og).connect(out);
        osc.start(t); osc.stop(t + 0.3);
      });
    });
  },
  jackpot() {
    play((ctx, out) => {
      const t = ctx.currentTime;
      const notes = [523, 659, 784, 1046];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = f;
        const g = envGain(t + i * 0.06, 0.005, 0.08, 0.15, 0.22);
        osc.connect(g).connect(out);
        osc.start(t + i * 0.06); osc.stop(t + i * 0.06 + 0.3);
      });
    });
  },
  cardInsert() {
    play((ctx, out) => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.linearRampToValueAtTime(280, t + 0.09);
      const g = envGain(t, 0.002, 0.07, 0.04, 0.12);
      osc.connect(g).connect(out);
      osc.start(t); osc.stop(t + 0.15);
    });
  },
  press() {
    play((ctx, out) => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 440;
      const g = envGain(t, 0.001, 0.02, 0.03, 0.18);
      osc.connect(g).connect(out);
      osc.start(t); osc.stop(t + 0.1);
    });
  }
};
