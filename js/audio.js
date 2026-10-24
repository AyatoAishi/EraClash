// Procedural WebAudio — zero asset files. SFX + a tiny generative music loop.
import { settings } from './settings.js';

let ctx = null, master, musicBus, sfxBus, noiseBuf;
const lastPlayed = {};
let musicTimer = null, musicStep = 0, musicMood = 'menu';

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus.connect(master); sfxBus.connect(master); master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyAudioSettings();
  startMusic();
}

export function applyAudioSettings() {
  if (!ctx) return;
  const a = settings.audio;
  master.gain.value = a.mute ? 0 : a.master;
  musicBus.gain.value = a.music * 0.5;
  sfxBus.gain.value = a.sfx;
}

function tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, when = 0, bus = sfxBus) {
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.3, filterFreq = 800, type = 'lowpass', when = 0) {
  const t = ctx.currentTime + when;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur);
}

const SFX = {
  click:   () => tone(880, 0.05, 'square', 0.08),
  hover:   () => tone(1320, 0.03, 'sine', 0.04),
  train:   () => { tone(440, 0.08, 'square', 0.1); tone(660, 0.1, 'square', 0.1, null, 0.07); },
  error:   () => { tone(180, 0.12, 'sawtooth', 0.1); tone(140, 0.15, 'sawtooth', 0.1, null, 0.1); },
  order:   () => tone(620, 0.06, 'triangle', 0.12, 760),
  attack:  () => tone(300, 0.08, 'sawtooth', 0.1, 520),
  hitAxe:  () => { noise(0.09, 0.22, 1200); tone(140, 0.08, 'square', 0.08, 70); },
  hitBaton:() => { noise(0.06, 0.18, 2500, 'bandpass'); tone(520, 0.05, 'square', 0.05, 300); },
  bow:     () => { noise(0.12, 0.12, 3000, 'bandpass'); tone(220, 0.08, 'triangle', 0.08, 120); },
  gun:     () => { noise(0.07, 0.3, 1800); tone(160, 0.05, 'square', 0.1, 60); },
  hitArrow:() => { noise(0.05, 0.16, 900); tone(300, 0.04, 'triangle', 0.06, 180); },
  hitBullet:() => { noise(0.04, 0.14, 4000, 'highpass'); },
  shop:    () => { tone(784, 0.06, 'square', 0.08); tone(1047, 0.09, 'square', 0.08, null, 0.05); },
  splat:   () => { noise(0.35, 0.4, 500); tone(90, 0.3, 'sawtooth', 0.18, 40); noise(0.2, 0.2, 2200, 'bandpass', 0.05); },
  whiff:   () => { noise(0.08, 0.08, 5000, 'highpass'); },
  zap:     () => { noise(0.12, 0.16, 5200, 'highpass'); tone(1400, 0.08, 'sawtooth', 0.06, 300); },
  evolve:  () => [392, 523, 659, 880].forEach((f, i) => tone(f, 0.16, 'square', 0.09, null, i * 0.07)),
  coin:    () => { tone(1320, 0.05, 'square', 0.05); tone(1760, 0.07, 'square', 0.05, null, 0.04); },
  snipe:   () => { noise(0.18, 0.4, 1200); tone(110, 0.22, 'square', 0.14, 40); noise(0.4, 0.06, 4000, 'highpass', 0.05); },
  death:   () => { tone(330, 0.35, 'sawtooth', 0.1, 60); noise(0.25, 0.12, 600); },
  baseHit: () => { tone(70, 0.25, 'sine', 0.3, 40); noise(0.15, 0.15, 300); },
  victory: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'square', 0.12, null, i * 0.15)),
  defeat:  () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.45, 'triangle', 0.16, null, i * 0.22)),
};

export function sfx(name, throttleMs = 40) {
  if (!ctx || !SFX[name]) return;
  const now = performance.now();
  if (lastPlayed[name] && now - lastPlayed[name] < throttleMs) return;
  lastPlayed[name] = now;
  SFX[name]();
}

// ---- generative music: minor-key bass + arpeggio, 2 moods ----
const SCALE = [0, 2, 3, 5, 7, 8, 10]; // natural minor
function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
const PROG = [0, 5, 3, 4]; // i - VI - iv - v (scale degrees)

function startMusic() {
  if (musicTimer) return;
  const stepDur = () => (musicMood === 'battle' ? 0.16 : 0.28);
  const tick = () => {
    if (ctx && settings.audio.music > 0 && !settings.audio.mute) {
      const bar = Math.floor(musicStep / 16) % PROG.length;
      const root = 45 + SCALE[PROG[bar]]; // A2 based
      const s = musicStep % 16;
      if (s % 8 === 0) tone(midi(root - 12), stepDur() * 7, 'triangle', 0.18, null, 0, musicBus);
      if (musicMood === 'battle' && s % 4 === 2) noise(0.05, 0.05, 6000, 'highpass');
      const arp = [0, 2, 4, 7, 4, 2, 0, 4];
      const deg = (PROG[bar] + arp[s % 8]) % 7;
      const oct = Math.floor((PROG[bar] + arp[s % 8]) / 7) * 12;
      if (s % 2 === 0 || musicMood === 'battle') tone(midi(57 + SCALE[deg] + oct), stepDur() * 0.9, 'square', 0.035, null, 0, musicBus);
    }
    musicStep++;
    musicTimer = setTimeout(tick, stepDur() * 1000);
  };
  tick();
}

export function setMusicMood(m) { musicMood = m; }
