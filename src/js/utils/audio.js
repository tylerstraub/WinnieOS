/**
 * WinnieOS Toy Audio (Web Audio)
 *
 * Goals:
 * - Simple, playful, retro-esque tones (no music).
 * - Gentle by default (short envelopes, rate limiting, clamped dynamics).
 * - Safe teardown (no long-lived per-sound nodes; reuses a single AudioContext).
 *
 * This is intentionally minimal and should become the shared audio foundation for games.
 */

let ctx = null;
let master = null;
let levelGain = null;      // the single "mix knob" stage (global level)
let compressor = null;
let clipper = null;        // safety soft-clip (should almost never engage)
let unlocked = false;

// Continuous "color drag" voice state (for the Colors app)
let colorDrag = null;

// Master level knob (0..1), mapped to dB for perceptual control.
// Keep dynamics in the per-sound design; this is just global trim.
let masterLevel = 1.0; // EXTREME boost by default (user-requested); tune down once calibrated
const MASTER_MIN_DB = -24; // quiet but not fully mute
const MASTER_MAX_DB = +18; // very loud ceiling; limiter/clipper act as safety

// Rate limiting per sound type (seconds)
const lastPlay = new Map();
const MIN_INTERVAL = {
    tick: 0.06,
    plink: 0.03,
    pop: 0.08,
    buzz: 0.10,
    thud: 0.05,
    launch: 0.12,
    bounce: 0.02,
    reward: 0.20,
    poof: 0.18,
    ready: 0.30,
    binBounce: 0.03,
    scoreTick: 0.09,
    star: 0.35,
    // Typing can be rapid; keep it snappy but safely rate-limited.
    type: 0.028
};

function now() {
    return ctx ? ctx.currentTime : 0;
}

function clamp(n, lo, hi) {
    const x = Number(n);
    if (!Number.isFinite(x)) return lo;
    return Math.max(lo, Math.min(hi, x));
}

function clamp01(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
}

function dbToGain(db) {
    if (!Number.isFinite(db)) return 0;
    return Math.pow(10, db / 20);
}

function levelToDb(level01) {
    const x = clamp01(level01);
    // Linear-in-dB mapping (perceptual); slight easing so mid-range is more usable.
    const eased = Math.pow(x, 1.35);
    return MASTER_MIN_DB + (MASTER_MAX_DB - MASTER_MIN_DB) * eased;
}

function setLevelGain(db, { immediate = false } = {}) {
    const c = ensureContext();
    if (!c || !levelGain) return;
    const t = c.currentTime;
    const g = levelGain.gain;
    const gainValue = dbToGain(db);
    g.cancelScheduledValues(t);
    if (immediate) {
        g.setValueAtTime(gainValue, t);
    } else {
        // Smooth to avoid zipper noise when adjusting while sounds play.
        g.setTargetAtTime(gainValue, t, 0.03);
    }
}

function shouldPlay(kind) {
    const t = now();
    const min = MIN_INTERVAL[kind] || 0;
    const prev = lastPlay.get(kind) || -Infinity;
    if (t - prev < min) return false;
    lastPlay.set(kind, t);
    return true;
}

function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });

    // Graph:
    // sources -> master (mix bus) -> levelGain (single mix knob) -> limiter -> clipper -> destination
    master = ctx.createGain();
    master.gain.value = 1.0; // mix bus unity

    compressor = ctx.createDynamicsCompressor();
    // Configure as a "do-not-slam" limiter: only catches peaks.
    // WebAudio doesn't provide a true brickwall limiter, but high ratio + fast attack + hard knee
    // gets us close, and the clipper after it is a last-resort safety.
    compressor.threshold.value = -6;
    compressor.knee.value = 0;
    compressor.ratio.value = 20;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.10;

    levelGain = ctx.createGain();
    // Initialize level from masterLevel (mapped to dB)
    setLevelGain(levelToDb(masterLevel), { immediate: true });

    clipper = ctx.createWaveShaper();
    clipper.oversample = '4x';
    // Soft-clip curve: should rarely engage, but prevents digital overs if a spike slips through.
    // Keep it gentle (near-linear around 0).
    const curveLen = 2048;
    const curve = new Float32Array(curveLen);
    for (let i = 0; i < curveLen; i++) {
        const x = (i * 2) / (curveLen - 1) - 1;
        // tanh-like soft clip, slightly conservative
        curve[i] = Math.tanh(1.35 * x);
    }
    clipper.curve = curve;

    master.connect(levelGain);
    levelGain.connect(compressor);
    compressor.connect(clipper);
    clipper.connect(ctx.destination);
    return ctx;
}

async function unlock() {
    const c = ensureContext();
    if (!c) return false;
    if (unlocked) return true;

    try {
        if (c.state === 'suspended') {
            await c.resume();
        }
        // "Prime" with an inaudible tick so some browsers fully unlock output.
        const t = c.currentTime;
        const o = c.createOscillator();
        const g = c.createGain();
        g.gain.setValueAtTime(0.00001, t);
        o.frequency.setValueAtTime(440, t);
        o.connect(g);
        g.connect(master);
        o.start(t);
        o.stop(t + 0.01);
        unlocked = true;
        return true;
    } catch (_) {
        return false;
    }
}

function envGain(gainNode, t0, a, d, peak, floor) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(Math.max(0, floor), t0);
    g.linearRampToValueAtTime(Math.max(0, peak), t0 + a);
    g.exponentialRampToValueAtTime(Math.max(0.00001, floor), t0 + a + d);
}

function makeNoiseBuffer(durationSec) {
    const c = ensureContext();
    if (!c) return null;
    const sr = c.sampleRate;
    const len = Math.max(1, Math.floor(durationSec * sr));
    const buf = c.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1);
    }
    return buf;
}

function playNoiseBurst(t, durationSec, {
    gainPeak = 0.02,
    gainFloor = 0.00001,
    hpHz = 1800,
    bpHz = null,
    bpQ = 1.0
} = {}) {
    const c = ensureContext();
    if (!c || !master) return;

    const buf = makeNoiseBuffer(durationSec);
    if (!buf) return;

    const n = c.createBufferSource();
    n.buffer = buf;

    const g = c.createGain();
    envGain(g, t, 0.001, Math.max(0.02, durationSec), gainPeak, gainFloor);

    if (bpHz && Number.isFinite(bpHz)) {
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(bpHz, t);
        bp.Q.setValueAtTime(bpQ, t);
        n.connect(bp);
        bp.connect(g);
    } else {
        const hp = c.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(hpHz, t);
        n.connect(hp);
        hp.connect(g);
    }

    g.connect(master);
    n.start(t);
    n.stop(t + durationSec + 0.02);
}

function playLaunch(strength = 0.8) {
    const c = ensureContext();
    if (!c || !master) return;
    if (!shouldPlay('launch')) return;

    const s = clamp01(strength);
    const t = c.currentTime;

    // Exciting but short: a quick upward "whoop" + a bit of sparkle noise.
    const o = c.createOscillator();
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400 + 1000 * s, t);

    o.type = 'sawtooth';
    const f0 = 220 + 120 * s;
    const f1 = 720 + 260 * s;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.12);

    envGain(g, t, 0.003, 0.16, 0.11 * (0.65 + 0.35 * s), 0.00001);
    o.connect(lp);
    lp.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.18);

    // Sparkle: bandpass noise burst that scales with strength.
    playNoiseBurst(t, 0.06, {
        gainPeak: 0.010 + 0.014 * s,
        bpHz: 2600 + 900 * s,
        bpQ: 0.9
    });
}

function playBounce(impactStrength = 0.4, flavor = 'peg') {
    const c = ensureContext();
    if (!c || !master) return;
    if (!shouldPlay('bounce')) return;

    const s = clamp01(impactStrength);
    const t = c.currentTime;

    // Velocity drives both loudness and brightness. Keep it gentle.
    const o = c.createOscillator();
    const g = c.createGain();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(0.9 + 0.6 * s, t);
    bp.frequency.setValueAtTime((flavor === 'wall' ? 520 : (flavor === 'bin' ? 380 : 760)) + 520 * s, t);

    o.type = flavor === 'wall' ? 'sine' : (flavor === 'bin' ? 'sine' : 'triangle');
    const base = (flavor === 'wall' ? 220 : (flavor === 'bin' ? 160 : 360)) + 520 * s;
    o.frequency.setValueAtTime(base, t);
    // Tiny pitch drop feels more physical.
    o.frequency.exponentialRampToValueAtTime(Math.max(60, base * 0.92), t + 0.08);

    envGain(
        g,
        t,
        0.001,
        (flavor === 'wall' ? 0.10 : (flavor === 'bin' ? 0.13 : 0.07)),
        0.060 * (0.25 + 0.75 * s),
        0.00001
    );
    o.connect(bp);
    bp.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.11);

    // Add a tiny tick of noise only for stronger impacts.
    if (s > 0.35) {
        playNoiseBurst(t, 0.03, {
            gainPeak: (flavor === 'bin' ? 0.006 : 0.004) + 0.010 * s,
            hpHz: (flavor === 'bin' ? 2200 : 3200) + 900 * s
        });
    }
}

function playBinBounce(impactStrength = 0.4) {
    const c = ensureContext();
    if (!c || !master) return;
    if (!shouldPlay('binBounce')) return;

    const s = clamp01(impactStrength);
    const t = c.currentTime;

    // Container bounce: a soft, warm "tom" with a bit of air.
    const o = c.createOscillator();
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900 + 500 * s, t);

    o.type = 'sine';
    const base = 130 + 110 * s;
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(60, base * 0.82), t + 0.14);

    envGain(g, t, 0.001, 0.16, 0.070 * (0.25 + 0.75 * s), 0.00001);
    o.connect(lp);
    lp.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.20);

    // Airy puff (very subtle)
    playNoiseBurst(t, 0.06, {
        gainPeak: 0.004 + 0.008 * s,
        bpHz: 720 + 220 * s,
        bpQ: 0.9
    });
}

function playDrumHit(strength = 0.6, pitch = 180) {
    const c = ensureContext();
    if (!c || !master) return;

    const s = clamp01(strength);
    const t = c.currentTime;

    // A short percussive hit (tom-ish) + a tiny tick.
    const o = c.createOscillator();
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(800 + 900 * s, t);

    o.type = 'sine';
    const f0 = Math.max(80, pitch);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(60, f0 * 0.76), t + 0.12);

    envGain(g, t, 0.001, 0.14, 0.09 * (0.35 + 0.65 * s), 0.00001);
    o.connect(lp);
    lp.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.18);

    // Tiny tick for articulation
    playNoiseBurst(t, 0.025, {
        gainPeak: 0.003 + 0.006 * s,
        hpHz: 2800 + 700 * s
    });
}

function startDrumroll(durationMs = 2000, strength = 0.6) {
    const c = ensureContext();
    if (!c) return function() {};

    const s = clamp01(strength);
    const start = c.currentTime;
    const end = start + Math.max(0.2, durationMs / 1000);

    let cancelled = false;
    const timers = new Set();

    const scheduleNext = () => {
        if (cancelled) return;
        const t = c.currentTime;
        if (t >= end) return;

        const progress = clamp01((t - start) / Math.max(0.0001, (end - start)));
        // Accelerate as we approach reveal
        const interval = (1 - progress) * 0.16 + 0.05; // ~0.21s down to ~0.05s
        const pitch = 150 + 120 * progress;            // slight rise, not musical
        playDrumHit(0.45 + 0.45 * s, pitch);

        const id = setTimeout(() => {
            timers.delete(id);
            scheduleNext();
        }, Math.round(interval * 1000));
        timers.add(id);
    };

    scheduleNext();

    return function stop() {
        cancelled = true;
        for (const id of Array.from(timers)) {
            try { clearTimeout(id); } catch (_) { /* ignore */ }
        }
        timers.clear();
    };
}

function playReward(colorId = 'blue', strength = 0.8) {
    const c = ensureContext();
    if (!c || !master) return;
    if (!shouldPlay('reward')) return;

    const s = clamp01(strength);
    const t = c.currentTime;

    // Distinct "signature" per color.
    const palette = {
        red:   { f: 520, type: 'square',  sparkle: 3200 },
        orange:{ f: 460, type: 'sawtooth',sparkle: 3000 },
        yellow:{ f: 600, type: 'triangle',sparkle: 3600 },
        green: { f: 420, type: 'triangle',sparkle: 2600 },
        blue:  { f: 560, type: 'sine',    sparkle: 2400 },
        purple:{ f: 480, type: 'sawtooth',sparkle: 2800 }
    };
    const p = palette[String(colorId || '').toLowerCase()] || palette.blue;

    // Two oscillators at once (no sequence) = richer reward without "music".
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400 + 1100 * s, t);

    o1.type = p.type;
    o2.type = 'sine';
    o1.frequency.setValueAtTime(p.f, t);
    o2.frequency.setValueAtTime(p.f * 1.18, t); // gentle richness

    // Quick "bloom": tiny rise then decay
    envGain(g, t, 0.003, 0.20, 0.14 * (0.55 + 0.45 * s), 0.00001);
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    g.connect(master);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 0.24);
    o2.stop(t + 0.24);

    // Color sparkle
    playNoiseBurst(t, 0.08, {
        gainPeak: 0.008 + 0.014 * s,
        bpHz: p.sparkle,
        bpQ: 0.8
    });
}

function playPoof(strength = 0.6) {
    const c = ensureContext();
    if (!c || !master) return;
    if (!shouldPlay('poof')) return;

    const s = clamp01(strength);
    const t = c.currentTime;

    // A soft "puff" + low thump — gentle failure/cleanup cue.
    const o = c.createOscillator();
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(600 + 300 * s, t);

    o.type = 'sine';
    const f0 = 160 + 40 * s;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(60, f0 * 0.72), t + 0.14);

    envGain(g, t, 0.002, 0.16, 0.07 * (0.5 + 0.5 * s), 0.00001);
    o.connect(lp);
    lp.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.20);

    playNoiseBurst(t, 0.10, {
        gainPeak: 0.010 + 0.012 * s,
        bpHz: 420 + 120 * s,
        bpQ: 0.7
    });
}

function playReady(strength = 0.6) {
    const c = ensureContext();
    if (!c || !master) return;
    if (!shouldPlay('ready')) return;

    const s = clamp01(strength);
    const t = c.currentTime;

    // Distinct "get ready!" cue: a short bright chirp + a tiny sparkle.
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800 + 1200 * s, t);

    o1.type = 'triangle';
    o2.type = 'sine';
    const f0 = 520 + 120 * s;
    o1.frequency.setValueAtTime(f0, t);
    o1.frequency.exponentialRampToValueAtTime(f0 * 1.6, t + 0.16);
    o2.frequency.setValueAtTime(f0 * 2.0, t + 0.02);

    envGain(g, t, 0.003, 0.18, 0.11 * (0.55 + 0.45 * s), 0.00001);
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    g.connect(master);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 0.22);
    o2.stop(t + 0.22);

    playNoiseBurst(t + 0.03, 0.07, {
        gainPeak: 0.007 + 0.010 * s,
        bpHz: 3100 + 700 * s,
        bpQ: 0.9
    });
}

function playTick() {
    const c = ensureContext();
    if (!c || !master) return;
    if (!shouldPlay('tick')) return;

    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(920, t);

    // Very quiet, very short.
    envGain(g, t, 0.001, 0.03, 0.015, 0.00001);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.04);
}

function playPop(strength = 0.6) {
    const c = ensureContext();
    if (!c || !master) return;
    if (!shouldPlay('pop')) return;

    const s = clamp01(strength);
    const t = c.currentTime;

    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();

    // Two tones at once (not sequenced) to feel like a "spark" without becoming musical.
    const base = 520;
    o1.type = 'triangle';
    o2.type = 'sine';
    o1.frequency.setValueAtTime(base, t);
    o2.frequency.setValueAtTime(base * 1.24, t); // mild interval, not a melody

    envGain(g, t, 0.002, 0.09, 0.10 * (0.6 + 0.4 * s), 0.00001);
    o1.connect(g);
    o2.connect(g);
    g.connect(master);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 0.12);
    o2.stop(t + 0.12);

    // Tiny noise "glitter" tail
    const noiseBuf = makeNoiseBuffer(0.06);
    if (noiseBuf) {
        const n = c.createBufferSource();
        n.buffer = noiseBuf;
        const ng = c.createGain();
        const hp = c.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(2600, t);
        envGain(ng, t, 0.001, 0.06, 0.018 * (0.6 + 0.4 * s), 0.00001);
        n.connect(hp);
        hp.connect(ng);
        ng.connect(master);
        n.start(t);
        n.stop(t + 0.07);
    }
}

function playBuzz(strength = 0.7) {
    const c = ensureContext();
    if (!c || !master) return;
    if (!shouldPlay('buzz')) return;

    const s = clamp01(strength);
    const t = c.currentTime;

    const o = c.createOscillator();
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400 + 600 * s, t);

    o.type = 'square';
    o.frequency.setValueAtTime(155 + 25 * s, t);

    // Gentle vibrato (subtle)
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(16, t);
    lfoGain.gain.setValueAtTime(10 + 8 * s, t);
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);

    envGain(g, t, 0.004, 0.12, 0.085 * (0.6 + 0.4 * s), 0.00001);
    o.connect(lp);
    lp.connect(g);
    g.connect(master);

    o.start(t);
    lfo.start(t);
    o.stop(t + 0.15);
    lfo.stop(t + 0.15);

    // Add a soft bandpass noise layer to make it "friendly buzzy", not harsh.
    const noiseBuf = makeNoiseBuffer(0.09);
    if (noiseBuf) {
        const n = c.createBufferSource();
        n.buffer = noiseBuf;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(520, t);
        bp.Q.setValueAtTime(1.2, t);
        const ng = c.createGain();
        envGain(ng, t, 0.002, 0.10, 0.028 * (0.55 + 0.45 * s), 0.00001);
        n.connect(bp);
        bp.connect(ng);
        ng.connect(master);
        n.start(t);
        n.stop(t + 0.11);
    }
}

function playPlink(impactStrength = 0.4) {
    const c = ensureContext();
    if (!c || !master) return;
    if (!shouldPlay('plink')) return;

    // impactStrength is expected in "0..1-ish" space
    const s = clamp01(impactStrength);
    const t = c.currentTime;

    const o = c.createOscillator();
    const g = c.createGain();
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(220 + 1800 * s, t); // brighter on stronger impacts

    o.type = 'triangle';
    // A tiny, non-musical pitch variation
    const base = 420 + 260 * s;
    const detune = (Math.random() * 2 - 1) * 16;
    o.frequency.setValueAtTime(base, t);
    o.detune.setValueAtTime(detune, t);

    envGain(g, t, 0.001, 0.07, 0.070 * (0.35 + 0.65 * s), 0.00001);
    o.connect(hp);
    hp.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.09);

    // Small noise "tick" to add physicality
    const noiseBuf = makeNoiseBuffer(0.04);
    if (noiseBuf) {
        const n = c.createBufferSource();
        n.buffer = noiseBuf;
        const nhp = c.createBiquadFilter();
        nhp.type = 'highpass';
        nhp.frequency.setValueAtTime(3000, t);
        const ng = c.createGain();
        envGain(ng, t, 0.001, 0.04, 0.012 * (0.3 + 0.7 * s), 0.00001);
        n.connect(nhp);
        nhp.connect(ng);
        ng.connect(master);
        n.start(t);
        n.stop(t + 0.05);
    }
}

function playType(strength = 0.45, flavor = 'alpha') {
    const c = ensureContext();
    if (!c || !master) return;
    if (!shouldPlay('type')) return;

    const s = clamp01(strength);
    const t = c.currentTime;

    // "Clicky + poppy" micro-transient with lots of subtle variation, but not musical.
    // Layer 1: bright click (square through a highpass)
    const clickOsc = c.createOscillator();
    const clickGain = c.createGain();
    const clickHp = c.createBiquadFilter();
    clickHp.type = 'highpass';
    clickHp.frequency.setValueAtTime(900 + 2200 * s, t);

    clickOsc.type = 'square';
    const clickBase =
        flavor === 'space' ? (180 + 120 * Math.random()) :
        flavor === 'enter' ? (240 + 160 * Math.random()) :
        (260 + 520 * Math.random());
    clickOsc.frequency.setValueAtTime(clickBase, t);
    clickOsc.detune.setValueAtTime((Math.random() * 2 - 1) * 28, t);

    // Lower overall typing level (per user request) while keeping dynamics + variation.
    envGain(clickGain, t, 0.001, 0.045 + 0.020 * Math.random(), 0.016 * (0.35 + 0.65 * s), 0.00001);
    clickOsc.connect(clickHp);
    clickHp.connect(clickGain);
    clickGain.connect(master);
    clickOsc.start(t);
    clickOsc.stop(t + 0.08);

    // Layer 2: tiny "pop" body (triangle+sine) with randomized interval
    const body1 = c.createOscillator();
    const body2 = c.createOscillator();
    const bodyGain = c.createGain();
    const bodyLp = c.createBiquadFilter();
    bodyLp.type = 'lowpass';
    bodyLp.frequency.setValueAtTime(1200 + 1200 * s, t);

    body1.type = 'triangle';
    body2.type = 'sine';
    const bodyBase =
        flavor === 'space' ? (320 + 180 * Math.random()) :
        flavor === 'enter' ? (420 + 240 * Math.random()) :
        (420 + 520 * Math.random());
    const interval = 1.10 + 0.22 * Math.random(); // non-musical-ish ratio
    body1.frequency.setValueAtTime(bodyBase, t);
    body2.frequency.setValueAtTime(bodyBase * interval, t);
    body1.detune.setValueAtTime((Math.random() * 2 - 1) * 18, t);
    body2.detune.setValueAtTime((Math.random() * 2 - 1) * 18, t);

    // Slight "flick" up to keep it lively
    body1.frequency.exponentialRampToValueAtTime(bodyBase * (1.10 + 0.10 * Math.random()), t + 0.035);

    envGain(bodyGain, t, 0.001, 0.070 + 0.030 * Math.random(), 0.020 * (0.35 + 0.65 * s), 0.00001);
    body1.connect(bodyLp);
    body2.connect(bodyLp);
    bodyLp.connect(bodyGain);
    bodyGain.connect(master);
    body1.start(t);
    body2.start(t);
    body1.stop(t + 0.11);
    body2.stop(t + 0.11);

    // Layer 3: super-quiet sparkle/noise tick for "physicality"
    if (Math.random() < (0.55 + 0.25 * s)) {
        playNoiseBurst(t, 0.020 + 0.015 * Math.random(), {
            gainPeak: 0.0012 + 0.0022 * s,
            bpHz: 2200 + 2200 * Math.random(),
            bpQ: 0.8 + 0.6 * Math.random()
        });
    }

    // Occasional extra micro-click to avoid repetition (kept rare)
    if (Math.random() < 0.10) {
        const t2 = t + 0.028 + 0.020 * Math.random();
        const o2 = c.createOscillator();
        const g2 = c.createGain();
        o2.type = 'square';
        o2.frequency.setValueAtTime(520 + 820 * Math.random(), t2);
        envGain(g2, t2, 0.001, 0.028, 0.005 * (0.35 + 0.65 * s), 0.00001);
        o2.connect(g2);
        g2.connect(master);
        o2.start(t2);
        o2.stop(t2 + 0.05);
    }
}

function hueToFreq(hueDeg) {
    const h = clamp(Number(hueDeg), 0, 360);
    // Map 0..360° over ~3 octaves (fun but not strongly "melodic")
    // 120 Hz -> 960 Hz
    return 120 * Math.pow(2, (h / 360) * 3.0);
}

function stopColorDrag(whenSec = 0) {
    const c = ctx;
    const d = colorDrag;
    colorDrag = null;
    if (!d) return;

    const t = c ? (c.currentTime + Math.max(0, whenSec)) : 0;
    try {
        if (d.g && d.g.gain) {
            d.g.gain.cancelScheduledValues(t);
            d.g.gain.setTargetAtTime(0.00001, t, 0.02);
        }
    } catch (_) { /* ignore */ }

    const stopAt = t + 0.12;
    try { if (d.osc1) d.osc1.stop(stopAt); } catch (_) { /* ignore */ }
    try { if (d.osc2) d.osc2.stop(stopAt); } catch (_) { /* ignore */ }
    try { if (d.lfo) d.lfo.stop(stopAt); } catch (_) { /* ignore */ }
    try { if (d.noise) d.noise.stop(stopAt); } catch (_) { /* ignore */ }

    // Disconnect later (best-effort)
    setTimeout(() => {
        try { if (d.osc1) d.osc1.disconnect(); } catch (_) { /* ignore */ }
        try { if (d.osc2) d.osc2.disconnect(); } catch (_) { /* ignore */ }
        try { if (d.lfo) d.lfo.disconnect(); } catch (_) { /* ignore */ }
        try { if (d.noise) d.noise.disconnect(); } catch (_) { /* ignore */ }
        try { if (d.filt) d.filt.disconnect(); } catch (_) { /* ignore */ }
        try { if (d.noiseFilt) d.noiseFilt.disconnect(); } catch (_) { /* ignore */ }
        try { if (d.g) d.g.disconnect(); } catch (_) { /* ignore */ }
        try { if (d.noiseGain) d.noiseGain.disconnect(); } catch (_) { /* ignore */ }
    }, 220);
}

function startColorDrag() {
    const c = ensureContext();
    if (!c || !master) return false;

    // Only one at a time.
    stopColorDrag(0);

    const t = c.currentTime;

    const g = c.createGain();
    g.gain.setValueAtTime(0.00001, t);

    // Main tonal layer
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(1800, t);
    filt.Q.setValueAtTime(0.5, t);

    osc1.type = 'triangle';
    osc2.type = 'sine';

    // Subtle, stable detune so it feels "alive" but not wobbly.
    const det = (Math.random() * 2 - 1) * 9;
    osc1.detune.setValueAtTime(det, t);
    osc2.detune.setValueAtTime(-det, t);

    // LFO vibrato (depth changes with saturation)
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(7.5, t);
    lfoGain.gain.setValueAtTime(0, t);
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    osc1.connect(filt);
    osc2.connect(filt);
    filt.connect(g);
    g.connect(master);

    // Texture layer: gentle filtered noise to sell "drag"
    const noiseBuf = makeNoiseBuffer(0.8);
    let noise = null;
    let noiseFilt = null;
    let noiseGain = null;
    if (noiseBuf) {
        noise = c.createBufferSource();
        noise.buffer = noiseBuf;
        noise.loop = true;

        noiseFilt = c.createBiquadFilter();
        noiseFilt.type = 'bandpass';
        noiseFilt.frequency.setValueAtTime(1200, t);
        noiseFilt.Q.setValueAtTime(0.8, t);

        noiseGain = c.createGain();
        noiseGain.gain.setValueAtTime(0.00001, t);

        noise.connect(noiseFilt);
        noiseFilt.connect(noiseGain);
        noiseGain.connect(master);
        noise.start(t);
    }

    // Start
    osc1.start(t);
    osc2.start(t);
    lfo.start(t);

    colorDrag = { g, osc1, osc2, filt, lfo, lfoGain, noise, noiseFilt, noiseGain };
    return true;
}

function updateColorDrag({ hue = 0, t01 = 0, speed01 = 0.4 } = {}) {
    const c = ensureContext();
    if (!c || !master) return;
    if (!colorDrag) startColorDrag();
    if (!colorDrag) return;

    const d = colorDrag;
    const t = c.currentTime;

    const sat = clamp01(t01);
    const spd = clamp01(speed01);

    const base = hueToFreq(hue);
    // Slightly compress range near center so it doesn't feel "dead"
    const satLift = 0.92 + 0.18 * sat;
    const f1 = clamp(base * satLift, 110, 1200);
    const f2 = clamp(f1 * (1.12 + 0.16 * Math.sin((hue / 360) * Math.PI * 2)), 140, 1600);

    // Smooth parameter moves
    try {
        d.osc1.frequency.setTargetAtTime(f1, t, 0.015);
        d.osc2.frequency.setTargetAtTime(f2, t, 0.015);
    } catch (_) { /* ignore */ }

    // Brightness follows saturation (more saturated = brighter)
    const cut = 800 + 5200 * sat;
    try { d.filt.frequency.setTargetAtTime(cut, t, 0.03); } catch (_) { /* ignore */ }

    // Vibrato depth scales with saturation (subtle)
    const vibDepthHz = 0.8 + 10.0 * sat;
    try { d.lfoGain.gain.setTargetAtTime(vibDepthHz, t, 0.05); } catch (_) { /* ignore */ }

    // Loudness follows movement (dragging faster = a bit louder), also a bit more present when saturated.
    const level = (0.0012 + 0.0060 * spd) * (0.50 + 0.65 * sat);
    try { d.g.gain.setTargetAtTime(level, t, 0.02); } catch (_) { /* ignore */ }

    // Noise texture: tied more to movement than saturation
    if (d.noiseGain) {
        const nLevel = (0.00035 + 0.0018 * spd) * (0.45 + 0.55 * sat);
        try { d.noiseGain.gain.setTargetAtTime(nLevel, t, 0.02); } catch (_) { /* ignore */ }
    }
    if (d.noiseFilt) {
        const nFreq = 900 + 2400 * sat + 300 * spd;
        try { d.noiseFilt.frequency.setTargetAtTime(nFreq, t, 0.03); } catch (_) { /* ignore */ }
    }
}

function playScoreTick(strength = 0.7) {
    const c = ensureContext();
    if (!c || !master) return;
    if (!shouldPlay('scoreTick')) return;

    const s = clamp01(strength);
    const t = c.currentTime;

    // A crisp, positive "count up" blip: short tone + tiny sparkle.
    const o = c.createOscillator();
    const g = c.createGain();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(1.1 + 0.6 * s, t);
    bp.frequency.setValueAtTime(980 + 520 * s, t);

    o.type = 'sine';
    o.frequency.setValueAtTime(820 + 460 * s, t);
    // Quick upward flick reads "increment"
    o.frequency.exponentialRampToValueAtTime(1200 + 700 * s, t + 0.04);

    envGain(g, t, 0.001, 0.07, 0.060 * (0.55 + 0.45 * s), 0.00001);
    o.connect(bp);
    bp.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.09);

    // Micro sparkle (very quiet)
    if (s > 0.35) {
        playNoiseBurst(t, 0.03, {
            gainPeak: 0.003 + 0.004 * s,
            hpHz: 4200 + 900 * s
        });
    }
}

function playStar(strength = 0.9) {
    const c = ensureContext();
    if (!c || !master) return;
    if (!shouldPlay('star')) return;

    const s = clamp01(strength);
    const t = c.currentTime;

    // Tiny rising chime (3 notes) + sparkle tail.
    const notes = [
        660,                 // E5-ish
        880 + 40 * s,        // A5-ish
        1175 + 80 * s        // D6-ish
    ];

    for (let i = 0; i < notes.length; i++) {
        const o = c.createOscillator();
        const g = c.createGain();
        const start = t + i * 0.045;
        o.type = 'triangle';
        o.frequency.setValueAtTime(notes[i], start);
        envGain(g, start, 0.001, 0.11, 0.050 * (0.65 + 0.35 * s), 0.00001);
        o.connect(g);
        g.connect(master);
        o.start(start);
        o.stop(start + 0.13);
    }

    playNoiseBurst(t + 0.02, 0.12, {
        gainPeak: 0.006 + 0.010 * s,
        gainFloor: 0.00001,
        hpHz: 2500,
        bpHz: 4200 + 800 * s,
        bpQ: 0.9
    });
}

export const Audio = {
    ensure: function() {
        return !!ensureContext();
    },
    unlock: function() {
        return unlock();
    },
    isUnlocked: function() {
        return unlocked;
    },
    /**
     * Global mix knob (0..1). This scales everything uniformly (preserves dynamics).
     * Mapped to a perceptual dB curve; limiter/clipper only catch peaks.
     */
    setMasterLevel: function(level01, opts) {
        masterLevel = clamp01(level01);
        setLevelGain(levelToDb(masterLevel), opts || {});
        return masterLevel;
    },
    getMasterLevel: function() {
        return masterLevel;
    },
    /**
     * Optional: set in dB directly (useful for calibration).
     */
    setMasterDb: function(db, opts) {
        const dbClamped = clamp(db, MASTER_MIN_DB, MASTER_MAX_DB);
        // Keep masterLevel in sync (approx inverse mapping isn't needed; expose db as truth).
        setLevelGain(dbClamped, opts || {});
        return dbClamped;
    },
    tick: function() {
        playTick();
    },
    pop: function(strength) {
        playPop(strength);
    },
    buzz: function(strength) {
        playBuzz(strength);
    },
    plink: function(impactStrength) {
        playPlink(impactStrength);
    },
    launch: function(strength) {
        playLaunch(strength);
    },
    bounce: function(impactStrength, flavor) {
        playBounce(impactStrength, flavor);
    },
    binBounce: function(impactStrength) {
        playBinBounce(impactStrength);
    },
    reward: function(colorId, strength) {
        playReward(colorId, strength);
    },
    scoreTick: function(strength) {
        playScoreTick(strength);
    },
    star: function(strength) {
        playStar(strength);
    },
    poof: function(strength) {
        playPoof(strength);
    },
    ready: function(strength) {
        playReady(strength);
    },
    /**
     * Typing sound (clicky + poppy), designed to be fun with lots of variation,
     * but still safe and non-musical.
     *
     * flavor: 'alpha' | 'space' | 'enter'
     */
    type: function(strength, flavor) {
        playType(strength, flavor);
    },
    // Continuous tonal "drag" voice for the Colors wheel
    colorDragStart: function() {
        return startColorDrag();
    },
    colorDragUpdate: function({ hue, t, speed } = {}) {
        updateColorDrag({ hue, t01: t, speed01: speed });
    },
    colorDragStop: function() {
        stopColorDrag(0);
    },
    drumroll: function(durationMs, strength) {
        return startDrumroll(durationMs, strength);
    }
};

// Attach to window namespace for shared reuse
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Utils = window.WinnieOS.Utils || {};
    window.WinnieOS.Utils.Audio = Audio;
}


