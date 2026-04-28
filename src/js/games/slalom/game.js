/**
 * Jet Slalom — WinnieOS Edition
 *
 * Ported from JSlalom2024 "Winnie Edition". A toddler-friendly space jet slalom
 * rendered on Canvas 2D with a dual-loop architecture (55ms logic + 60fps RAF).
 *
 * Factory function returns { start, dispose } following the WinnieOS game contract.
 */

import { DrawEnv } from './drawEnv.js';
import { Ground } from './ground.js';
import { ObstacleCollection } from './obstacle.js';
import { NormalRound } from './normalRound.js';
import { RandomGenerator } from './randomGenerator.js';
import { Audio } from '../../utils/audio.js';

import jikiSrc from './assets/jiki.gif';
import jiki2Src from './assets/jiki2.gif';
import bombSrc from './assets/BOMB.wav';

const READY_MODE = 0;
const PLAY_MODE = 1;
const BOOM_MODE = 2;

const TICK_MS = 55;

const CANDY_COLORS = [
  { r: 255, g: 60, b: 60 },
  { r: 255, g: 160, b: 40 },
  { r: 255, g: 240, b: 50 },
  { r: 255, g: 80, b: 200 },
  { r: 50, g: 220, b: 255 }
];

const RAINBOW = [
  { r: 255, g: 0, b: 0 }, { r: 255, g: 127, b: 0 }, { r: 255, g: 255, b: 0 },
  { r: 0, g: 255, b: 0 }, { r: 0, g: 127, b: 255 }, { r: 127, g: 0, b: 255 }
];

// ── Visual progression tiers ──────────────────────────────────────────────
// Each tier defines the sky gradient, ground color, and which sky decorations
// are active. Tiers 0-4 map to star counts; tier 5+ enters "super star" mode
// with procedural hue cycling.
const TIERS = [
  { // 0 stars — bright morning
    sky:    { r: 100, g: 200, b: 255 },
    ground: { r: 50, g: 220, b: 80 },
    clouds: true, skyStars: false, moon: false, shootingStars: false, aurora: false,
  },
  { // 1 star — golden hour
    sky:    { r: 255, g: 190, b: 90 },
    ground: { r: 110, g: 180, b: 50 },
    clouds: true, skyStars: false, moon: false, shootingStars: false, aurora: false,
  },
  { // 2 stars — sunset
    sky:    { r: 255, g: 110, b: 130 },
    ground: { r: 40, g: 160, b: 140 },
    clouds: true, skyStars: false, moon: false, shootingStars: false, aurora: false,
  },
  { // 3 stars — twilight
    sky:    { r: 60, g: 50, b: 120 },
    ground: { r: 30, g: 60, b: 80 },
    clouds: false, skyStars: true, moon: true, shootingStars: false, aurora: false,
  },
  { // 4 stars — night
    sky:    { r: 12, g: 12, b: 35 },
    ground: { r: 15, g: 40, b: 55 },
    clouds: false, skyStars: true, moon: true, shootingStars: true, aurora: false,
  },
  // 5+ stars — super star / aurora (base colors, hue-shifted procedurally)
];

// Fixed starfield positions (seeded once so they don't jitter)
const SKY_STAR_POSITIONS = [];
for (let i = 0; i < 60; i++) {
  SKY_STAR_POSITIONS.push({
    xNorm: Math.random(),           // 0..1 across width
    yNorm: Math.random() * 0.45,    // top 45% of sky
    size: 0.5 + Math.random() * 1.5,
    twinkleSpeed: 0.02 + Math.random() * 0.04,
    twinkleOffset: Math.random() * Math.PI * 2,
  });
}

/**
 * @param {{ canvas: HTMLCanvasElement }} opts
 * @returns {{ start: () => void, dispose: () => void }}
 */
export function createSlalomGame({ canvas }) {
  const ctx = canvas.getContext('2d');
  let disposed = false;

  // ── Dimensions ────────────────────────────────────────────────────────────
  let width = canvas.width;
  let height = canvas.height;
  let centerX = width / 2;
  let centerY = height / 2;

  function syncSize() {
    width = canvas.width;
    height = canvas.height;
    centerX = width / 2;
    centerY = height / 2;
    mywidth2 = (width * mywidth * 120 / 1.6 / 320) | 0;
  }

  // ── Engine objects ────────────────────────────────────────────────────────
  const env = new DrawEnv();
  const ground = new Ground();
  const obstacles = new ObstacleCollection();

  // Lightweight recorder stub — we only need the PRNG for obstacle generation
  const recorder = {
    _rng: new RandomGenerator((Math.random() * 0x7fffffff) | 0),
    getRandom() { return this._rng.nextInt(); },
    writeStatus() {},
    reset() { this._rng.setSeed((Math.random() * 0x7fffffff) | 0); }
  };

  // ── Game state ────────────────────────────────────────────────────────────
  let vx = 0;
  const mywidth = 0.5;
  let mywidth2 = 0;
  let score = 0;
  let starCount = 0;
  let lastStarScore = 0;
  let starFlash = 0;
  let shipCounter = 0;
  let damaged = 0;
  let round = 0;
  let gameMode = READY_MODE;

  let rFlag = false;
  let lFlag = false;

  let boomFrame = 0;
  let particles = [];
  let fireworks = [];
  let readyFrame = 0;
  let autoRestartTimer = 0;

  // Sin/cos lookup (128 entries)
  const si = new Float64Array(128);
  const co = new Float64Array(128);
  for (let i = 0; i < 128; i++) {
    si[i] = Math.sin(Math.PI * i / 75 / 6);
    co[i] = Math.cos(Math.PI * i / 75 / 6);
  }

  // Progressive rounds — obstacle spawn interval decreases gradually.
  // Sky/ground colors here are kept as fallbacks but progression tiers override them visually.
  const rounds = [
    new NormalRound(10000,   { r: 100, g: 200, b: 255 }, { r: 50, g: 220, b: 80 },  7), // ~star 1
    new NormalRound(20000,   { r: 255, g: 190, b: 90 },  { r: 110, g: 180, b: 50 }, 6), // ~star 2
    new NormalRound(30000,   { r: 255, g: 110, b: 130 }, { r: 40, g: 160, b: 140 }, 5), // ~star 3
    new NormalRound(40000,   { r: 60, g: 50, b: 120 },   { r: 30, g: 60, b: 80 },  5), // ~star 4
    new NormalRound(50000,   { r: 12, g: 12, b: 35 },    { r: 15, g: 40, b: 55 },  4), // ~star 5
    new NormalRound(1000000, { r: 12, g: 12, b: 35 },    { r: 15, g: 40, b: 55 },  4), // super star
  ];
  for (let i = 1; i < rounds.length; i++) {
    rounds[i].setPrevRound(rounds[i - 1]);
  }

  // ── Progression state ────────────────────────────────────────────────────
  // We blend smoothly between tiers over ~3 seconds. The "from" snapshot is
  // captured the moment a new star triggers a tier change, and tierBlend
  // eases from 0→1. Colors, cloud opacity, starfield opacity, etc. all
  // interpolate through this single blend value — no instant snaps.

  let currentTier = 0;           // the tier we are blending TOWARD
  let tierBlend = 1;             // 0 = fully "from", 1 = fully "current" (start settled)
  let _superStarHue = 0;

  // Reusable color objects (avoid per-frame allocation)
  const _tierSky = { r: 100, g: 200, b: 255 };
  const _tierGround = { r: 50, g: 220, b: 80 };
  const _fromSky = { r: 100, g: 200, b: 255 };
  const _fromGround = { r: 50, g: 220, b: 80 };

  // Decoration opacity values (smoothly interpolated)
  let _cloudOpacity = 1;         // 1 for day tiers, fades to 0
  let _skyStarOpacity = 0;       // 0 for day, fades to 1 at night
  let _moonOpacity = 0;
  let _shootingStarChance = 0;
  let _auroraOpacity = 0;

  // Shooting stars pool
  const _shootingStars = [];

  // Cloud positions (seeded once)
  const _clouds = [];
  for (let i = 0; i < 6; i++) {
    _clouds.push({
      xNorm: Math.random(),
      yNorm: 0.05 + Math.random() * 0.25,
      wNorm: 0.08 + Math.random() * 0.12,
      speed: 0.00008 + Math.random() * 0.00012,
    });
  }

  function _copyColor(dst, src) {
    dst.r = src.r; dst.g = src.g; dst.b = src.b;
  }

  function _lerpColorInto(dst, a, b, t) {
    dst.r = Math.round(a.r + t * (b.r - a.r));
    dst.g = Math.round(a.g + t * (b.g - a.g));
    dst.b = Math.round(a.b + t * (b.b - a.b));
  }

  // Ease function for smoother transitions (ease-in-out)
  function _ease(t) {
    return t * t * (3 - 2 * t);
  }

  function _updateProgression() {
    const targetTier = Math.min(starCount, 4);

    // Detect tier change — snapshot current colors as "from" and start blend
    if (currentTier !== targetTier) {
      _copyColor(_fromSky, _tierSky);
      _copyColor(_fromGround, _tierGround);
      currentTier = targetTier;
      tierBlend = 0;
    }

    // Advance blend (~3 seconds at 60fps = 180 frames, 1/180 ≈ 0.0056)
    if (tierBlend < 1) {
      tierBlend = Math.min(1, tierBlend + 0.0056);
    }

    const t = _ease(tierBlend);
    const target = TIERS[currentTier];

    // Interpolate sky/ground colors from snapshot toward target
    _lerpColorInto(_tierSky, _fromSky, target.sky, t);
    _lerpColorInto(_tierGround, _fromGround, target.ground, t);

    // Super star mode: gently modulate the target colors procedurally
    if (starCount >= 5) {
      _superStarHue += 0.3;
      const h = _superStarHue;
      // Small procedural offset on top of the blended night base
      _tierSky.r = Math.max(0, Math.min(255, _tierSky.r + Math.round(12 * Math.sin(h * 0.01))));
      _tierSky.g = Math.max(0, Math.min(255, _tierSky.g + Math.round(10 * Math.sin(h * 0.01 + 2.1))));
      _tierSky.b = Math.max(0, Math.min(255, _tierSky.b + Math.round(15 * Math.sin(h * 0.01 + 4.2))));
      _tierGround.r = Math.max(0, Math.min(255, _tierGround.r + Math.round(12 * Math.sin(h * 0.013 + 1))));
      _tierGround.g = Math.max(0, Math.min(255, _tierGround.g + Math.round(15 * Math.sin(h * 0.013 + 3))));
      _tierGround.b = Math.max(0, Math.min(255, _tierGround.b + Math.round(10 * Math.sin(h * 0.013 + 5))));
    }

    // Smoothly interpolate decoration opacities toward their target values
    const FADE_SPEED = 0.012; // ~1.4 seconds to fully fade in/out
    const cloudTarget = target.clouds ? 1 : 0;
    const skyStarTarget = target.skyStars ? 1 : 0;
    const moonTarget = target.moon ? 1 : 0;
    const shootTarget = (target.shootingStars || starCount >= 5) ? 1 : 0;
    const auroraTarget = starCount >= 5 ? 1 : 0;

    _cloudOpacity += (cloudTarget - _cloudOpacity) * FADE_SPEED;
    _skyStarOpacity += (skyStarTarget - _skyStarOpacity) * FADE_SPEED;
    _moonOpacity += (moonTarget - _moonOpacity) * FADE_SPEED;
    _shootingStarChance += (shootTarget - _shootingStarChance) * FADE_SPEED;
    _auroraOpacity += (auroraTarget - _auroraOpacity) * FADE_SPEED;

    // Clamp near-zero to zero to avoid pointless drawing
    if (_cloudOpacity < 0.005) _cloudOpacity = 0;
    if (_skyStarOpacity < 0.005) _skyStarOpacity = 0;
    if (_moonOpacity < 0.005) _moonOpacity = 0;
    if (_shootingStarChance < 0.005) _shootingStarChance = 0;
    if (_auroraOpacity < 0.005) _auroraOpacity = 0;

    // Spawn shooting stars based on interpolated chance
    if (_shootingStarChance > 0.1 && Math.random() < 0.008 * _shootingStarChance) {
      _shootingStars.push({
        x: Math.random() * 0.8 + 0.1,
        y: Math.random() * 0.2 + 0.02,
        dx: (0.008 + Math.random() * 0.012) * (Math.random() > 0.5 ? 1 : -1),
        dy: 0.004 + Math.random() * 0.006,
        life: 20 + (Math.random() * 15) | 0,
      });
    }
  }

  // Interpolation state
  let _prevVx = 0;
  let _prevShipCounter = 0;
  let _prevLogicScore = 0;
  let _prevDamaged = 0;
  let _prevSkyColor = { r: 100, g: 200, b: 255 };
  let _prevGroundColor = { r: 50, g: 220, b: 80 };
  let _prevSnapshots = new Map();

  // Loop handles
  let _timerId = null;
  let _rafId = null;
  let lastTickTime = 0;

  // ── Images ────────────────────────────────────────────────────────────────
  let myImg = null;
  let myImg2 = null;

  function loadImages() {
    return new Promise((resolve) => {
      let loaded = 0;
      const check = () => { if (++loaded === 2) resolve(); };
      myImg = new Image();
      myImg.onload = check;
      myImg.onerror = check;
      myImg.src = jikiSrc;

      myImg2 = new Image();
      myImg2.onload = check;
      myImg2.onerror = check;
      myImg2.src = jiki2Src;
    });
  }

  // ── Audio (own AudioContext for procedural sounds) ────────────────────────
  let audioCtx = null;
  let bombBuffer = null;

  function initAudio() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      fetch(bombSrc)
        .then(r => r.arrayBuffer())
        .then(ab => audioCtx.decodeAudioData(ab))
        .then(buf => { bombBuffer = buf; })
        .catch(() => {});
    } catch (_) {}
  }

  function playBombSound() {
    if (!audioCtx || !bombBuffer) return;
    try {
      const source = audioCtx.createBufferSource();
      source.buffer = bombBuffer;
      source.playbackRate.value = 0.8 + Math.random() * 0.5;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.2;
      source.connect(gain).connect(audioCtx.destination);
      source.start();
    } catch (_) {}
  }

  function _proceduralSound(fn) {
    if (!audioCtx) return;
    try { fn(audioCtx); } catch (_) {}
  }

  function playBoomSound() {
    _proceduralSound((ctx) => {
      const duration = 0.8;
      const bufferSize = (ctx.sampleRate * duration) | 0;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        const freq = 200 - 187.5 * t;
        data[i] = (Math.sin(2 * Math.PI * freq * t) * 0.3 + (Math.random() * 2 - 1) * 0.4) * Math.exp(-t * 3);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    });
  }

  function playStarSound() {
    // Bridge to WinnieOS Audio when available
    try { Audio.star(0.5); return; } catch (_) {}
    _proceduralSound((ctx) => {
      const duration = 0.25;
      const bufferSize = (ctx.sampleRate * duration) | 0;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        data[i] = Math.sin(2 * Math.PI * (t < 0.12 ? 523 : 659) * t) * 0.3 * Math.exp(-t * 4);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    });
  }

  function playReadyBoop() {
    // Bridge to WinnieOS Audio
    try { Audio.pop(0.4); return; } catch (_) {}
    _proceduralSound((ctx) => {
      const duration = 0.12;
      const bufferSize = (ctx.sampleRate * duration) | 0;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        data[i] = Math.sin(2 * Math.PI * 440 * t) * 0.25 * Math.exp(-t * 12);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    });
  }

  function playFireworkPop() {
    _proceduralSound((ctx) => {
      const duration = 0.08;
      const bufferSize = (ctx.sampleRate * duration) | 0;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 40) * 0.3;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.2;
      source.connect(gain).connect(ctx.destination);
      source.start();
    });
  }

  // ── Input handling ────────────────────────────────────────────────────────
  const cleanupFns = [];

  // Pointer helper: given a clientX position, determine left/right/center zone.
  // Returns -1 (left), 0 (center play-button zone), 1 (right).
  function _pointerZone(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;   // 0..1
    const relY = (clientY - rect.top) / rect.height;    // 0..1
    // Center play button occupies roughly the middle 30% x 20% area near bottom-center
    if (relX > 0.35 && relX < 0.65 && relY > 0.55 && relY < 0.85) return 0;
    if (relX < 0.5) return -1;
    return 1;
  }

  function _evaluatePointerFlags(clientX, clientY) {
    const zone = _pointerZone(clientX, clientY);
    lFlag = zone === -1;
    rFlag = zone === 1;
    return zone;
  }

  function bindInput() {
    // ── Keyboard ──
    function onKeyDown(e) {
      if (disposed) return;
      if ([37, 39, 32].includes(e.keyCode)) e.preventDefault();
      if (e.keyCode === 39) rFlag = true;
      if (e.keyCode === 37) lFlag = true;
      if (e.keyCode === 32) {
        if (gameMode === READY_MODE || gameMode === BOOM_MODE) startGame();
      }
    }
    function onKeyUp(e) {
      if (disposed) return;
      if (e.keyCode === 39) rFlag = false;
      if (e.keyCode === 37) lFlag = false;
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    cleanupFns.push(() => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    });

    // ── Touch ──
    // Evaluates ALL current touches for left/right flags.
    function evaluateTouchFlags(touches) {
      lFlag = false;
      rFlag = false;
      for (const t of touches) {
        const zone = _pointerZone(t.clientX, t.clientY);
        if (zone === -1) lFlag = true;
        if (zone === 1) rFlag = true;
      }
    }

    function onTouchStart(e) {
      if (disposed) return;
      e.preventDefault();
      // In READY/BOOM: any touch in the center play-button zone starts the game;
      // touches on the sides still set direction flags (discovery steering).
      if (gameMode === READY_MODE || gameMode === BOOM_MODE) {
        let shouldStart = false;
        for (const t of e.changedTouches) {
          if (_pointerZone(t.clientX, t.clientY) === 0) shouldStart = true;
        }
        evaluateTouchFlags(e.touches);
        if (shouldStart) startGame();
      } else {
        evaluateTouchFlags(e.touches);
      }
    }
    function onTouchEnd(e) {
      if (disposed) return;
      e.preventDefault();
      evaluateTouchFlags(e.touches);
    }
    function onTouchCancel() {
      lFlag = false;
      rFlag = false;
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchCancel);
    cleanupFns.push(() => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchCancel);
    });

    // ── Mouse (for desktop testing + touchscreens that emit mouse events) ──
    let mouseDown = false;

    function onMouseDown(e) {
      if (disposed) return;
      e.preventDefault();
      mouseDown = true;
      const zone = _evaluatePointerFlags(e.clientX, e.clientY);
      if ((gameMode === READY_MODE || gameMode === BOOM_MODE) && zone === 0) {
        startGame();
      }
    }
    function onMouseMove(e) {
      if (disposed || !mouseDown) return;
      _evaluatePointerFlags(e.clientX, e.clientY);
    }
    function onMouseUp() {
      if (disposed) return;
      mouseDown = false;
      lFlag = false;
      rFlag = false;
    }

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    cleanupFns.push(() => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
    });
  }

  // ── Game lifecycle ────────────────────────────────────────────────────────

  function startGame() {
    if (gameMode === PLAY_MODE) return;
    initAudio();
    playReadyBoop();

    recorder.reset();
    obstacles.removeAll();
    for (let i = 0; i < rounds.length; i++) rounds[i].init();

    damaged = 0;
    round = 0;
    score = 0;
    starCount = 0;
    lastStarScore = 0;
    starFlash = 0;
    vx = 0;
    particles = [];
    currentTier = 0;
    tierBlend = 1;
    _copyColor(_tierSky, TIERS[0].sky);
    _copyColor(_tierGround, TIERS[0].ground);
    _copyColor(_fromSky, TIERS[0].sky);
    _copyColor(_fromGround, TIERS[0].ground);
    _superStarHue = 0;
    _cloudOpacity = 1;
    _skyStarOpacity = 0;
    _moonOpacity = 0;
    _shootingStarChance = 0;
    _auroraOpacity = 0;
    _shootingStars.length = 0;
    gameMode = PLAY_MODE;
  }

  function keyOperate() {
    if (gameMode === PLAY_MODE && damaged === 0) {
      if (rFlag) vx -= 0.1;
      if (lFlag) vx += 0.1;
      if (vx < -0.6) vx = -0.6;
      if (vx > 0.6) vx = 0.6;
    }
    if (gameMode === READY_MODE) {
      if (rFlag) vx -= 0.1;
      if (lFlag) vx += 0.1;
      if (vx < -0.6) vx = -0.6;
      if (vx > 0.6) vx = 0.6;
    }
    if (!lFlag && !rFlag) {
      if (vx < 0) { vx += 0.025; if (vx > 0) vx = 0; }
      if (vx > 0) { vx -= 0.025; if (vx < 0) vx = 0; }
    }
  }

  function moveObstacle() {
    const absVx = (Math.abs(vx) * 100) | 0;
    env.nowSin = si[absVx];
    env.nowCos = co[absVx];
    if (vx > 0) env.nowSin = -env.nowSin;

    let ob = obstacles.head.next;
    while (ob !== obstacles.tail) {
      const nextOb = ob.next;
      ob.move(vx, 0, -1.0);
      if (ob.points[0].z <= 1.1) {
        const halfWidth = mywidth * env.nowCos;
        if (-halfWidth < ob.points[2].x && ob.points[0].x < halfWidth) {
          damaged++;
        }
        ob.release();
      }
      ob = nextOb;
    }

    rounds[round].move(vx);
    rounds[round].generateObstacle(obstacles, recorder, vx);
  }

  // ── Interpolation ─────────────────────────────────────────────────────────

  function _savePrevState() {
    _prevVx = vx;
    _prevShipCounter = shipCounter;
    _prevLogicScore = score;
    _prevDamaged = damaged;
    _prevSkyColor.r = _tierSky.r; _prevSkyColor.g = _tierSky.g; _prevSkyColor.b = _tierSky.b;
    _prevGroundColor.r = _tierGround.r; _prevGroundColor.g = _tierGround.g; _prevGroundColor.b = _tierGround.b;

    _prevSnapshots = new Map();
    let ob = obstacles.head.next;
    while (ob !== obstacles.tail) {
      _prevSnapshots.set(ob, [
        { x: ob.points[0].x, y: ob.points[0].y, z: ob.points[0].z },
        { x: ob.points[1].x, y: ob.points[1].y, z: ob.points[1].z },
        { x: ob.points[2].x, y: ob.points[2].y, z: ob.points[2].z },
        { x: ob.points[3].x, y: ob.points[3].y, z: ob.points[3].z },
      ]);
      ob = ob.next;
    }
  }

  function _lerpColor(a, b, t) {
    return {
      r: Math.round(a.r + t * (b.r - a.r)),
      g: Math.round(a.g + t * (b.g - a.g)),
      b: Math.round(a.b + t * (b.b - a.b)),
    };
  }

  // ── Render loop (60fps) ───────────────────────────────────────────────────

  function _rafLoop() {
    if (_rafId === null || disposed) return;
    const alpha = Math.min(1, (performance.now() - lastTickTime) / TICK_MS);
    _renderFrame(alpha);
    _rafId = requestAnimationFrame(_rafLoop);
  }

  function _renderFrame(alpha) {
    syncSize();
    env.setCtx(ctx, width, height);

    let shakeX = 0, shakeY = 0;
    if (gameMode === BOOM_MODE && boomFrame < 16) {
      shakeX = (Math.random() * 8 - 4) * width / 320;
      shakeY = (Math.random() * 8 - 4) * height / 200;
    }

    ctx.save();
    if (shakeX || shakeY) ctx.translate(shakeX, shakeY);

    if (gameMode === BOOM_MODE) {
      _renderBoom(alpha);
    } else {
      _updateProgression();

      // Sky — use progression tier color instead of round color
      const sky = _lerpColor(_prevSkyColor, _tierSky, alpha);
      env.clearBuffer(sky.r, sky.g, sky.b);

      // Sky decorations (behind ground)
      _drawSkyDecorations(alpha);

      const interpVx = _prevVx + alpha * (vx - _prevVx);
      const idx = Math.min(127, (Math.abs(interpVx) * 100) | 0);
      env.nowSin = si[idx] * (interpVx > 0 ? -1 : 1);
      env.nowCos = co[idx];

      // Ground — use progression tier color
      const gc = _lerpColor(_prevGroundColor, _tierGround, alpha);
      ground.color = gc;
      ground.draw(env);

      if (gameMode === PLAY_MODE) _drawObstaclesInterpolated(alpha);

      _drawWakeSpray(alpha);
      _drawShip(alpha);
      _drawDirectionIndicators(alpha);

      if (damaged > 0 && gameMode === PLAY_MODE) _drawBomb(alpha);

      _renderStars(alpha);

      if (gameMode === READY_MODE) _renderReady();
    }

    _updateAndDrawParticles();
    ctx.restore();
  }

  // ── Sky decorations ────────────────────────────────────────────────────────

  let _skyFrame = 0;

  function _drawSkyDecorations() {
    _skyFrame++;
    const w = width, h = height;
    const s = w / 320;

    // Each decoration fades in/out via its interpolated opacity value
    if (_cloudOpacity > 0) _drawClouds(w, h, s);
    if (_skyStarOpacity > 0) _drawSkyStars(w, h, s);
    if (_moonOpacity > 0) _drawMoon(w, h, s);
    if (_shootingStars.length > 0) _drawShootingStars(w, h, s);
    if (_auroraOpacity > 0) _drawAurora(w, h, s);
  }

  function _drawClouds(w, h, s) {
    const isWarm = currentTier >= 1 && currentTier <= 2;
    const baseAlpha = _cloudOpacity * (isWarm ? 0.35 : 0.3);

    ctx.save();
    ctx.globalAlpha = baseAlpha;
    ctx.fillStyle = isWarm ? 'rgb(255, 220, 200)' : 'rgb(255, 255, 255)';

    for (const c of _clouds) {
      c.xNorm = (c.xNorm + c.speed) % 1.3;
      const cx = (c.xNorm - 0.15) * w;
      const cy = c.yNorm * h;
      const cw = c.wNorm * w;
      const ch = cw * 0.4;

      ctx.beginPath();
      ctx.ellipse(cx, cy, cw * 0.5, ch * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - cw * 0.3, cy + ch * 0.1, cw * 0.35, ch * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + cw * 0.3, cy + ch * 0.05, cw * 0.3, ch * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function _drawSkyStars(w, h, s) {
    const fade = _skyStarOpacity;
    ctx.fillStyle = '#ffffff';
    for (const st of SKY_STAR_POSITIONS) {
      const x = st.xNorm * w;
      const y = st.yNorm * h;
      const twinkle = 0.4 + 0.6 * Math.sin(_skyFrame * st.twinkleSpeed + st.twinkleOffset);
      const r = st.size * s;

      ctx.globalAlpha = twinkle * 0.9 * fade;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      if (st.size > 1.2 && twinkle > 0.7 && fade > 0.5) {
        ctx.globalAlpha = (twinkle - 0.7) * 2 * fade;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.5 * s;
        ctx.beginPath();
        ctx.moveTo(x - r * 2, y);
        ctx.lineTo(x + r * 2, y);
        ctx.moveTo(x, y - r * 2);
        ctx.lineTo(x, y + r * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function _drawMoon(w, h, s) {
    const mx = w * 0.15;
    const my = h * 0.18;
    const mr = 12 * s;
    const fade = _moonOpacity;

    ctx.save();
    ctx.globalAlpha = fade;

    // Moon glow
    const grad = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 3);
    grad.addColorStop(0, 'rgba(200, 210, 255, 0.15)');
    grad.addColorStop(1, 'rgba(200, 210, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 3, 0, Math.PI * 2);
    ctx.fill();

    // Full circle
    ctx.fillStyle = '#e8e8f0';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();

    // Crescent shadow
    ctx.fillStyle = `rgb(${_tierSky.r},${_tierSky.g},${_tierSky.b})`;
    ctx.beginPath();
    ctx.arc(mx + mr * 0.45, my - mr * 0.1, mr * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function _drawShootingStars(w, h, s) {
    for (let i = _shootingStars.length - 1; i >= 0; i--) {
      const ss = _shootingStars[i];
      ss.x += ss.dx;
      ss.y += ss.dy;
      ss.life--;

      if (ss.life <= 0) {
        _shootingStars.splice(i, 1);
        continue;
      }

      const sx = ss.x * w;
      const sy = ss.y * h;
      const tailLen = 20 * s;
      const a = Math.min(1, ss.life / 10);

      ctx.save();
      ctx.globalAlpha = a * 0.9;
      const grad = ctx.createLinearGradient(
        sx, sy,
        sx - ss.dx * tailLen * 80, sy - ss.dy * tailLen * 80
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - ss.dx * tailLen * 60, sy - ss.dy * tailLen * 60);
      ctx.stroke();

      // Bright head
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function _drawAurora(w, h, s) {
    const t = _skyFrame * 0.015;
    const fade = _auroraOpacity;

    ctx.save();
    ctx.globalAlpha = fade;
    for (let i = 0; i < 5; i++) {
      const phase = t + i * 1.3;
      const cx = w * (0.1 + 0.8 * ((Math.sin(phase * 0.7 + i) + 1) / 2));
      const bandW = w * (0.15 + 0.1 * Math.sin(phase * 0.3));
      const bandH = h * (0.25 + 0.1 * Math.sin(phase * 0.5));

      const hue = (i * 72 + _superStarHue * 0.8) % 360;
      const r = Math.round(80 + 80 * Math.sin(hue * 0.0174));
      const g = Math.round(180 + 75 * Math.sin(hue * 0.0174 + 2.1));
      const b = Math.round(120 + 100 * Math.sin(hue * 0.0174 + 4.2));

      const aBase = 0.08 + 0.04 * Math.sin(phase);
      const aMid = 0.15 + 0.08 * Math.sin(phase * 1.3);
      const grad = ctx.createLinearGradient(cx, 0, cx, bandH);
      grad.addColorStop(0, `rgba(${r},${g},${b},${aBase})`);
      grad.addColorStop(0.5, `rgba(${r},${g},${b},${aMid})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, 0, bandW, bandH, 0, 0, Math.PI);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Obstacle rendering ────────────────────────────────────────────────────

  function _obstacleRiseT(z) {
    const FAR = 40.5, NEAR = 38;
    if (z >= FAR) return 0;
    if (z <= NEAR) return 1;
    return (FAR - z) / (FAR - NEAR);
  }

  function _drawObstaclesInterpolated(alpha) {
    const GROUND_Y = 2.0;
    let ob = obstacles.head.next;
    while (ob !== obstacles.tail) {
      const prev = _prevSnapshots.get(ob);
      if (prev) {
        const cur = [
          { x: ob.points[0].x, y: ob.points[0].y, z: ob.points[0].z },
          { x: ob.points[1].x, y: ob.points[1].y, z: ob.points[1].z },
          { x: ob.points[2].x, y: ob.points[2].y, z: ob.points[2].z },
          { x: ob.points[3].x, y: ob.points[3].y, z: ob.points[3].z },
        ];
        const zDelta = Math.abs(prev[0].z - cur[0].z);
        if (zDelta < 3) {
          for (let i = 0; i < 4; i++) {
            ob.points[i].x = prev[i].x + alpha * (cur[i].x - prev[i].x);
            ob.points[i].y = prev[i].y + alpha * (cur[i].y - prev[i].y);
            ob.points[i].z = prev[i].z + alpha * (cur[i].z - prev[i].z);
          }
          const riseT = _obstacleRiseT(ob.points[0].z);
          ob.points[1].y = GROUND_Y + (ob.points[1].y - GROUND_Y) * riseT;
          ob.draw(env);
          for (let i = 0; i < 4; i++) {
            ob.points[i].x = cur[i].x;
            ob.points[i].y = cur[i].y;
            ob.points[i].z = cur[i].z;
          }
        } else {
          const riseT = _obstacleRiseT(cur[0].z);
          const savedY1 = ob.points[1].y;
          ob.points[1].y = GROUND_Y + (savedY1 - GROUND_Y) * riseT;
          ob.draw(env);
          ob.points[1].y = savedY1;
        }
      } else {
        const riseT = _obstacleRiseT(ob.points[0].z);
        const savedY1 = ob.points[1].y;
        ob.points[1].y = GROUND_Y + (savedY1 - GROUND_Y) * riseT;
        ob.draw(env);
        ob.points[1].y = savedY1;
      }
      ob = ob.next;
    }
  }

  // ── Direction indicators ───────────────────────────────────────────────────
  // Big friendly arrow chevrons on left/right edges. Always visible as soft
  // ghost outlines so Winnie knows they exist; glow bright when pressed.

  // Smooth animation state for left/right glow (0 = idle, 1 = fully lit)
  let _lGlow = 0;
  let _rGlow = 0;

  function _drawDirectionIndicators(alpha) {
    const w = width, h = height;
    const s = w / 320;

    // Animate glow toward target (smooth rise/fall)
    const lTarget = lFlag ? 1 : 0;
    const rTarget = rFlag ? 1 : 0;
    _lGlow += (lTarget - _lGlow) * 0.25;
    _rGlow += (rTarget - _rGlow) * 0.25;
    if (_lGlow < 0.01) _lGlow = 0;
    if (_rGlow < 0.01) _rGlow = 0;

    // Arrow sizing — big enough for a toddler to notice and tap
    const arrowW = 28 * s;
    const arrowH = 40 * s;
    const margin = 14 * s;
    const cy = h * 0.52;

    _drawArrowChevron(margin + arrowW / 2, cy, arrowW, arrowH, -1, _lGlow, s);
    _drawArrowChevron(w - margin - arrowW / 2, cy, arrowW, arrowH, 1, _rGlow, s);
  }

  function _drawArrowChevron(cx, cy, aw, ah, dir, glow, s) {
    // dir: -1 = left, +1 = right
    // Chevron points: three strokes forming a chunky arrow
    const tipX = cx + dir * aw * 0.4;
    const backX = cx - dir * aw * 0.4;

    // Idle: soft white ghost. Active: bright green-white glow.
    const idleAlpha = 0.12;
    const activeAlpha = 0.85;
    const alpha = idleAlpha + glow * (activeAlpha - idleAlpha);

    // Glow halo when active
    if (glow > 0.05) {
      const blurPx = Math.round(12 * s);
      ctx.save();
      ctx.filter = `blur(${blurPx}px)`;
      ctx.globalAlpha = glow * 0.45;
      ctx.fillStyle = '#80ffaa';
      ctx.beginPath();
      ctx.arc(cx, cy, aw * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Chevron shape (two thick lines meeting at a point)
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = glow > 0.3 ? '#ffffff' : 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(3, 5 * s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(backX, cy - ah * 0.4);
    ctx.lineTo(tipX, cy);
    ctx.lineTo(backX, cy + ah * 0.4);
    ctx.stroke();

    // Fill a subtle solid arrow behind for visibility on any sky color
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = glow > 0.3 ? '#aaffcc' : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(backX, cy - ah * 0.4);
    ctx.lineTo(tipX, cy);
    ctx.lineTo(backX, cy + ah * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // ── Wake spray ────────────────────────────────────────────────────────────
  // Colorful water spray behind the jet ski that fans in the turning direction,
  // reinforcing the visual cause/effect of left/right steering.

  const _wakeDrops = [];

  function _drawWakeSpray(alpha) {
    const w = width, h = height;
    const s = w / 320;
    const interpVx = _prevVx + alpha * (vx - _prevVx);

    // Spawn spray drops when moving and in PLAY or READY mode
    if (gameMode !== BOOM_MODE && Math.abs(interpVx) > 0.05) {
      const sprayDir = interpVx > 0 ? 1 : -1;
      const intensity = Math.abs(interpVx) / 0.6; // 0..1

      // Spawn 1-2 drops per render frame based on speed
      const count = intensity > 0.5 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const shipBottomY = h - 10 * h / 200;
        _wakeDrops.push({
          x: centerX + (Math.random() * 6 - 3) * s,
          y: shipBottomY + Math.random() * 4 * s,
          // Spray fans outward in the direction of the turn
          dx: sprayDir * (1.5 + Math.random() * 2.5) * s * intensity,
          dy: -(0.5 + Math.random() * 1.5) * s,
          r: 1.5 + Math.random() * 2,
          life: 12 + (Math.random() * 8) | 0,
          maxLife: 20,
          // Alternate between white foam and blue-tinted water
          color: Math.random() > 0.4
            ? `rgba(200, 240, 255, 0.8)`
            : `rgba(255, 255, 255, 0.9)`
        });
      }
    }

    // Update and draw existing drops
    for (let i = _wakeDrops.length - 1; i >= 0; i--) {
      const d = _wakeDrops[i];
      d.x += d.dx;
      d.y += d.dy;
      d.dy += 0.08 * s; // gravity
      d.dx *= 0.97; // drag
      d.life--;

      if (d.life <= 0) {
        _wakeDrops.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = Math.min(1, d.life / 10) * 0.7;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Cap pool size to prevent runaway
    if (_wakeDrops.length > 80) _wakeDrops.splice(0, _wakeDrops.length - 80);
  }

  // ── Ship rendering ────────────────────────────────────────────────────────

  function _drawShip(alpha) {
    const w = width, h = height;
    const interpCounter = _prevShipCounter + alpha * (shipCounter - _prevShipCounter);
    const bobNorm = Math.sin(interpCounter * Math.PI / 6);
    const bobAmp = 2 * h / 200;
    let shipY = (24 * h / 200) - bobNorm * bobAmp;

    const interpScore = _prevLogicScore + alpha * (score - _prevLogicScore);
    if (gameMode === PLAY_MODE && interpScore < 200) {
      shipY = (12 + interpScore / 20) * h / 200;
    }

    const interpVx = _prevVx + alpha * (vx - _prevVx);

    // Shadow
    const shadowY = h - (7 * h / 200);
    const shadowX = centerX - interpVx * 20 * w / 320;
    const heightFactor = 1 - bobNorm * 0.12;
    const blurPx = Math.round(5 * w / 320);
    ctx.save();
    ctx.filter = `blur(${blurPx}px)`;
    ctx.globalAlpha = 0.32 * Math.max(0.7, heightFactor);
    ctx.fillStyle = 'rgb(0, 20, 60)';
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, mywidth2 * 1.0 * heightFactor, 3.5 * h / 200 * heightFactor, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const img = (shipCounter % 4 > 1) ? myImg2 : myImg;
    const spriteW = mywidth2 * 2;
    const spriteH = (mywidth2 * 16 / 52) | 0;

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, centerX - mywidth2, h - shipY, spriteW, spriteH);
    }
  }

  function _drawBomb(alpha) {
    const w = width, h = height;
    const interpDamaged = _prevDamaged + alpha * (damaged - _prevDamaged);
    const candyIdx = (damaged | 0) % CANDY_COLORS.length;
    const candy = CANDY_COLORS[candyIdx];
    ctx.fillStyle = `rgb(${candy.r},${candy.g},${candy.b})`;

    const rx = interpDamaged * 8 * w / 320;
    const ry = interpDamaged * 4 * h / 200;
    const cy = 186 * h / 200;

    ctx.beginPath();
    ctx.ellipse(centerX, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── BOOM MODE ─────────────────────────────────────────────────────────────

  function _renderBoom() {
    const w = width, h = height;
    const f = boomFrame;

    if (f < 16) {
      ctx.fillStyle = f < 2 ? '#ffffff' : `rgb(${RAINBOW[f % RAINBOW.length].r},${RAINBOW[f % RAINBOW.length].g},${RAINBOW[f % RAINBOW.length].b})`;
      ctx.fillRect(0, 0, w, h);
      ground.color = rounds[round].getGroundColor();
      ground.draw(env);

      const scale = f * 3 * w / 320;
      const candy = CANDY_COLORS[f % CANDY_COLORS.length];
      ctx.fillStyle = `rgb(${candy.r},${candy.g},${candy.b})`;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 40 * h / 200, scale * 2, scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (f >= 16 && f <= 35) {
      ctx.fillStyle = '#111122';
      ctx.fillRect(0, 0, w, h);

      if (f === 16 || f === 19 || f === 22 || f === 25 || f === 28 || f === 31) {
        _spawnFirework();
        playFireworkPop();
      }

      for (const fw of fireworks) {
        fw.age++;
        for (const p of fw.particles) {
          p.x += p.dx;
          p.y += p.dy;
          p.dy += 0.05 * h / 200;
          ctx.globalAlpha = Math.max(0, 1 - fw.age / 20);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5 * w / 320, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      fireworks = fireworks.filter(fw => fw.age < 20);
    }

    if (f >= 36 && f <= 70) {
      ctx.fillStyle = '#111122';
      ctx.fillRect(0, 0, w, h);

      const t = Math.min((f - 36) / 5, 1);
      const size = t * 50 * w / 320;

      for (const fw of fireworks) {
        fw.age++;
        for (const p of fw.particles) {
          p.x += p.dx;
          p.y += p.dy;
          p.dy += 0.05 * h / 200;
          ctx.globalAlpha = Math.max(0, 1 - fw.age / 20);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2 * w / 320, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      fireworks = fireworks.filter(fw => fw.age < 20);

      const cx = centerX;
      const cy = centerY - 10 * h / 200;
      const s = w / 320;

      // Smiley face
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(cx, cy, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#CC8800';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(cx, cy, size, 0, Math.PI * 2);
      ctx.stroke();

      if (t >= 1) {
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(cx - 18 * s, cy - 12 * s, 5 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 18 * s, cy - 12 * s, 5 * s, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.arc(cx, cy + 2 * s, 28 * s, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 100, 100, 0.4)';
        ctx.beginPath();
        ctx.arc(cx - 30 * s, cy + 8 * s, 8 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 30 * s, cy + 8 * s, 8 * s, 0, Math.PI * 2);
        ctx.fill();
      }

      if (f >= 50) _drawTapPrompt(f);
    }
  }

  function _spawnFirework() {
    const w = width, h = height;
    const x = 30 * w / 320 + Math.random() * (w - 60 * w / 320);
    const y = 20 * h / 200 + Math.random() * (h * 0.6);
    const count = 8 + (Math.random() * 4) | 0;
    const hue = (Math.random() * 360) | 0;
    const pts = [];
    const speedScale = w / 320;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = (2 + Math.random() * 2) * speedScale;
      const r = (128 + 127 * Math.sin(hue * 0.017)) | 0;
      const g = (128 + 127 * Math.sin(hue * 0.017 + 2.094)) | 0;
      const b = (128 + 127 * Math.sin(hue * 0.017 + 4.189)) | 0;
      pts.push({
        x, y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        color: `rgb(${r},${g},${b})`
      });
    }
    fireworks.push({ particles: pts, age: 0 });
  }

  // ── READY MODE ────────────────────────────────────────────────────────────

  function _renderReady() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, width, height);
    _drawTapPrompt(readyFrame);
  }

  // WinnieOS tweak: show a friendly tap target instead of a spacebar icon,
  // since the primary interaction on the kiosk device is touch.
  function _drawTapPrompt(frame) {
    const w = width, h = height;
    const s = w / 320;
    const cx = centerX;
    const bounce = Math.sin(frame * 0.15) * 8 * s;
    const cy = centerY + 50 * h / 200 + bounce;
    const pulse = 0.6 + 0.4 * Math.sin(frame * 0.1);

    // Glow
    ctx.fillStyle = `rgba(100, 255, 100, ${pulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 35 * s, 0, Math.PI * 2);
    ctx.fill();

    // Rounded button
    const bw = 56 * s, bh = 20 * s;
    const bx = cx - bw / 2, by = cy - bh / 2;
    const radius = 6 * s;
    ctx.fillStyle = `rgba(80, 220, 80, ${0.7 + pulse * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(bx + radius, by);
    ctx.lineTo(bx + bw - radius, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
    ctx.lineTo(bx + bw, by + bh - radius);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh);
    ctx.lineTo(bx + radius, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius);
    ctx.lineTo(bx, by + radius);
    ctx.quadraticCurveTo(bx, by, bx + radius, by);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * s;
    ctx.stroke();

    // Play triangle icon (more universal than a spacebar for a kiosk)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx - 4 * s, cy - 6 * s);
    ctx.lineTo(cx - 4 * s, cy + 6 * s);
    ctx.lineTo(cx + 7 * s, cy);
    ctx.closePath();
    ctx.fill();
  }

  // ── Stars ─────────────────────────────────────────────────────────────────

  function _renderStars(alpha) {
    if (starCount === 0 && gameMode === READY_MODE) return;

    const w = width;
    const s = w / 320;
    const y = 14 * s;
    const spacing = 22 * s;
    const rightEdge = w - 12 * s;

    if (starCount <= 5) {
      // Show individual stars (up to 5)
      for (let i = 0; i < starCount; i++) {
        const isNew = (i === starCount - 1 && starFlash > 0);
        const scale = isNew ? 1.0 + 0.4 * Math.sin(starFlash * 0.5) : 1.0;
        const color = isNew ? '#FFFFFF' : '#FFD700';
        _drawStar(rightEdge - (starCount - 1 - i) * spacing, y, 8 * s * scale, color);
      }
    } else {
      // Super star: one big pulsing rainbow star + counter
      const pulse = 1.0 + 0.15 * Math.sin(_skyFrame * 0.08);
      const isNew = starFlash > 0;
      const scale = isNew ? pulse + 0.4 * Math.sin(starFlash * 0.5) : pulse;

      // Rainbow color cycling for super star
      const hue = (_skyFrame * 2) % 360;
      const sr = Math.round(200 + 55 * Math.sin(hue * 0.0174));
      const sg = Math.round(200 + 55 * Math.sin(hue * 0.0174 + 2.1));
      const sb = Math.round(200 + 55 * Math.sin(hue * 0.0174 + 4.2));

      // Glow behind super star
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(_skyFrame * 0.06);
      const glowR = 16 * s;
      const grad = ctx.createRadialGradient(rightEdge, y, 2 * s, rightEdge, y, glowR);
      grad.addColorStop(0, `rgba(${sr},${sg},${sb},0.6)`);
      grad.addColorStop(1, `rgba(${sr},${sg},${sb},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(rightEdge, y, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      _drawStar(rightEdge, y, 11 * s * scale, `rgb(${sr},${sg},${sb})`);

      // Counter to the left of the star
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(11 * s)}px monospace`;
      ctx.textAlign = 'right';
      ctx.globalAlpha = 0.9;
      ctx.fillText('x' + starCount, rightEdge - 16 * s, y + 4 * s);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'start';
    }

    if (starFlash > 0) starFlash--;
  }

  function _drawStar(cx, cy, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const outerX = cx + Math.cos(angle) * radius;
      const outerY = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(outerX, outerY);
      else ctx.lineTo(outerX, outerY);
      const innerAngle = angle + Math.PI / 5;
      const innerR = radius * 0.4;
      ctx.lineTo(cx + Math.cos(innerAngle) * innerR, cy + Math.sin(innerAngle) * innerR);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ── Particles ─────────────────────────────────────────────────────────────

  function _updateAndDrawParticles() {
    const s = width / 320;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.dx;
      p.y += p.dy;
      p.dy += 0.1 * s;
      p.life--;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = Math.min(1, p.life / 25);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function _spawnHitParticles() {
    const w = width, h = height;
    const cx = centerX;
    const cy = 186 * h / 200;
    const s = w / 320;

    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (1.5 + Math.random() * 3) * s;
      const pc = CANDY_COLORS[(Math.random() * CANDY_COLORS.length) | 0];
      particles.push({
        x: cx, y: cy,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed - 1 * s,
        r: 2 + Math.random() * 3,
        color: `rgb(${pc.r},${pc.g},${pc.b})`,
        life: 15 + (Math.random() * 10) | 0
      });
    }
  }

  // ── Logic tick (~18fps) ───────────────────────────────────────────────────

  let scFlag = true;

  function tick() {
    if (disposed) return;
    const tickStart = performance.now();

    if (gameMode === BOOM_MODE) {
      _savePrevState();
      lastTickTime = performance.now();
      boomFrame++;

      if (boomFrame >= 70) {
        gameMode = READY_MODE;
        readyFrame = 0;
        autoRestartTimer = 0;
        obstacles.removeAll();
        vx = 0;
      }
    } else if (gameMode === READY_MODE) {
      _savePrevState();
      lastTickTime = performance.now();
      keyOperate();
      readyFrame++;
      autoRestartTimer++;
      shipCounter++;

      if (autoRestartTimer > 270) startGame();
    } else if (gameMode === PLAY_MODE) {
      _savePrevState();
      lastTickTime = performance.now();

      if (rounds[round].isNextRound(score)) {
        if (round < rounds.length - 1) round++;
      }

      keyOperate();

      const damageBeforeMove = damaged;
      moveObstacle();

      if (damageBeforeMove === 0 && damaged > 0) {
        damaged = 1;
        playBombSound();
        _spawnHitParticles();
      } else if (damaged > 0) {
        if (damaged > 30) {
          gameMode = BOOM_MODE;
          boomFrame = 0;
          fireworks = [];
          playBoomSound();
        } else {
          damaged++;
          if (damaged % 3 === 0) _spawnHitParticles();
        }
      }

      score += 20;
      if (scFlag) {
        if (score - lastStarScore >= 10000) {
          starCount++;
          lastStarScore = score - (score % 10000);
          starFlash = 18;
          playStarSound();
        }
      }
      scFlag = !scFlag;
      shipCounter++;
    }

    const elapsed = performance.now() - tickStart;
    _timerId = setTimeout(tick, Math.max(0, TICK_MS - elapsed));
  }

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    start() {
      bindInput();
      canvas.setAttribute('tabindex', '0');
      canvas.focus();

      loadImages().then(() => {
        if (disposed) return;

        syncSize();
        obstacles.removeAll();
        for (let i = 0; i < rounds.length; i++) rounds[i].init();
        damaged = 0;
        round = 0;
        score = 0;
        starCount = 0;
        lastStarScore = 0;
        vx = 0;
        gameMode = READY_MODE;
        readyFrame = 0;
        autoRestartTimer = 0;

        lastTickTime = performance.now();
        _rafId = requestAnimationFrame(_rafLoop);
        _timerId = setTimeout(tick, TICK_MS);
      });
    },

    dispose() {
      disposed = true;
      if (_timerId !== null) { clearTimeout(_timerId); _timerId = null; }
      if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null; }
      for (const fn of cleanupFns) fn();
      cleanupFns.length = 0;
      if (audioCtx) {
        try { audioCtx.close(); } catch (_) {}
        audioCtx = null;
      }
    }
  };
}
