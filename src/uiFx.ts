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

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    const Ctor: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playCardDealSound(): void {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.045;
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
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.045);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  } catch (e) {}
}

function playTone(freq: number, type: OscillatorType, startTime: number, duration: number, peakGain: number = 0.14): void {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playScoreTickSound(stepIndex: number): void {
  try {
    const ctx = getAudioCtx();
    const freq = 370 * Math.pow(1.075, Math.min(stepIndex, 14));
    playTone(freq, 'triangle', ctx.currentTime, 0.09, 0.14);
  } catch (e) {}
}

/** Synthesizes a soft felt card scrape/slide sound when Jokers or cards slide into focus. */
function playCardSlideSound(): void {
  try {
    const ctx = getAudioCtx();
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
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  } catch (e) {}
}

/** Crisp ceramic ping when Blue Chips are scored and sink into the Chip counter. */
function playChipSound(): void {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    playTone(2100, 'sine', now, 0.045, 0.16);
    playTone(2850, 'triangle', now + 0.008, 0.04, 0.12);
  } catch (e) {}
}

/** Warm rising bright chime when additive Orange +Mult lands. */
function playMultPlusSound(stepIndex: number = 0): void {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const freq = 440 * Math.pow(1.065, Math.min(stepIndex, 12));
    playTone(freq, 'triangle', now, 0.10, 0.15);
    playTone(freq * 1.5, 'sine', now + 0.02, 0.09, 0.09);
  } catch (e) {}
}

/** Dramatic punch: deep bass thud and heavy resonant gong when Red xMult slams down. */
function playMultXSound(): void {
  try {
    const ctx = getAudioCtx();
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
    const now = ctx.currentTime;
    playTone(987.77, 'sine', now, 0.07, 0.16);
    playTone(1318.51, 'sine', now + 0.06, 0.14, 0.18);
  } catch (e) {}
}

function playOutcomeSound(kind: 'WIN' | 'BLIND_WIN' | 'PUSH' | 'LOSS' | 'BUST'): void {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    if (kind === 'WIN') {
      playTone(523.25, 'triangle', now, 0.14, 0.16);
      playTone(659.25, 'triangle', now + 0.08, 0.14, 0.16);
      playTone(783.99, 'triangle', now + 0.16, 0.22, 0.18);
      playTone(1046.50, 'sine', now + 0.24, 0.30, 0.15);
    } else if (kind === 'BLIND_WIN') {
      playTone(523.25, 'triangle', now, 0.12, 0.18);
      playTone(659.25, 'triangle', now + 0.09, 0.12, 0.18);
      playTone(783.99, 'triangle', now + 0.18, 0.12, 0.18);
      playTone(1046.50, 'triangle', now + 0.27, 0.16, 0.20);
      playTone(1318.51, 'sine', now + 0.38, 0.42, 0.20);
    } else if (kind === 'PUSH') {
      playTone(440.0, 'sine', now, 0.14, 0.13);
      playTone(440.0, 'triangle', now + 0.14, 0.20, 0.13);
    } else if (kind === 'LOSS') {
      playTone(349.23, 'sawtooth', now, 0.18, 0.10);
      playTone(277.18, 'sawtooth', now + 0.16, 0.30, 0.11);
    } else if (kind === 'BUST') {
      playTone(220.0, 'sawtooth', now, 0.16, 0.13);
      playTone(164.81, 'sawtooth', now + 0.13, 0.18, 0.13);
      playTone(123.47, 'sawtooth', now + 0.26, 0.34, 0.14);
    }
  } catch (e) {}
}

const sleep = (ms: number): Promise<void> => new Promise(res => setTimeout(res, ms));
const DEAL_DELAY_MS = 170;

