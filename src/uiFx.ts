/* ==========================================================
   uiFx.ts - BROWSER EFFECTS: CONFETTI, WEBAUDIO SOUNDS, TIMING
   Pure presentation. Holds NO game state; never imports game rules.
   Depends on: the page's #confetti-canvas element.
   (Ported verbatim from the original single-file build, typed only.)
========================================================== */
/* ==========================================================
   CONFETTI CELEBRATION ENGINE
========================================================== */
const confettiCanvas = document.getElementById('confetti-canvas') as HTMLCanvasElement;
const confettiCtx = confettiCanvas.getContext('2d') as CanvasRenderingContext2D;
interface ConfettiParticle { x: number; y: number; vx: number; vy: number; size: number; color: string; rot: number; vRot: number; life: number; }
let confettiParticles: ConfettiParticle[] = [];
let confettiAnimId: number | null = null;

function resizeConfetti(): void {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeConfetti);
resizeConfetti();

function launchConfetti(): void {
  const colors = ['#ffbe0b', '#009dff', '#ff4b4b', '#2ec4b6', '#9d4edd', '#ffffff'];
  // Doubled from 95 to 190 particles; distributed evenly across the playfield width and height
  for (let i = 0; i < 190; i++) {
    confettiParticles.push({
      x: Math.random() * confettiCanvas.width,
      y: Math.random() * (confettiCanvas.height * 0.6),
      vx: (Math.random() - 0.5) * 3.5,
      vy: -(Math.random() * 3 + 1),
      size: Math.random() * 7 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.06,
      life: 1.0
    });
  }
  if (!confettiAnimId) {
    const raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (cb: FrameRequestCallback) => setTimeout(cb, 16));
    confettiAnimId = raf(animateConfetti);
  }
}

function stopConfetti(): void {
  confettiParticles = [];
  if (confettiAnimId) {
    const caf = typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame : (typeof window !== 'undefined' && window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : clearTimeout);
    caf(confettiAnimId);
    confettiAnimId = null;
  }
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

function animateConfetti(): void {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    const p = confettiParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.085; // Slowed down gravity by another 50% (was 0.17)
    p.vx *= 0.99;
    p.rot += p.vRot;
    p.life -= 0.0019; // Slowed down decay by another 50% (was 0.0038) for lingering slow-motion flutter

    if (p.y > confettiCanvas.height + 20 || p.life <= 0) {
      confettiParticles.splice(i, 1);
      continue;
    }

    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rot);
    confettiCtx.globalAlpha = Math.max(0, p.life);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
    confettiCtx.restore();
  }

  if (confettiParticles.length > 0) {
    const raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (cb: FrameRequestCallback) => setTimeout(cb, 16));
    confettiAnimId = raf(animateConfetti);
  } else {
    confettiAnimId = null;
  }
}

/* ==========================================================
   SYNTHESIZED WEBAUDIO SOUND ENGINE
========================================================== */
let audioCtx: AudioContext | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;
let sfxMasterGain: GainNode | null = null;
let sfxMuted: boolean = false;
let sfxVolume: number = 0.8;
let musicVolume: number = 0.8;

try {
  if (typeof localStorage !== 'undefined') {
    const savedSfxMuted = localStorage.getItem('jacklatro_sfx_muted');
    if (savedSfxMuted !== null) sfxMuted = savedSfxMuted === 'true';
    const savedSfxVol = localStorage.getItem('jacklatro_sfx_volume');
    if (savedSfxVol !== null) {
      const v = parseFloat(savedSfxVol);
      if (!isNaN(v) && v >= 0 && v <= 1) sfxVolume = v;
    }
    const savedMusicVol = localStorage.getItem('jacklatro_music_volume');
    if (savedMusicVol !== null) {
      const v = parseFloat(savedMusicVol);
      if (!isNaN(v) && v >= 0 && v <= 1) musicVolume = v;
    }
  }
} catch (e) {}

function getAudioCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctor: typeof AudioContext = (typeof window !== 'undefined' && ((window as any).AudioContext || (window as any).webkitAudioContext));
      if (!Ctor) return null;
      try {
        audioCtx = new Ctor({ latencyHint: 'balanced' });
      } catch (e) {
        audioCtx = new Ctor();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

function getMasterOutput(ctx: AudioContext): AudioNode {
  if (!masterCompressor) {
    masterCompressor = ctx.createDynamicsCompressor();
    masterCompressor.threshold.setValueAtTime(-14, ctx.currentTime);
    masterCompressor.knee.setValueAtTime(16, ctx.currentTime);
    masterCompressor.ratio.setValueAtTime(5, ctx.currentTime);
    masterCompressor.attack.setValueAtTime(0.003, ctx.currentTime);
    masterCompressor.release.setValueAtTime(0.12, ctx.currentTime);
    masterCompressor.connect(ctx.destination);
  }
  return masterCompressor;
}

function getSfxOutput(ctx: AudioContext): AudioNode {
  if (!sfxMasterGain) {
    sfxMasterGain = ctx.createGain();
    const effective = sfxMuted ? 0.0001 : sfxVolume;
    sfxMasterGain.gain.setValueAtTime(effective, ctx.currentTime);
    sfxMasterGain.connect(getMasterOutput(ctx));
  }
  return sfxMasterGain;
}

function updateSfxGain(): void {
  if (sfxMasterGain && audioCtx) {
    const now = audioCtx.currentTime;
    const target = sfxMuted ? 0.0001 : sfxVolume;
    sfxMasterGain.gain.cancelScheduledValues(now);
    sfxMasterGain.gain.setValueAtTime(sfxMasterGain.gain.value, now);
    sfxMasterGain.gain.linearRampToValueAtTime(target, now + 0.04);
  }
}

function setSfxVolume(vol: number): void {
  sfxVolume = Math.max(0, Math.min(1, vol));
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('jacklatro_sfx_volume', String(sfxVolume));
    }
  } catch (e) {}
  updateSfxGain();
  updateSfxUI();
}

function toggleSfx(): void {
  sfxMuted = !sfxMuted;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('jacklatro_sfx_muted', sfxMuted ? 'true' : 'false');
    }
  } catch (e) {}
  updateSfxGain();
  updateSfxUI();
  if (!sfxMuted && sfxVolume > 0.001) {
    playChipSound();
  }
}

function setMusicVolume(vol: number): void {
  musicVolume = Math.max(0, Math.min(1, vol));
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('jacklatro_music_volume', String(musicVolume));
    }
  } catch (e) {}
  if (musicMasterGain && audioCtx) {
    const now = audioCtx.currentTime;
    musicMasterGain.gain.cancelScheduledValues(now);
    musicMasterGain.gain.setValueAtTime(musicMasterGain.gain.value, now);
    musicMasterGain.gain.linearRampToValueAtTime(getTargetMusicVolume(), now + 0.05);
  }
  updateMusicUI();
}

function getTargetMusicVolume(): number {
  if (musicMuted) return 0.0001;
  return MUSIC_MASTER_VOLUME * musicVolume;
}

function playCardDealSound(): void {
  try {
    if (sfxMuted || sfxVolume <= 0.001) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.045);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1450, now);
    filter.Q.setValueAtTime(1.8, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(getSfxOutput(ctx));
    noise.onended = () => {
      try { noise.disconnect(); filter.disconnect(); gain.disconnect(); } catch (_) {}
    };
    noise.start(now);
    noise.stop(now + 0.048);
  } catch (e) {}
}

function playTone(freq: number, type: OscillatorType, startTime: number, duration: number, peakGain: number = 0.14): void {
  if (sfxMuted || sfxVolume <= 0.001) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t = Math.max(ctx.currentTime, startTime);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peakGain, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(getSfxOutput(ctx));
  osc.onended = () => {
    try { osc.disconnect(); gain.disconnect(); } catch (_) {}
  };
  osc.start(t);
  osc.stop(t + duration);
}

function playScoreTickSound(stepIndex: number): void {
  try {
    if (sfxMuted || sfxVolume <= 0.001) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const freq = 370 * Math.pow(1.075, Math.min(stepIndex, 14));
    playTone(freq, 'triangle', ctx.currentTime, 0.09, 0.14);
  } catch (e) {}
}

/** Synthesizes a soft felt card scrape/slide sound when Jokers or cards slide into focus. */
function playCardSlideSound(): void {
  try {
    if (sfxMuted || sfxVolume <= 0.001) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = 0.16;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(880, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + duration);
    filter.Q.setValueAtTime(2.2, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(getSfxOutput(ctx));
    noise.onended = () => {
      try { noise.disconnect(); filter.disconnect(); gain.disconnect(); } catch (_) {}
    };
    noise.start(now);
    noise.stop(now + duration + 0.01);
  } catch (e) {}
}

let activePackNoiseSource: AudioBufferSourceNode | null = null;
let activePackPopTimer: any = null;
let packPopPlayed: boolean = false;

function stopPackRipSound(): void {
  if (activePackNoiseSource) {
    try {
      activePackNoiseSource.stop();
      activePackNoiseSource.disconnect();
    } catch (_) {}
    activePackNoiseSource = null;
  }
  if (activePackPopTimer) {
    clearTimeout(activePackPopTimer);
    activePackPopTimer = null;
  }
}

/**
 * Plays the instant pop burst and bright sparkle chime.
 * Plays immediately upon card burst or when the user taps to skip the pack animation.
 */
function playPackOpenBurstSound(): void {
  if (packPopPlayed) return;
  packPopPlayed = true;
  stopPackRipSound();

  try {
    if (sfxMuted || sfxVolume <= 0.001) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Resonant energetic pop body: descending triangle pitch sweep immediately
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = 'triangle';
    popOsc.frequency.setValueAtTime(440, now);
    popOsc.frequency.exponentialRampToValueAtTime(130, now + 0.24);

    popGain.gain.setValueAtTime(0.001, now);
    popGain.gain.linearRampToValueAtTime(0.38, now + 0.03);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    popOsc.connect(popGain);
    popGain.connect(getSfxOutput(ctx));
    popOsc.start(now);
    popOsc.stop(now + 0.28);

    // Bright magical sparkle bells right as cards burst out
    playTone(1174.66, 'sine', now + 0.05, 0.28, 0.18); // D6
    playTone(1760.0, 'sine', now + 0.12, 0.35, 0.15);  // A6
  } catch (e) {}
}

/**
 * Synthesizes a booster pack foil rip anticipation sound.
 * 50% faster to match the 1.3s rumble shake.
 */
function playPackRipPopSound(): void {
  stopPackRipSound();
  packPopPlayed = false;

  try {
    if (sfxMuted || sfxVolume <= 0.001) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Foil tear/rip crinkle: filtered noise with resonant sweeping bandpass during 1.3s shake
    const ripDuration = 1.1;
    const bufferSize = Math.floor(ctx.sampleRate * ripDuration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const envelope = Math.sin((i / bufferSize) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    activePackNoiseSource = noise;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(650, now + ripDuration);
    filter.Q.setValueAtTime(3.0, now);

    const ripGain = ctx.createGain();
    ripGain.gain.setValueAtTime(0.30, now);
    ripGain.gain.exponentialRampToValueAtTime(0.001, now + ripDuration);

    noise.connect(filter);
    filter.connect(ripGain);
    ripGain.connect(getSfxOutput(ctx));
    noise.start(now);
    noise.stop(now + ripDuration);

    noise.onended = () => {
      if (activePackNoiseSource === noise) activePackNoiseSource = null;
    };

    // Schedule natural pop burst at 1.25s if not skipped earlier
    activePackPopTimer = setTimeout(() => {
      playPackOpenBurstSound();
    }, 1250);
  } catch (e) {}
}

/** Crisp ceramic ping when Blue Chips are scored and sink into the Chip counter. */
function playChipSound(): void {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    playTone(2100, 'sine', now, 0.045, 0.16);
    playTone(2850, 'triangle', now + 0.008, 0.04, 0.12);
  } catch (e) {}
}

/** Warm rising bright chime when additive Orange +Mult lands. */
function playMultPlusSound(stepIndex: number = 0): void {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freq = 440 * Math.pow(1.065, Math.min(stepIndex, 12));
    playTone(freq, 'triangle', now, 0.10, 0.15);
    playTone(freq * 1.5, 'sine', now + 0.02, 0.09, 0.09);
  } catch (e) {}
}

/** Dramatic punch: deep bass thud and heavy resonant gong when Red xMult slams down. */
function playMultXSound(): void {
  try {
    duckMusic(0.7);
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    playTone(130, 'sawtooth', now, 0.22, 0.22);
    playTone(520, 'triangle', now + 0.02, 0.28, 0.18);
    playTone(780, 'sine', now + 0.04, 0.35, 0.14);
  } catch (e) {}
}

/** Golden coin drop jingle when cash is awarded during scoring. */
function playMoneyCoinSound(): void {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    playTone(987.77, 'sine', now, 0.07, 0.16);
    playTone(1318.51, 'sine', now + 0.06, 0.14, 0.18);
  } catch (e) {}
}

function playOutcomeSound(kind: 'WIN' | 'BLIND_WIN' | 'PUSH' | 'LOSS' | 'BUST'): void {
  try {
    if (kind === 'WIN' || kind === 'BLIND_WIN') {
      duckMusic(1.1);
    }
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (kind === 'WIN') {
      // Crisp, uplifting ascending chime
      playTone(523.25, 'triangle', now, 0.12, 0.18); // C5
      playTone(659.25, 'triangle', now + 0.06, 0.12, 0.18); // E5
      playTone(783.99, 'triangle', now + 0.12, 0.16, 0.19); // G5
      playTone(1046.50, 'sine', now + 0.18, 0.28, 0.22); // C6
      playTone(2093.00, 'sine', now + 0.19, 0.15, 0.08); // sparkle harmonic
    } else if (kind === 'BLIND_WIN') {
      playTone(523.25, 'triangle', now, 0.12, 0.18);
      playTone(659.25, 'triangle', now + 0.09, 0.12, 0.18);
      playTone(783.99, 'triangle', now + 0.18, 0.12, 0.18);
      playTone(1046.50, 'triangle', now + 0.27, 0.16, 0.20);
      playTone(1318.51, 'sine', now + 0.38, 0.42, 0.20);
    } else if (kind === 'PUSH') {
      // Distinctly neutral 2-tone ping (even marimba notes, level pitch, neither happy nor sad)
      playTone(392.00, 'sine', now, 0.11, 0.15); // G4
      playTone(392.00, 'triangle', now, 0.11, 0.11);
      playTone(392.00, 'sine', now + 0.11, 0.16, 0.14); // G4 second tap
      playTone(392.00, 'triangle', now + 0.11, 0.16, 0.10);
    } else if (kind === 'LOSS') {
      // Muted descending defeat tone
      playTone(329.63, 'sawtooth', now, 0.14, 0.13); // E4
      playTone(261.63, 'sawtooth', now + 0.11, 0.24, 0.14); // C4
      playTone(130.81, 'triangle', now + 0.12, 0.24, 0.10); // low support
    } else if (kind === 'BUST') {
      // Deep descending bust buzz thud
      playTone(220.00, 'sawtooth', now, 0.14, 0.16); // A3
      playTone(164.81, 'sawtooth', now + 0.10, 0.16, 0.16); // E3
      playTone(110.00, 'sawtooth', now + 0.20, 0.30, 0.19); // A2
      playTone(55.00, 'sine', now + 0.20, 0.30, 0.22); // sub-bass thump
    }
  } catch (e) {}
}

function playNegativeFeedbackSound(): void {
  if (sfxMuted || sfxVolume <= 0.001) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // Low, buzzy descending rejection audio cue
    playTone(220.00, 'sawtooth', now, 0.12, 0.16); // A3
    playTone(164.81, 'sawtooth', now + 0.08, 0.16, 0.16); // E3
  } catch (e) {}
}

const sleep = (ms: number): Promise<void> => new Promise(res => setTimeout(res, ms));
const DEAL_DELAY_MS = 170;

/* ==========================================================
   SYNTHESIZED WEBAUDIO BACKGROUND MUSIC (LO-FI CHILL GROOVE)
========================================================== */
const NOTE_SEMITONES: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
  'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

function parseMusicNote(name: string): number {
  const m = name.match(/^([A-G][b#]?)(-?\d+)$/);
  if (!m) return 440;
  const semi = NOTE_SEMITONES[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (semi - 69) / 12);
}

let musicMasterGain: GainNode | null = null;
let musicFilterNode: BiquadFilterNode | null = null;
let isMusicPlaying: boolean = false;
let musicMuted: boolean = false;
try {
  musicMuted = typeof localStorage !== 'undefined' && localStorage.getItem('jacklatro_bgm_muted') === 'true';
} catch (e) {}

const MUSIC_MASTER_VOLUME = 0.22;
const BGM_TEMPO = 74; // Relaxed lo-fi lounge tempo
const SECONDS_PER_BEAT = 60 / BGM_TEMPO;
const SECONDS_PER_STEP = SECONDS_PER_BEAT / 4; // 16th note steps (0.2027s)
const TOTAL_MUSIC_STEPS = 128; // 8 bars @ 16 steps/bar = 25.95s loop

let musicSchedulerTimer: any = null;
let currentMusicStep = 0;
let nextMusicStepTime = 0;

let sharedNoiseBuffer: AudioBuffer | null = null;
function getSharedNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!sharedNoiseBuffer || sharedNoiseBuffer.sampleRate !== ctx.sampleRate) {
    const size = Math.floor(ctx.sampleRate * 0.8);
    sharedNoiseBuffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = sharedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return sharedNoiseBuffer;
}

function ensureMusicBus(ctx: AudioContext): GainNode {
  if (!musicMasterGain) {
    musicMasterGain = ctx.createGain();
    musicMasterGain.gain.setValueAtTime(0.0001, ctx.currentTime);

    musicFilterNode = ctx.createBiquadFilter();
    musicFilterNode.type = 'lowpass';
    musicFilterNode.frequency.setValueAtTime(3200, ctx.currentTime); // mellow tape rolloff
    musicFilterNode.Q.setValueAtTime(0.7, ctx.currentTime);

    musicMasterGain.connect(musicFilterNode);
    musicFilterNode.connect(getMasterOutput(ctx));
  }
  return musicMasterGain;
}

function playHat(ctx: AudioContext, time: number, isAccent: boolean): void {
  try {
    const noise = ctx.createBufferSource();
    noise.buffer = getSharedNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(6800, time);
    filter.Q.setValueAtTime(2.2, time);

    const gain = ctx.createGain();
    const peak = isAccent ? 0.038 : 0.018;
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.028);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(musicMasterGain!);
    noise.onended = () => {
      try { noise.disconnect(); filter.disconnect(); gain.disconnect(); } catch (_) {}
    };
    noise.start(time);
    noise.stop(time + 0.032);
  } catch (e) {}
}

function playSnare(ctx: AudioContext, time: number): void {
  try {
    const noise = ctx.createBufferSource();
    noise.buffer = getSharedNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1650, time);
    filter.Q.setValueAtTime(1.4, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.065, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.048);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(musicMasterGain!);
    noise.onended = () => {
      try { noise.disconnect(); filter.disconnect(); gain.disconnect(); } catch (_) {}
    };
    noise.start(time);
    noise.stop(time + 0.052);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(175, time);
    oscGain.gain.setValueAtTime(0.035, time);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    osc.connect(oscGain);
    oscGain.connect(musicMasterGain!);
    osc.onended = () => {
      try { osc.disconnect(); oscGain.disconnect(); } catch (_) {}
    };
    osc.start(time);
    osc.stop(time + 0.045);
  } catch (e) {}
}

function playKick(ctx: AudioContext, time: number): void {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(108, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.075);
    gain.gain.setValueAtTime(0.17, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
    osc.connect(gain);
    gain.connect(musicMasterGain!);
    osc.onended = () => {
      try { osc.disconnect(); gain.disconnect(); } catch (_) {}
    };
    osc.start(time);
    osc.stop(time + 0.085);
  } catch (e) {}
}

function playBass(ctx: AudioContext, time: number, noteName: string, duration: number): void {
  try {
    const freq = parseMusicNote(noteName);
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, time);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 0.5, time); // sub octave warmth

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.16, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.08, time + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(musicMasterGain!);

    osc1.onended = () => {
      try { osc1.disconnect(); osc2.disconnect(); filter.disconnect(); gain.disconnect(); } catch (_) {}
    };

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration);
    osc2.stop(time + duration);
  } catch (e) {}
}

function playRhodesChord(ctx: AudioContext, time: number, noteNames: string[], duration: number, gainLevel: number): void {
  try {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1150, time);
    filter.Q.setValueAtTime(0.75, time);

    const voiceGain = gainLevel / noteNames.length;

    for (const n of noteNames) {
      const freq = parseMusicNote(n);
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, time);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq, time);
      osc2.detune.setValueAtTime(3.5, time); // subtle warm chorus tine

      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(voiceGain, time + 0.015);
      g.gain.exponentialRampToValueAtTime(voiceGain * 0.45, time + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc1.connect(g);
      osc2.connect(g);
      g.connect(filter);

      osc1.onended = () => {
        try { osc1.disconnect(); osc2.disconnect(); g.disconnect(); } catch (_) {}
      };

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration);
      osc2.stop(time + duration);
    }

    filter.connect(musicMasterGain!);
    setTimeout(() => {
      try { filter.disconnect(); } catch (_) {}
    }, Math.round((duration + 0.08) * 1000));
  } catch (e) {}
}

function playRhodesLead(ctx: AudioContext, time: number, noteName: string, duration: number): void {
  try {
    const freq = parseMusicNote(noteName);
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1900, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.075, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(musicMasterGain!);

    osc.onended = () => {
      try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch (_) {}
    };

    osc.start(time);
    osc.stop(time + duration);
  } catch (e) {}
}

// Melodic lead flourishes for Section B (Bars 4-7, steps 64-127)
const LEAD_MOTIF_STEPS: Record<number, string> = {
  68: 'G4', 72: 'Bb4', 76: 'D5', 80: 'C5',
  84: 'Eb5', 88: 'D5', 92: 'C5',
  100: 'Ab4', 104: 'C5', 108: 'G5', 112: 'F5',
  116: 'Eb5', 120: 'D5', 124: 'B4'
};

function scheduleMusicStep(step: number, time: number): void {
  if (!audioCtx || !musicMasterGain) return;

  const bar = Math.floor(step / 16);
  const localStep = step % 16;

  // 1. Drums
  // Kick: beats 1 & 3 (steps 0, 8) + syncopated kick on step 14 on even bars
  if (localStep === 0 || localStep === 8 || (localStep === 14 && bar % 2 === 0)) {
    playKick(audioCtx, time);
  }
  // Brushed Snare: beats 2 & 4 (steps 4, 12)
  if (localStep === 4 || localStep === 12) {
    playSnare(audioCtx, time);
  }
  // Hi-Hat: 8th notes (every 2 steps) with swing accent on offbeats (2, 6, 10, 14)
  if (localStep % 2 === 0) {
    playHat(audioCtx, time, localStep % 4 === 2);
  }

  // 2. Chords & Bass
  const chordBar = bar % 4;
  if (chordBar === 0) {
    // Cm9
    if (localStep === 0) playRhodesChord(audioCtx, time, ['Eb3', 'G3', 'Bb3', 'D4'], 0.70, 0.16);
    if (localStep === 6) playRhodesChord(audioCtx, time, ['Eb3', 'G3', 'Bb3', 'D4'], 0.35, 0.12);
    if (localStep === 10) playRhodesChord(audioCtx, time, ['Eb3', 'G3', 'Bb3', 'D4'], 0.45, 0.13);

    if (localStep === 0) playBass(audioCtx, time, 'C2', 0.50);
    if (localStep === 6) playBass(audioCtx, time, bar >= 4 ? 'Eb2' : 'C2', 0.30);
    if (localStep === 8) playBass(audioCtx, time, 'G2', 0.40);
    if (localStep === 14) playBass(audioCtx, time, 'Bb2', 0.35);
  } else if (chordBar === 1) {
    // Abmaj9
    if (localStep === 0) playRhodesChord(audioCtx, time, ['C3', 'Eb3', 'G3', 'C4'], 0.65, 0.16);
    if (localStep === 6) playRhodesChord(audioCtx, time, ['C3', 'Eb3', 'G3', 'C4'], 0.35, 0.12);
    if (localStep === 12) playRhodesChord(audioCtx, time, ['C3', 'Eb3', 'G3', 'C4'], 0.45, 0.13);

    if (localStep === 0) playBass(audioCtx, time, 'Ab1', 0.50);
    if (localStep === 6) playBass(audioCtx, time, bar >= 4 ? 'C2' : 'Eb2', 0.30);
    if (localStep === 8) playBass(audioCtx, time, bar >= 4 ? 'Eb2' : 'Ab2', 0.40);
    if (localStep === 14) playBass(audioCtx, time, 'G2', 0.35);
  } else if (chordBar === 2) {
    // Fm9
    if (localStep === 0) playRhodesChord(audioCtx, time, ['Eb3', 'Ab3', 'C4', 'G4'], 0.70, 0.16);
    if (localStep === 6) playRhodesChord(audioCtx, time, ['Eb3', 'Ab3', 'C4', 'G4'], 0.35, 0.12);
    if (localStep === 10) playRhodesChord(audioCtx, time, ['Eb3', 'Ab3', 'C4', 'G4'], 0.45, 0.13);

    if (localStep === 0) playBass(audioCtx, time, 'F1', 0.50);
    if (localStep === 6) playBass(audioCtx, time, bar >= 4 ? 'Ab1' : 'F1', 0.30);
    if (localStep === 8) playBass(audioCtx, time, 'C2', 0.40);
    if (localStep === 14) playBass(audioCtx, time, 'Eb2', 0.35);
  } else if (chordBar === 3) {
    // G7alt
    if (localStep === 0) playRhodesChord(audioCtx, time, ['F3', 'B3', 'Eb4', 'Ab4'], 0.65, 0.16);
    if (localStep === 6) playRhodesChord(audioCtx, time, ['F3', 'B3', 'Eb4', 'Ab4'], 0.35, 0.12);
    if (localStep === 10) playRhodesChord(audioCtx, time, ['F3', 'B3', 'Eb4', 'Ab4'], 0.40, 0.13);
    if (localStep === 14) playRhodesChord(audioCtx, time, ['F3', 'B3', 'D4', 'G4'], 0.35, 0.12);

    if (localStep === 0) playBass(audioCtx, time, 'G1', 0.50);
    if (localStep === 6) playBass(audioCtx, time, 'D2', 0.30);
    if (localStep === 8) playBass(audioCtx, time, 'F2', 0.40);
    if (localStep === 14) playBass(audioCtx, time, 'B1', 0.35); // Leading half-step back into C
  }

  // 3. Melodic touches in Section B
  if (LEAD_MOTIF_STEPS[step]) {
    playRhodesLead(audioCtx, time, LEAD_MOTIF_STEPS[step], 0.45);
  }
}

function musicScheduler(): void {
  if (!audioCtx || !isMusicPlaying) return;
  // If clock drifted behind current audio time due to background or CPU stall, resync immediately to prevent burst
  if (nextMusicStepTime < audioCtx.currentTime) {
    const missedSteps = Math.ceil((audioCtx.currentTime - nextMusicStepTime) / SECONDS_PER_STEP);
    currentMusicStep = (currentMusicStep + missedSteps) % TOTAL_MUSIC_STEPS;
    nextMusicStepTime = audioCtx.currentTime + 0.03;
  }
  // Lookahead: schedule notes up to 280ms ahead of current audio time to eliminate underrun crackles
  while (nextMusicStepTime < audioCtx.currentTime + 0.28) {
    scheduleMusicStep(currentMusicStep, nextMusicStepTime);
    nextMusicStepTime += SECONDS_PER_STEP;
    currentMusicStep = (currentMusicStep + 1) % TOTAL_MUSIC_STEPS;
  }
}

function startMusic(): void {
  try {
    const ctx = getAudioCtx();
    if (!ctx || musicMuted || isMusicPlaying) return;

    ensureMusicBus(ctx);
    isMusicPlaying = true;
    currentMusicStep = 0;
    nextMusicStepTime = ctx.currentTime + 0.05;

    const now = ctx.currentTime;
    musicMasterGain!.gain.cancelScheduledValues(now);
    musicMasterGain!.gain.setValueAtTime(0.0001, now);
    musicMasterGain!.gain.linearRampToValueAtTime(getTargetMusicVolume(), now + 0.35);

    if (musicSchedulerTimer) clearInterval(musicSchedulerTimer);
    musicSchedulerTimer = setInterval(musicScheduler, 25);
    updateMusicUI();
  } catch (e) {}
}

/* ==========================================================
   VICTORY / CELEBRATION MUSIC LOOP (UPBEAT FANFARE GROOVE)
========================================================== */
let isVictoryMusicPlaying: boolean = false;
let victorySchedulerTimer: any = null;
let currentVictoryStep = 0;
let nextVictoryStepTime = 0;
const VICTORY_BPM = 118;
const VICTORY_SECONDS_PER_BEAT = 60 / VICTORY_BPM;
const VICTORY_SECONDS_PER_STEP = VICTORY_SECONDS_PER_BEAT / 4; // 16th note steps (0.127s)
const TOTAL_VICTORY_STEPS = 64; // 4 bars @ 16 steps/bar = 8.13s loop

function playVictoryLead(ctx: AudioContext, time: number, noteName: string, duration: number): void {
  try {
    const freq = parseMusicNote(noteName);
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 1.004, time); // detuned shimmer

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3400, time);
    filter.frequency.exponentialRampToValueAtTime(1600, time + duration);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.13, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(musicMasterGain!);

    osc1.onended = () => {
      try { osc1.disconnect(); osc2.disconnect(); filter.disconnect(); gain.disconnect(); } catch (_) {}
    };

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration);
    osc2.stop(time + duration);
  } catch (e) {}
}

function playVictoryBrassChord(ctx: AudioContext, time: number, noteNames: string[], duration: number): void {
  try {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, time);
    filter.Q.setValueAtTime(1.1, time);

    const voiceGain = 0.16 / noteNames.length;
    for (const n of noteNames) {
      const freq = parseMusicNote(n);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(voiceGain, time + 0.012);
      g.gain.exponentialRampToValueAtTime(voiceGain * 0.45, time + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(g);
      g.connect(filter);

      osc.onended = () => {
        try { osc.disconnect(); g.disconnect(); } catch (_) {}
      };

      osc.start(time);
      osc.stop(time + duration);
    }
    filter.connect(musicMasterGain!);
    setTimeout(() => {
      try { filter.disconnect(); } catch (_) {}
    }, Math.round((duration + 0.08) * 1000));
  } catch (e) {}
}

function scheduleVictoryStep(step: number, time: number): void {
  if (!audioCtx || !musicMasterGain) return;

  const bar = Math.floor(step / 16);
  const localStep = step % 16;

  // 1. Upbeat celebration drums: 4-on-the-floor kick, snappy snare on 2 & 4, bouncy hi-hats
  if (localStep % 4 === 0) {
    playKick(audioCtx, time);
  }
  if (localStep === 4 || localStep === 12) {
    playSnare(audioCtx, time);
  }
  if (localStep % 2 === 0) {
    playHat(audioCtx, time, localStep % 4 === 2);
  }

  // 2. Chords & Bassline
  if (bar === 0) {
    // C Major: triumphant root
    if (localStep === 0 || localStep === 6 || localStep === 10) {
      playVictoryBrassChord(audioCtx, time, ['G3', 'C4', 'E4', 'G4'], 0.32);
    }
    if (localStep === 0 || localStep === 4 || localStep === 8 || localStep === 12) {
      playBass(audioCtx, time, 'C2', 0.22);
    }
  } else if (bar === 1) {
    // F Major: bright subdominant lift
    if (localStep === 0 || localStep === 6 || localStep === 10) {
      playVictoryBrassChord(audioCtx, time, ['A3', 'C4', 'F4', 'A4'], 0.32);
    }
    if (localStep === 0 || localStep === 4 || localStep === 8 || localStep === 12) {
      playBass(audioCtx, time, 'F2', 0.22);
    }
  } else if (bar === 2) {
    // G Major: dominant driving anticipation
    if (localStep === 0 || localStep === 6 || localStep === 10) {
      playVictoryBrassChord(audioCtx, time, ['B3', 'D4', 'G4', 'B4'], 0.32);
    }
    if (localStep === 0 || localStep === 4 || localStep === 8 || localStep === 12) {
      playBass(audioCtx, time, 'G2', 0.22);
    }
  } else if (bar === 3) {
    // Am -> G turnaround
    if (localStep === 0 || localStep === 6) {
      playVictoryBrassChord(audioCtx, time, ['A3', 'C4', 'E4', 'A4'], 0.30);
    } else if (localStep === 10 || localStep === 14) {
      playVictoryBrassChord(audioCtx, time, ['G3', 'B3', 'D4', 'G4'], 0.28);
    }
    if (localStep === 0 || localStep === 4) {
      playBass(audioCtx, time, 'A2', 0.22);
    } else if (localStep === 8 || localStep === 12) {
      playBass(audioCtx, time, 'G2', 0.22);
    }
  }

  // 3. Triumphant Fanfare Lead Melody
  const VICTORY_MELODY: Record<number, string> = {
    0: 'C5', 4: 'E5', 8: 'G5', 12: 'C6',
    16: 'A5', 20: 'C6', 24: 'G5', 28: 'F5',
    32: 'G5', 36: 'B5', 40: 'D6', 44: 'G5',
    48: 'E6', 52: 'D6', 56: 'C6', 60: 'G5'
  };

  if (VICTORY_MELODY[step]) {
    playVictoryLead(audioCtx, time, VICTORY_MELODY[step], 0.26);
  }
}

function victoryMusicScheduler(): void {
  if (!audioCtx || !isVictoryMusicPlaying) return;
  if (nextVictoryStepTime < audioCtx.currentTime) {
    const missedSteps = Math.ceil((audioCtx.currentTime - nextVictoryStepTime) / VICTORY_SECONDS_PER_STEP);
    currentVictoryStep = (currentVictoryStep + missedSteps) % TOTAL_VICTORY_STEPS;
    nextVictoryStepTime = audioCtx.currentTime + 0.03;
  }
  while (nextVictoryStepTime < audioCtx.currentTime + 0.28) {
    scheduleVictoryStep(currentVictoryStep, nextVictoryStepTime);
    nextVictoryStepTime += VICTORY_SECONDS_PER_STEP;
    currentVictoryStep = (currentVictoryStep + 1) % TOTAL_VICTORY_STEPS;
  }
}

function startVictoryMusic(): void {
  try {
    const ctx = getAudioCtx();
    if (!ctx || musicMuted) return;

    // Stop normal BGM first
    stopMusic(true);

    ensureMusicBus(ctx);
    isVictoryMusicPlaying = true;
    currentVictoryStep = 0;
    nextVictoryStepTime = ctx.currentTime + 0.05;

    const now = ctx.currentTime;
    musicMasterGain!.gain.cancelScheduledValues(now);
    musicMasterGain!.gain.setValueAtTime(0.0001, now);
    musicMasterGain!.gain.linearRampToValueAtTime(getTargetMusicVolume() * 1.15, now + 0.25);

    if (victorySchedulerTimer) clearInterval(victorySchedulerTimer);
    victorySchedulerTimer = setInterval(victoryMusicScheduler, 25);
    updateMusicUI();
  } catch (e) {}
}

function stopVictoryMusic(): void {
  try {
    if (!isVictoryMusicPlaying) return;
    isVictoryMusicPlaying = false;
    if (victorySchedulerTimer) {
      clearInterval(victorySchedulerTimer);
      victorySchedulerTimer = null;
    }
    if (musicMasterGain && audioCtx) {
      const now = audioCtx.currentTime;
      musicMasterGain.gain.cancelScheduledValues(now);
      musicMasterGain.gain.linearRampToValueAtTime(0.0001, now + 0.2);
    }
    updateMusicUI();
  } catch (e) {}
}

function stopMusic(immediate: boolean = false): void {
  try {
    if (!isMusicPlaying) return;
    isMusicPlaying = false;
    if (musicSchedulerTimer) {
      clearInterval(musicSchedulerTimer);
      musicSchedulerTimer = null;
    }
    if (musicMasterGain && audioCtx) {
      const now = audioCtx.currentTime;
      if (immediate) {
        musicMasterGain.gain.setValueAtTime(0.0001, now);
      } else {
        musicMasterGain.gain.cancelScheduledValues(now);
        musicMasterGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);
      }
    }
    updateMusicUI();
  } catch (e) {}
}

function toggleMusic(): void {
  musicMuted = !musicMuted;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('jacklatro_bgm_muted', musicMuted ? 'true' : 'false');
    }
  } catch (e) {}

  if (musicMuted) {
    stopMusic();
    stopVictoryMusic();
  } else {
    const ctx = getAudioCtx();
    const resumeFn = () => {
      const vicModal = document.getElementById('ui-victory-modal');
      const isVicActive = vicModal && !vicModal.classList.contains('hidden');
      if (isVicActive) {
        startVictoryMusic();
      } else {
        startMusic();
      }
    };
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(resumeFn).catch(resumeFn);
    } else {
      resumeFn();
    }
  }
  updateMusicUI();
}

function duckMusic(durationSec: number = 0.8): void {
  try {
    const active = isMusicPlaying || isVictoryMusicPlaying;
    if (!active || !musicMasterGain || !audioCtx) return;
    const now = audioCtx.currentTime;
    const target = getTargetMusicVolume();
    musicMasterGain.gain.cancelScheduledValues(now);
    musicMasterGain.gain.setValueAtTime(musicMasterGain.gain.value, now);
    musicMasterGain.gain.linearRampToValueAtTime(target * 0.28, now + 0.04);
    musicMasterGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), now + durationSec);
  } catch (e) {}
}

function updateMusicUI(): void {
  try {
    const isEnabled = !musicMuted;
    const btnHeader = document.getElementById('btn-music-toggle');
    if (btnHeader) {
      if (!isEnabled) {
        btnHeader.textContent = '🔇';
        btnHeader.title = 'Music: OFF (Tap to play)';
        btnHeader.classList.add('muted');
        btnHeader.classList.remove('playing');
      } else {
        btnHeader.textContent = '🎵';
        btnHeader.title = 'Music: ON (Tap to mute)';
        btnHeader.classList.remove('muted');
        btnHeader.classList.add('playing');
      }
    }
    const btnModal = document.getElementById('btn-modal-music-toggle');
    if (btnModal) {
      btnModal.textContent = !isEnabled ? 'MUSIC: OFF' : 'MUSIC: ON';
      if (!isEnabled) {
        btnModal.classList.remove('btn-deal');
        btnModal.classList.add('btn-secondary');
      } else {
        btnModal.classList.add('btn-deal');
        btnModal.classList.remove('btn-secondary');
      }
    }
    const btnSplash = document.getElementById('btn-splash-music');
    if (btnSplash) {
      btnSplash.innerHTML = isEnabled
        ? '<span id="splash-music-icon">🎵</span> MUSIC: ON'
        : '<span id="splash-music-icon">🔇</span> MUSIC: OFF';
      if (isEnabled) {
        btnSplash.classList.remove('muted');
      } else {
        btnSplash.classList.add('muted');
      }
    }
    const slider = document.getElementById('setting-music-volume') as HTMLInputElement | null;
    if (slider) slider.value = String(Math.round(musicVolume * 100));
    const lbl = document.getElementById('ui-lbl-music-volume');
    if (lbl) lbl.textContent = `${Math.round(musicVolume * 100)}%`;
  } catch (e) {}
}

function updateSfxUI(): void {
  try {
    const isEnabled = !sfxMuted && sfxVolume > 0.001;
    const btnModal = document.getElementById('btn-modal-sfx-toggle');
    if (btnModal) {
      btnModal.textContent = isEnabled ? 'SFX: ON' : 'SFX: OFF';
      if (!isEnabled) {
        btnModal.classList.remove('btn-deal');
        btnModal.classList.add('btn-secondary');
      } else {
        btnModal.classList.add('btn-deal');
        btnModal.classList.remove('btn-secondary');
      }
    }
    const icon = document.getElementById('ui-icon-sfx');
    if (icon) icon.textContent = isEnabled ? '🔊' : '🔇';
    const slider = document.getElementById('setting-sfx-volume') as HTMLInputElement | null;
    if (slider) slider.value = String(Math.round(sfxVolume * 100));
    const lbl = document.getElementById('ui-lbl-sfx-volume');
    if (lbl) lbl.textContent = `${Math.round(sfxVolume * 100)}%`;
  } catch (e) {}
}

/* ==========================================================
   APP LIFECYCLE & BACKGROUND PAUSE / RESUME ENGINE
   Suspends audio and timers when hidden/backgrounded to prevent
   stutter, memory leaks, and battery drain. Resumes seamlessly.
========================================================== */
let wasMusicPlayingBeforePause = false;
let wasVictoryMusicPlayingBeforePause = false;

function handleVisibilityOrPause(isBackground: boolean): void {
  try {
    if (isBackground) {
      // App or tab is hidden/backgrounded
      wasMusicPlayingBeforePause = isMusicPlaying;
      wasVictoryMusicPlayingBeforePause = isVictoryMusicPlaying;

      if (musicSchedulerTimer) {
        clearInterval(musicSchedulerTimer);
        musicSchedulerTimer = null;
      }
      if (victorySchedulerTimer) {
        clearInterval(victorySchedulerTimer);
        victorySchedulerTimer = null;
      }
      isMusicPlaying = false;
      isVictoryMusicPlaying = false;

      // Suspend audio context to release audio hardware and zero CPU
      if (audioCtx && audioCtx.state === 'running') {
        audioCtx.suspend().catch(() => {});
      }

      // Stop confetti animation loop to save battery
      if (confettiAnimId) {
        const caf = typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame : (typeof window !== 'undefined' && window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : clearTimeout);
        caf(confettiAnimId);
        confettiAnimId = null;
      }
    } else {
      // App or tab returned to foreground
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      if (!musicMuted) {
        if (wasVictoryMusicPlayingBeforePause) {
          startVictoryMusic();
        } else if (wasMusicPlayingBeforePause) {
          startMusic();
        }
      }

      // Resume confetti if particles still linger
      if (confettiParticles.length > 0 && !confettiAnimId) {
        const raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (typeof window !== 'undefined' && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (cb: FrameRequestCallback) => setTimeout(cb, 16));
        confettiAnimId = raf(animateConfetti);
      }
    }
  } catch (e) {}
}

function tryAutostartMusic(): void {
  if (musicMuted) return;
  const ctx = getAudioCtx();
  if (ctx) {
    if (ctx.state === 'running') {
      startMusic();
    } else {
      ctx.resume().then(() => {
        if (!musicMuted && !isMusicPlaying) startMusic();
      }).catch(() => {
        // Autoplay policy prevented immediate start; will start on first user gesture
      });
    }
  }
}

function initMusicOnFirstGesture(): void {
  if (typeof window === 'undefined') return;
  const onGesture = () => {
    if (!musicMuted && !isMusicPlaying && !isVictoryMusicPlaying) {
      startMusic();
    } else {
      getAudioCtx();
    }
  };
  window.addEventListener('pointerdown', onGesture, { once: true });
  window.addEventListener('touchstart', onGesture, { once: true, passive: true });
  window.addEventListener('keydown', onGesture, { once: true });
  window.addEventListener('click', onGesture, { once: true });
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    handleVisibilityOrPause(document.hidden);
  });
  // Cordova / Capacitor lifecycle events
  document.addEventListener('pause', () => handleVisibilityOrPause(true));
  document.addEventListener('resume', () => handleVisibilityOrPause(false));
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => handleVisibilityOrPause(true));
  window.addEventListener('pageshow', () => handleVisibilityOrPause(false));
  window.addEventListener('freeze', () => handleVisibilityOrPause(true));

  // Capacitor Native App plugin if available
  try {
    const capApp = (window as any).Capacitor?.Plugins?.App;
    if (capApp && typeof capApp.addListener === 'function') {
      capApp.addListener('appStateChange', (state: { isActive: boolean }) => {
        handleVisibilityOrPause(!state.isActive);
      });
    }
  } catch (_) {}

  // Full cleanup on unload/destroy
  window.addEventListener('beforeunload', () => {
    try {
      if (musicSchedulerTimer) clearInterval(musicSchedulerTimer);
      if (victorySchedulerTimer) clearInterval(victorySchedulerTimer);
      if (audioCtx) audioCtx.close().catch(() => {});
    } catch (_) {}
  });

  initMusicOnFirstGesture();
  tryAutostartMusic();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateMusicUI();
      updateSfxUI();
      tryAutostartMusic();
    });
  } else {
    updateMusicUI();
    updateSfxUI();
    tryAutostartMusic();
  }
}

if (typeof window !== 'undefined') {
  (window as any).playNegativeFeedbackSound = playNegativeFeedbackSound;
  (window as any).playPackRipPopSound = playPackRipPopSound;
  (window as any).playPackOpenBurstSound = playPackOpenBurstSound;
  (window as any).stopPackRipSound = stopPackRipSound;
  (window as any).toggleMusic = toggleMusic;
  (window as any).toggleSfx = toggleSfx;
  (window as any).setMusicVolume = setMusicVolume;
  (window as any).setSfxVolume = setSfxVolume;
  (window as any).updateMusicUI = updateMusicUI;
  (window as any).updateSfxUI = updateSfxUI;
}



