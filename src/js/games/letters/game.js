/**
 * Letters Game (scaffolding v1)
 *
 * - Keyboard-first: only correct key drops the letter.
 * - Touch is "flavor": playful taps that do not solve the challenge.
 * - Full-bleed inside the 1280x800 reference canvas coordinate system.
 * - Strict teardown: nothing runs after dispose().
 */

import MatterImport from 'matter-js';
import { Viewport } from '../../core/viewport.js';
import { Audio } from '../../utils/audio.js';
import { Storage } from '../../utils/storage.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function clamp01(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
}

function pickRandomLetter() {
    const i = Math.floor(Math.random() * LETTERS.length);
    return LETTERS[i] || 'A';
}

function randRange(min, max) {
    return min + Math.random() * (max - min);
}

function getHudRefRect(hudEl, canvas) {
    if (!hudEl || !canvas) return null;
    try {
        const scale = Viewport && typeof Viewport.getScale === 'function'
            ? (Viewport.getScale() || 1)
            : 1;
        const hudRect = hudEl.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const x = (hudRect.left - canvasRect.left) / (scale || 1);
        const y = (hudRect.top - canvasRect.top) / (scale || 1);
        const w = hudRect.width / (scale || 1);
        const h = hudRect.height / (scale || 1);
        if (![x, y, w, h].every(Number.isFinite)) return null;
        return { x, y, w, h };
    } catch (_) {
        return null;
    }
}

function pointInRect(p, r) {
    if (!p || !r) return false;
    return p.x >= r.x && p.y >= r.y && p.x <= (r.x + r.w) && p.y <= (r.y + r.h);
}

function isCanvasEl(el) {
    return !!el && el.tagName && String(el.tagName).toUpperCase() === 'CANVAS';
}

function renderHudGlyphCanvas(canvasEl, letter) {
    if (!canvasEl || !isCanvasEl(canvasEl)) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const rect = canvasEl.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width || 180));
    const cssH = Math.max(1, Math.floor(rect.height || 180));
    const dpr = window.devicePixelRatio || 1;
    const pxW = Math.max(1, Math.floor(cssW * dpr));
    const pxH = Math.max(1, Math.floor(cssH * dpr));

    if (canvasEl.width !== pxW) canvasEl.width = pxW;
    if (canvasEl.height !== pxH) canvasEl.height = pxH;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pxW, pxH);

    // Derive font size relative to box so it stays consistent with HUD size.
    // Historically: 120px glyph inside 180px box => 0.666.. ratio.
    const fontPx = Math.round(Math.min(pxW, pxH) * 0.67);
    ctx.font = `900 ${fontPx}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';

    const s = String(letter || 'A').toUpperCase().slice(0, 1);
    const m = ctx.measureText(s);

    // Center based on bounding box (more accurate than centering the advance width).
    const hasBBox =
        Number.isFinite(m.actualBoundingBoxAscent) &&
        Number.isFinite(m.actualBoundingBoxDescent) &&
        Number.isFinite(m.actualBoundingBoxLeft) &&
        Number.isFinite(m.actualBoundingBoxRight);

    const ascent = hasBBox ? m.actualBoundingBoxAscent : fontPx * 0.78;
    const descent = hasBBox ? m.actualBoundingBoxDescent : fontPx * 0.22;

    // Baseline Y so bbox center lands at mid-height:
    // centerY = baselineY - ascent/2 + descent/2  => baselineY = centerY + (ascent - descent)/2
    const centerY = pxH / 2;
    const baselineY = centerY + (ascent - descent) / 2;

    let x = pxW / 2;
    if (hasBBox) {
        // Nudge X so bbox center is centered
        x = (pxW / 2) + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
    }

    // Stroke outline for clarity (requested)
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = Math.max(2, Math.round(fontPx * 0.10));
    ctx.strokeStyle = 'rgba(0,0,0,0.62)';

    // Fill is bright and friendly (works over glass background)
    ctx.fillStyle = 'rgba(255,255,255,0.98)';

    // Subtle shadow to separate from busy backgrounds, but keep it gentle.
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = Math.round(fontPx * 0.06);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.round(fontPx * 0.02);

    ctx.strokeText(s, x, baselineY);
    ctx.fillText(s, x, baselineY);
}

function getReferenceSizeFallback() {
    const ref = Viewport && typeof Viewport.getReferenceSize === 'function'
        ? Viewport.getReferenceSize()
        : { width: 1280, height: 800 };
    const w = ref && Number.isFinite(ref.width) ? ref.width : 1280;
    const h = ref && Number.isFinite(ref.height) ? ref.height : 800;
    return { width: w, height: h };
}

function addClassForMs(el, className, ms) {
    if (!el) return null;
    el.classList.add(className);
    const id = setTimeout(() => {
        try { el.classList.remove(className); } catch (_) { /* ignore */ }
    }, ms);
    return id;
}

export function createLettersGame(opts) {
    const canvas = opts && opts.canvas;
    const hudEl = opts && opts.hudEl;
    const glyphEl = opts && opts.glyphEl;
    const config = (opts && opts.config && typeof opts.config === 'object') ? opts.config : {};

    if (!canvas) {
        return { start: function() {}, dispose: function() {} };
    }

    // Matter.js is published as CJS; depending on bundler interop, it may appear as a default export
    // or a namespace-like object. Normalize it so we don't depend on one specific shape.
    const Matter = (MatterImport && MatterImport.Engine)
        ? MatterImport
        : (MatterImport && MatterImport.default && MatterImport.default.Engine ? MatterImport.default : MatterImport);

    const { Engine, World, Bodies, Body, Events } = Matter;

    let disposed = false;
    let raf = null;
    let engine = null;
    let world = null;
    let ctx2d = null;
    let cleanupFns = [];
    let timers = new Set();
    let hudRectRef = null;
    let stopDrumroll = null;
    let pegMeta = null; // constraints + style helpers for peg rendering and nudging

    // Game state machine
    // - idleAwaitingKey: waiting for correct key
    // - dropping: letter is falling
    // - inBin: letter entered a bin; let it bounce/settle before confirming catch
    // - rewarding: catch confirmed; play reward and hold
    // - introducing: reveal next letter
    let phase = 'introducing';
    let targetLetter = pickRandomLetter();
    let nextLetter = pickRandomLetter();
    let falling = null; // { body, letter }
    let lastTs = 0;
    let accumulatorMs = 0;

    // Visual reward pulses for bins (binId -> { start, end })
    const binPulse = new Map();

    // Persistent score (per bin): count 0..9 + stars (groups of 10)
    const SCORE_KEY = 'letters.score.v1';
    const binScoreAnim = new Map(); // binId -> { start, end }
    const binStarAnim = new Map();  // binId -> { start, end }
    let scoreByBin = null;

    // Stuck detection for the falling letter
    let dropStartMs = 0;
    let lastMotionMs = 0;
    let stuckStartMs = 0;
    let stuckPulsing = false;

    // Bin catch confirmation (let it bounce/settle first)
    let binCandidate = null; // { binId, enterMs, stillStartMs, impactStrength }

    // Layout "safe areas" in reference pixels
    const SAFE_TOP_LEFT = { x: 0, y: 0, w: 190, h: 190 }; // avoid fighting the Home button

    // Config knobs (safe defaults)
    const gravityY = Number.isFinite(config.gravityY) ? config.gravityY : 1.15;
    // Pacing: slow, friendly machine.
    const settleBeatMs = Number.isFinite(config.settleBeatMs) ? config.settleBeatMs : 1100;
    const introBeatMs = Number.isFinite(config.introBeatMs) ? config.introBeatMs : 650;
    const postLaunchLockMs = Number.isFinite(config.postLaunchLockMs) ? config.postLaunchLockMs : 200;
    // Score beat: moment where the bin count increments (after the letter despawns)
    const scoreBeatMs = Number.isFinite(config.scoreBeatMs) ? config.scoreBeatMs : 650;
    // Catch pacing
    const catchLingerMinMs = Number.isFinite(config.catchLingerMinMs) ? config.catchLingerMinMs : 1200;
    const catchStillMs = Number.isFinite(config.catchStillMs) ? config.catchStillMs : 520;
    const catchPostConfirmHoldMs = Number.isFinite(config.catchPostConfirmHoldMs) ? config.catchPostConfirmHoldMs : 1100;
    // Next-letter anticipation:
    // - a few extra seconds of pause
    // - then a distinct "get ready" cue
    // - then a random suspense window (1–3 seconds) before reveal
    const nextReadyBaseMs = Number.isFinite(config.nextReadyBaseMs) ? config.nextReadyBaseMs : 1800;
    const nextReadyRandomMinMs = Number.isFinite(config.nextReadyRandomMinMs) ? config.nextReadyRandomMinMs : 1000;
    const nextReadyRandomMaxMs = Number.isFinite(config.nextReadyRandomMaxMs) ? config.nextReadyRandomMaxMs : 3000;
    // Stuck detection (forgiving)
    const stuckMinDropMs = Number.isFinite(config.stuckMinDropMs) ? config.stuckMinDropMs : 2200;
    const stuckNoMotionMs = Number.isFinite(config.stuckNoMotionMs) ? config.stuckNoMotionMs : 2600;
    const stuckPulseMs = Number.isFinite(config.stuckPulseMs) ? config.stuckPulseMs : 2200;
    const stuckSpeedEps = Number.isFinite(config.stuckSpeedEps) ? config.stuckSpeedEps : 0.22;
    const catchStillSpeedEps = Number.isFinite(config.catchStillSpeedEps) ? config.catchStillSpeedEps : 0.32;

    const binColors = [
        { id: 'red', hex: '#E11D48' },
        { id: 'orange', hex: '#F97316' },
        { id: 'yellow', hex: '#F59E0B' },
        { id: 'green', hex: '#16A34A' },
        { id: 'blue', hex: '#2563EB' },
        { id: 'purple', hex: '#7C3AED' }
    ];

    function normalizeScore(raw) {
        const out = {};
        const src = raw && typeof raw === 'object' ? raw : {};
        for (const c of binColors) {
            const k = c.id;
            const v = src[k] && typeof src[k] === 'object' ? src[k] : {};
            const count = Number.isFinite(v.count) ? Math.floor(v.count) : 0;
            const stars = Number.isFinite(v.stars) ? Math.floor(v.stars) : 0;
            out[k] = {
                count: Math.max(0, Math.min(9, count)),
                stars: Math.max(0, stars)
            };
        }
        return out;
    }

    function loadScore() {
        try {
            const raw = Storage.get(SCORE_KEY, null);
            return normalizeScore(raw);
        } catch (_) {
            return normalizeScore(null);
        }
    }

    function saveScore() {
        try { Storage.set(SCORE_KEY, scoreByBin); } catch (_) { /* ignore */ }
    }

    function bumpBinScore(binId) {
        const id = String(binId || '');
        if (!scoreByBin) scoreByBin = loadScore();
        if (!scoreByBin[id]) scoreByBin[id] = { count: 0, stars: 0 };

        const tNow = (performance.now ? performance.now() : Date.now());
        const entry = scoreByBin[id];
        entry.count = Math.max(0, Math.min(9, Math.floor(entry.count || 0))) + 1;

        let starEarned = false;
        if (entry.count >= 10) {
            entry.count = 0;
            entry.stars = Math.max(0, Math.floor(entry.stars || 0)) + 1;
            starEarned = true;
        }

        // Persist immediately so a crash/exit still keeps progress.
        saveScore();

        // Visual + audio beat
        binScoreAnim.set(id, { start: tNow, end: tNow + 520 });
        Audio.scoreTick(0.72);

        if (starEarned) {
            binStarAnim.set(id, { start: tNow, end: tNow + 1100 });
            // Slightly delayed "big" moment reads better than stacking at the exact same time.
            setTimeoutTracked(() => {
                if (disposed) return;
                Audio.star(0.95);
            }, 120);
        }
    }

    function setPhase(next) {
        phase = next;
    }

    function setTargetLetter(letter) {
        targetLetter = String(letter || 'A').toUpperCase().slice(0, 1);
        if (glyphEl) {
            if (isCanvasEl(glyphEl)) {
                renderHudGlyphCanvas(glyphEl, targetLetter);
            } else {
                glyphEl.textContent = targetLetter;
            }
        }
    }

    function setHudEmpty(isEmpty) {
        if (!hudEl) return;
        if (isEmpty) hudEl.classList.add('wos-letters-hud--empty');
        else hudEl.classList.remove('wos-letters-hud--empty');
    }

    function clearTimers() {
        for (const id of Array.from(timers)) {
            try { clearTimeout(id); } catch (_) { /* ignore */ }
        }
        timers.clear();
    }

    function setTimeoutTracked(fn, ms) {
        const id = setTimeout(() => {
            timers.delete(id);
            try { fn(); } catch (_) { /* ignore */ }
        }, ms);
        timers.add(id);
        return id;
    }

    function normalizeKey(e) {
        const k = e && e.key ? String(e.key) : '';
        if (!k) return '';
        if (k.length === 1) return k.toUpperCase();
        return '';
    }

    function ensureCanvasSized() {
        const ref = getReferenceSizeFallback();
        const w = Math.max(1, Math.floor(ref.width));
        const h = Math.max(1, Math.floor(ref.height));
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        return { w, h };
    }

    function getCanvasRefPointFromClient(clientX, clientY) {
        const scale = Viewport && typeof Viewport.getScale === 'function'
            ? (Viewport.getScale() || 1)
            : 1;
        const rect = canvas.getBoundingClientRect();
        const x = (clientX - rect.left) / (scale || 1);
        const y = (clientY - rect.top) / (scale || 1);
        return { x, y };
    }

    function isInSafeTopLeft(p) {
        return p.x >= SAFE_TOP_LEFT.x &&
            p.y >= SAFE_TOP_LEFT.y &&
            p.x <= SAFE_TOP_LEFT.x + SAFE_TOP_LEFT.w &&
            p.y <= SAFE_TOP_LEFT.y + SAFE_TOP_LEFT.h;
    }

    function initWorld() {
        engine = Engine.create({ enableSleeping: true });
        world = engine.world;
        world.gravity.y = gravityY;

        const ref = getReferenceSizeFallback();
        const W = ref.width;
        const H = ref.height;
        hudRectRef = getHudRefRect(hudEl, canvas);

        // Boundaries (keep everything on-screen)
        const thickness = 60;
        const floor = Bodies.rectangle(W / 2, H + thickness / 2, W + thickness * 2, thickness, { isStatic: true });
        const leftWall = Bodies.rectangle(-thickness / 2, H / 2, thickness, H + thickness * 2, { isStatic: true });
        const rightWall = Bodies.rectangle(W + thickness / 2, H / 2, thickness, H + thickness * 2, { isStatic: true });
        const ceiling = Bodies.rectangle(W / 2, -thickness / 2, W + thickness * 2, thickness, { isStatic: true });
        World.add(world, [floor, leftWall, rightWall, ceiling]);

        // Pegs: a simple staggered grid.
        // IMPORTANT: keep this field sparse enough that the letter won't get "jammed",
        // and never place pegs into the bin/container region at the bottom.
        //
        // "Beautiful board" generator:
        // - Start from a triangular lattice (pleasant/regular)
        // - Gently warp it with low-frequency sin/noise (organic)
        // - Apply a density mask and enforce minimum distances (playable / blue-noise-ish)
        // - Add soft bilateral symmetry (reads "designed" but still different each visit)
        const pegRadius = 12;
        const binTop = H - 180;            // keep in sync with the drawing/layout below
        const pegTop = 110;
        const pegBottom = binTop - 62;     // keep some air above bins
        const xPad = 140;                  // margins keep edge exits clear

        // No-peg "launch corridor" immediately to the LEFT of the HUD box.
        // This ensures the letter can't be blocked right as it pops out.
        const launchNoPegRect = (() => {
            if (!hudRectRef) return null;
            // Keep this corridor modest: we only need to protect the immediate "pop out" path.
            const corridorW = 140;
            const padY = 18;
            return {
                x: Math.max(0, hudRectRef.x - corridorW),
                y: Math.max(0, hudRectRef.y - padY),
                w: Math.min(W, corridorW + 8),
                h: Math.min(H, hudRectRef.h + padY * 2)
            };
        })();

        // Deterministic RNG for this mount (so generator decisions are stable within a run).
        const seed = Math.floor(Math.random() * 1e9);
        function mulberry32(a) {
            return function() {
                a |= 0; a = a + 0x6D2B79F5 | 0;
                let t = Math.imul(a ^ a >>> 15, 1 | a);
                t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
        }
        const rng = mulberry32(seed);

        function hashNoise(x, y) {
            // Fast-ish deterministic noise in 0..1 (not high quality, but good for gentle masking).
            const s = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.000001) * 43758.5453123;
            return s - Math.floor(s);
        }

        function inNoGoZones(px, py) {
            if (hudRectRef) {
                const p = { x: px, y: py };
                if (pointInRect(p, hudRectRef)) return true;
                if (launchNoPegRect && pointInRect(p, launchNoPegRect)) return true;
            } else {
                // Fallback heuristic if HUD rect can't be computed.
                if (px > W - 240 && py < 240) return true;
            }
            return false;
        }

        function generatePegPoints({ thresholdBase }) {
            const points = [];

            // Triangular lattice spacing (pleasant + efficient coverage)
            const sx = 118;
            const sy = 102;

            // Warp fields (low-frequency, gentle)
            const warpAmp = 18;
            const fx1 = 0.010 + rng() * 0.004;
            const fy1 = 0.010 + rng() * 0.004;
            const fx2 = 0.006 + rng() * 0.003;
            const fy2 = 0.006 + rng() * 0.003;
            const p1 = rng() * Math.PI * 2;
            const p2 = rng() * Math.PI * 2;
            const p3 = rng() * Math.PI * 2;
            const p4 = rng() * Math.PI * 2;

            // Minimum distance enforcement via spatial hash.
            const minDist = pegRadius * 3.15;
            const cell = minDist;
            const grid = new Map(); // "gx,gy" -> [idx...]
            const minDist2 = minDist * minDist;
            function cellKey(gx, gy) { return `${gx},${gy}`; }
            function canPlace(px, py) {
                const gx = Math.floor(px / cell);
                const gy = Math.floor(py / cell);
                for (let yy = gy - 1; yy <= gy + 1; yy++) {
                    for (let xx = gx - 1; xx <= gx + 1; xx++) {
                        const list = grid.get(cellKey(xx, yy));
                        if (!list) continue;
                        for (const idx of list) {
                            const q = points[idx];
                            const dx = q.x - px;
                            const dy = q.y - py;
                            if ((dx * dx + dy * dy) < minDist2) return false;
                        }
                    }
                }
                return true;
            }
            function addPoint(px, py) {
                const gx = Math.floor(px / cell);
                const gy = Math.floor(py / cell);
                const key = cellKey(gx, gy);
                const idx = points.length;
                points.push({ x: px, y: py });
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key).push(idx);
            }

            // Create left-side points first, then mirror a majority for pleasing symmetry.
            const midX = W / 2;
            const xMaxLeft = midX - 6;

            const rows = Math.max(3, Math.floor((pegBottom - pegTop) / sy) + 2);
            const colsLeft = Math.max(3, Math.floor((xMaxLeft - xPad) / sx) + 2);

            for (let r = 0; r < rows; r++) {
                const baseY = pegTop + r * sy;
                if (baseY < pegTop - 10 || baseY > pegBottom + 10) continue;
                const rowOffset = (r % 2) * (sx / 2);

                for (let c = 0; c < colsLeft; c++) {
                    const baseX = xPad + c * sx + rowOffset;
                    if (baseX < xPad || baseX > xMaxLeft) continue;

                    // Density mask: gentle variation across Y, plus a touch of "breathing" in X.
                    const ny = (baseY - pegTop) / Math.max(1, (pegBottom - pegTop));
                    const densityWave = 0.12 * Math.sin((ny * 2.0 * Math.PI) + p1);
                    const centerBias = 0.06 * Math.cos(((baseX / W) * 2.0 * Math.PI) + p2);
                    const n = hashNoise(baseX * 0.018, baseY * 0.018);
                    const keep = n > (thresholdBase + densityWave + centerBias);
                    if (!keep) continue;

                    // Warp + small jitter for organic look (without tight pinch points)
                    const wx = warpAmp * (
                        0.65 * Math.sin(baseY * fy1 + p3) +
                        0.35 * Math.sin(baseX * fx2 + p4)
                    );
                    const wy = warpAmp * (
                        0.55 * Math.sin(baseX * fx1 + p2) +
                        0.25 * Math.sin(baseY * fy2 + p1)
                    );
                    const jx = (rng() * 2 - 1) * 8;
                    const jy = (rng() * 2 - 1) * 8;

                    const px = baseX + wx + jx;
                    const py = baseY + wy + jy;

                    if (px < xPad || px > W - xPad) continue;
                    if (py < pegTop || py > pegBottom) continue;
                    if (inNoGoZones(px, py)) continue;
                    if (!canPlace(px, py)) continue;

                    addPoint(px, py);

                    // Mirror most pegs for beauty, but allow some asymmetry.
                    if (rng() < 0.86) {
                        const mx = (midX + (midX - px));
                        const my = py + (rng() * 2 - 1) * 3;
                        if (mx > xPad && mx < (W - xPad) && my >= pegTop && my <= pegBottom) {
                            if (!inNoGoZones(mx, my) && canPlace(mx, my)) {
                                addPoint(mx, my);
                            }
                        }
                    }
                }
            }

            return points;
        }

        // Try a few thresholds until we hit a nice target count (playable + lively).
        const targetMin = 56;
        const targetMax = 86;
        let pegPoints = [];
        let threshold = 0.28; // higher => fewer pegs
        for (let attempt = 0; attempt < 5; attempt++) {
            pegPoints = generatePegPoints({ thresholdBase: threshold });
            if (pegPoints.length < targetMin) {
                threshold -= 0.03;
            } else if (pegPoints.length > targetMax) {
                threshold += 0.03;
            } else {
                break;
            }
            threshold = Math.max(0.12, Math.min(0.46, threshold));
        }

        // Save constraints for later (touch nudging + rendering bounds).
        // Also constrain how far a peg can drift from its home position after nudges.
        pegMeta = {
            W,
            H,
            pegRadius,
            pegTop,
            pegBottom,
            xPad,
            maxDrift: 46,
            minDist: pegRadius * 3.15,
            inNoGoZones
        };

        const pegs = [];
        for (const p of pegPoints) {
            const body = Bodies.circle(p.x, p.y, pegRadius, {
                isStatic: true,
                restitution: 0.95,
                friction: 0.02
            });
            body.label = 'peg';
            // Visual style variation (no color): subtle differences in brightness and "hardware" feel.
            body.plugin = body.plugin || {};
            body.plugin.kind = 'peg';
            body.plugin.home = { x: p.x, y: p.y };
            body.plugin.style = {
                // Fill alpha and shade stay in grayscale; outline is always black-ish.
                shade: 0.74 + rng() * 0.20,          // 0.74..0.94
                fillAlpha: 0.72 + rng() * 0.18,      // 0.72..0.90
                outlineAlpha: 0.55 + rng() * 0.20,   // 0.55..0.75
                ringAlpha: 0.14 + rng() * 0.16,      // subtle inner ring
                drawRadiusJitter: (rng() * 2 - 1) * 1.8,
                highlightAngle: rng() * Math.PI * 2,
                wiggleUntilMs: 0
            };
            pegs.push(body);
        }
        World.add(world, pegs);

        // Colored bins at bottom
        const binHeight = 160;
        const binCount = binColors.length;
        const binW = W / binCount;
        const wallW = 18;

        const binSensors = [];
        for (let i = 0; i < binCount; i++) {
            const x0 = i * binW;
            const x1 = (i + 1) * binW;
            const mid = (x0 + x1) / 2;

            // Walls
            const left = Bodies.rectangle(x0 + wallW / 2, binTop + binHeight / 2, wallW, binHeight, { isStatic: true, restitution: 0.25 });
            const right = Bodies.rectangle(x1 - wallW / 2, binTop + binHeight / 2, wallW, binHeight, { isStatic: true, restitution: 0.25 });
            left.label = 'binWall';
            right.label = 'binWall';
            left.plugin = { binId: binColors[i].id };
            right.plugin = { binId: binColors[i].id };
            // Floor ledge (visual separation)
            const lip = Bodies.rectangle(mid, binTop + binHeight, binW, 22, { isStatic: true, restitution: 0.15, friction: 0.02 });
            lip.label = 'binLip';
            lip.plugin = { binId: binColors[i].id };

            // Sensor zone (detect "letter landed in bin")
            const sensor = Bodies.rectangle(mid, binTop + binHeight - 20, binW - wallW * 2, 40, {
                isStatic: true,
                isSensor: true
            });
            sensor.label = 'binSensor';
            sensor.plugin = { binId: binColors[i].id };

            World.add(world, [left, right, lip, sensor]);
            binSensors.push(sensor);
        }

        const onCollisionStart = (evt) => {
            if (disposed) return;
            if (!falling || !falling.body) return;
            // Keep bounce sounds alive in the bin too (it keeps feeling physical).
            if (phase !== 'dropping' && phase !== 'inBin' && phase !== 'rewarding') return;

            const pairs = evt && evt.pairs ? evt.pairs : [];
            for (const p of pairs) {
                const a = p.bodyA;
                const b = p.bodyB;
                const letterBody = (a === falling.body) ? a : ((b === falling.body) ? b : null);
                const otherBody = (letterBody === a) ? b : (letterBody === b ? a : null);

                // Dynamic bounce sounds for letter collisions (non-sensor).
                if (letterBody && otherBody && !otherBody.isSensor && !letterBody.isSensor) {
                    try {
                        const va = letterBody.velocity || { x: 0, y: 0 };
                        const vb = otherBody.velocity || { x: 0, y: 0 };
                        const dvx = (va.x || 0) - (vb.x || 0);
                        const dvy = (va.y || 0) - (vb.y || 0);
                        const vRel = Math.sqrt(dvx * dvx + dvy * dvy);
                        // Map relative velocity to 0..1; tuned by feel.
                        const strength = clamp01((vRel - 1.5) / 12.5);
                        if (strength > 0.02) {
                            const isPeg = otherBody.isStatic && otherBody.circleRadius;
                            const isBinSurface =
                                otherBody.label === 'binWall' ||
                                otherBody.label === 'binLip' ||
                                (otherBody.plugin && otherBody.plugin.binId);
                            if (isBinSurface) {
                                Audio.binBounce(strength);
                            } else {
                                const flavor = isPeg ? 'peg' : 'wall';
                                Audio.bounce(strength, flavor);
                            }
                        }
                    } catch (_) { /* ignore */ }
                }

                const sensor = (a && a.label === 'binSensor') ? a : ((b && b.label === 'binSensor') ? b : null);
                const other = sensor === a ? b : (sensor === b ? a : null);
                if (!sensor || !other) continue;
                if (other !== falling.body) continue;

                const binId = sensor.plugin && sensor.plugin.binId ? String(sensor.plugin.binId) : 'unknown';
                onBinEnter(binId, p);
                break;
            }
        };

        Events.on(engine, 'collisionStart', onCollisionStart);
        cleanupFns.push(() => {
            try { Events.off(engine, 'collisionStart', onCollisionStart); } catch (_) { /* ignore */ }
        });
    }

    function spawnFallingLetterFromHud() {
        const ref = getReferenceSizeFallback();
        const W = ref.width;
        const H = ref.height;

        // Best-effort: use HUD box center if available; otherwise a reasonable default.
        let x = W - 120;
        let y = 120;
        try {
            if (hudEl) {
                const scale = Viewport && typeof Viewport.getScale === 'function'
                    ? (Viewport.getScale() || 1)
                    : 1;
                const hudRect = hudEl.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();
                // Spawn just OUTSIDE the HUD box, to the left, so it feels like it "pops out".
                const spawnClientX = hudRect.left - 18;
                const spawnClientY = hudRect.top + hudRect.height * 0.52;
                x = (spawnClientX - canvasRect.left) / (scale || 1);
                y = (spawnClientY - canvasRect.top) / (scale || 1);
            }
        } catch (_) { /* ignore */ }

        // Clamp to screen
        x = Math.max(80, Math.min(W - 80, x));
        y = Math.max(80, Math.min(H - 400, y));

        const radius = 32;
        const body = Bodies.circle(x, y, radius, {
            restitution: 0.68,
            friction: 0.02,
            frictionAir: 0.006,
            density: 0.0025
        });
        body.label = 'letter';
        body.plugin = { letter: targetLetter };
        World.add(world, body);
        falling = { body, letter: targetLetter };

        // Initialize stuck detection timers for this drop
        const tNow = performance.now ? performance.now() : Date.now();
        dropStartMs = tNow;
        lastMotionMs = tNow;
        stuckStartMs = 0;
        stuckPulsing = false;

        // Kick it left with a bit of randomized "pop" energy for variation.
        // Matter.js velocities are in px per simulation step (~60Hz).
        // Keep it playful but controlled so it doesn't rocket across the board.
        // Use a weighted mixture: mostly small/medium bursts, with occasional big launches.
        const burst = Math.random();
        let vx;
        if (burst < 0.55) {
            // small
            vx = -(7 + Math.random() * 7);            // ~ -7 .. -14
        } else if (burst < 0.90) {
            // medium
            vx = -(12 + Math.random() * 12);          // ~ -12 .. -24
        } else {
            // large (rare)
            vx = -(20 + Math.random() * 16);          // ~ -20 .. -36
        }

        // Upward component: also mixed, with occasional high arcs.
        const arc = Math.random();
        let vy;
        if (arc < 0.60) {
            vy = -(1.2 + Math.random() * 4.2);        // ~ -1.2 .. -5.4
        } else if (arc < 0.92) {
            vy = -(2.8 + Math.random() * 6.0);        // ~ -2.8 .. -8.8
        } else {
            vy = -(5.5 + Math.random() * 7.0);        // ~ -5.5 .. -12.5
        }
        try { Body.setVelocity(body, { x: vx, y: vy }); } catch (_) { /* ignore */ }
        try { Body.setAngularVelocity(body, (Math.random() * 2 - 1) * 0.14); } catch (_) { /* ignore */ }
    }

    function clearFallingLetter() {
        if (!world || !falling || !falling.body) {
            falling = null;
            return;
        }
        try { World.remove(world, falling.body); } catch (_) { /* ignore */ }
        falling = null;
    }

    function finishAndRevealNext(scoredBinId) {
        if (disposed) return;
        clearFallingLetter();
        binCandidate = null;
        setPhase('introducing');

        // Create real space between "done" and "next letter reveal".
        setHudEmpty(true);

        const beginNextLetterAnticipation = () => setTimeoutTracked(() => {
            if (disposed) return;
            // Distinct "get ready" cue, then suspense delay before reveal.
            Audio.ready(0.62);

            const suspenseMs = Math.round(randRange(nextReadyRandomMinMs, nextReadyRandomMaxMs));
            // Drumroll during suspense (stop right as we reveal).
            if (stopDrumroll) {
                try { stopDrumroll(); } catch (_) { /* ignore */ }
                stopDrumroll = null;
            }
            stopDrumroll = Audio.drumroll(suspenseMs, 0.55);

            setTimeoutTracked(() => {
                if (disposed) return;
                if (stopDrumroll) {
                    try { stopDrumroll(); } catch (_) { /* ignore */ }
                    stopDrumroll = null;
                }
                // Reveal next letter as a distinct, slow event with a random twist.
                const twistRoll = Math.random();
                const twist =
                    twistRoll < 0.34 ? 'left' :
                    twistRoll < 0.68 ? 'right' :
                    twistRoll < 0.86 ? 'wiggle' :
                    'none';
                if (hudEl) hudEl.setAttribute('data-wos-letters-intro', twist);

                setTargetLetter(nextLetter);
                nextLetter = pickRandomLetter();
                setHudEmpty(false);
                if (hudEl) addClassForMs(hudEl, 'wos-letters-hud--intro-slow', 700);
                // Gentle, intentional cue (not as exciting as launch/reward).
                Audio.pop(0.28);

                setTimeoutTracked(() => {
                    if (disposed) return;
                    setPhase('idleAwaitingKey');
                }, introBeatMs);
            }, suspenseMs);
        }, nextReadyBaseMs);

        // If this was a confirmed catch, do the score "count up" beat right after despawn.
        if (scoredBinId) {
            bumpBinScore(scoredBinId);
            setTimeoutTracked(() => {
                if (disposed) return;
                beginNextLetterAnticipation();
            }, scoreBeatMs);
        } else {
            beginNextLetterAnticipation();
        }
    }

    function handleStuckIfNeeded(tNow) {
        if (!falling || !falling.body) return;
        if (phase !== 'dropping') return;

        // Don't consider stuck too early; allow the initial launch to settle.
        if ((tNow - dropStartMs) < stuckMinDropMs) return;

        const v = falling.body.velocity || { x: 0, y: 0 };
        const speed = Math.sqrt((v.x || 0) * (v.x || 0) + (v.y || 0) * (v.y || 0));

        if (speed > stuckSpeedEps) {
            lastMotionMs = tNow;
            stuckStartMs = 0;
            stuckPulsing = false;
            return;
        }

        // Low movement: start counting.
        if (!stuckStartMs) stuckStartMs = tNow;

        // If it's been "quiet" long enough, start pulsing as a warning.
        if (!stuckPulsing && (tNow - lastMotionMs) >= stuckNoMotionMs) {
            stuckPulsing = true;
        }

        // After pulsing for a bit, despawn with a gentle cue and move on.
        if (stuckPulsing && (tNow - (lastMotionMs + stuckNoMotionMs)) >= stuckPulseMs) {
            Audio.poof(0.65);
            finishAndRevealNext();
        }
    }

    function handleBinCatchIfNeeded(tNow) {
        if (!falling || !falling.body) return;
        if (phase !== 'inBin') return;
        if (!binCandidate) return;

        // If the letter bounced back out of the bin area, resume dropping.
        const ref = getReferenceSizeFallback();
        const H = ref.height;
        const binTop = H - 180;
        if (falling.body.position && falling.body.position.y < (binTop - 70)) {
            binCandidate = null;
            setPhase('dropping');
            return;
        }

        const v = falling.body.velocity || { x: 0, y: 0 };
        const speed = Math.sqrt((v.x || 0) * (v.x || 0) + (v.y || 0) * (v.y || 0));

        if (speed <= catchStillSpeedEps) {
            if (!binCandidate.stillStartMs) binCandidate.stillStartMs = tNow;
        } else {
            binCandidate.stillStartMs = 0;
        }

        const lingerOk = (tNow - binCandidate.enterMs) >= catchLingerMinMs;
        const stillOk = !!(binCandidate.stillStartMs && (tNow - binCandidate.stillStartMs) >= catchStillMs);

        if (!lingerOk || !stillOk) return;

        // Confirm catch now.
        setPhase('rewarding');

        const strength = Math.max(0.7, clamp01((binCandidate.impactStrength || 0.6)));
        Audio.reward(binCandidate.binId, strength);

        const pulseStart = tNow;
        binPulse.set(binCandidate.binId, { start: pulseStart, end: pulseStart + 700 });

        // Let the letter linger/bounce in the bin after confirmation before we move on.
        setTimeoutTracked(() => {
            if (disposed) return;
            finishAndRevealNext(binCandidate && binCandidate.binId ? binCandidate.binId : null);
        }, catchPostConfirmHoldMs);
    }

    function onCorrectKey() {
        if (disposed) return;
        setPhase('dropping');

        // Pop animation and sound
        if (hudEl) addClassForMs(hudEl, 'wos-letters-hud--pop', 190);
        Audio.launch(0.95);

        spawnFallingLetterFromHud();
        // Hide glyph in the HUD box while the letter is "out" (we'll reveal the next letter later).
        setHudEmpty(true);
        // Pre-pick the next letter now, but don't reveal it until after reward pacing.
        nextLetter = pickRandomLetter();
        binCandidate = null;

        // Brief lockout so accidental key repeats don't feel confusing right at launch.
        setTimeoutTracked(() => {
            if (disposed) return;
            // no-op (phase remains dropping)
        }, postLaunchLockMs);
    }

    function onWrongKey() {
        if (disposed) return;
        if (hudEl) addClassForMs(hudEl, 'wos-letters-hud--wrong', 160);
        Audio.buzz(0.75);
    }

    function onNotYet() {
        if (disposed) return;
        Audio.tick();
    }

    function onBinEnter(binId, collisionPair) {
        if (disposed) return;
        if (phase !== 'dropping') return;

        // Start bin catch confirmation, but don't "register" yet.
        const tNow = (performance.now ? performance.now() : Date.now());
        setPhase('inBin');
        const impactStrength = (() => {
            // Prefer collision depth (available on pair); it's a good proxy for impact intensity.
            const d = collisionPair && collisionPair.collision && Number.isFinite(collisionPair.collision.depth)
                ? Math.abs(collisionPair.collision.depth)
                : 0.4;
            return clamp01(0.55 + d * 0.20);
        })();
        binCandidate = { binId, enterMs: tNow, stillStartMs: 0, impactStrength };

        // A subtle "landed in bin" cue (not the full reward yet).
        Audio.binBounce(0.45);
    }

    function draw() {
        if (!ctx2d || !engine) return;
        const { w: W, h: H } = ensureCanvasSized();
        const ctx = ctx2d;

        ctx.clearRect(0, 0, W, H);

        // Subtle board background overlay (keep it light)
        ctx.save();
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // Draw bins (opaque enough to remain visible over any user-selected background)
        const binCount = binColors.length;
        const binW = W / binCount;
        const binTop = H - 180;
        const tNow = performance.now ? performance.now() : Date.now();
        if (!scoreByBin) scoreByBin = loadScore();

        function starPath(ctxStar, cx, cy, outerR, innerR, points) {
            const n = points || 5;
            let rot = -Math.PI / 2;
            const step = Math.PI / n;
            ctxStar.beginPath();
            for (let i = 0; i < n * 2; i++) {
                const r = (i % 2 === 0) ? outerR : innerR;
                const x = cx + Math.cos(rot) * r;
                const y = cy + Math.sin(rot) * r;
                if (i === 0) ctxStar.moveTo(x, y);
                else ctxStar.lineTo(x, y);
                rot += step;
            }
            ctxStar.closePath();
        }

        for (let i = 0; i < binCount; i++) {
            const c = binColors[i];
            const x0 = i * binW;

            const pulseInfo = binPulse.get(c.id) || null;
            const pulseActive = !!(pulseInfo && pulseInfo.end > tNow);
            const pT = pulseInfo
                ? clamp01(1 - ((pulseInfo.end - tNow) / Math.max(1, (pulseInfo.end - pulseInfo.start))))
                : 0;
            const pulseScale = pulseActive ? (1 + Math.sin(pT * Math.PI) * 0.04) : 1;

            ctx.save();
            // Slight bounce effect on catch
            const centerX = x0 + binW / 2;
            const centerY = binTop + 85;
            ctx.translate(centerX, centerY);
            ctx.scale(1, pulseScale);
            ctx.translate(-centerX, -centerY);

            ctx.globalAlpha = 0.78;
            ctx.fillStyle = c.hex;
            ctx.fillRect(x0 + 6, binTop, binW - 12, 170);

            // Inner shading (helps visibility on bright backgrounds)
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = '#000';
            ctx.fillRect(x0 + 6, binTop + 8, binW - 12, 162);

            // Border
            ctx.globalAlpha = 0.55;
            ctx.lineWidth = pulseActive ? 6 : 4;
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.strokeRect(x0 + 6 + 2, binTop + 2, binW - 12 - 4, 170 - 4);

            // Catch glow (new feedback element beyond transparency shifts)
            if (pulseActive) {
                ctx.globalAlpha = 0.35;
                ctx.shadowColor = 'rgba(255,255,255,0.85)';
                ctx.shadowBlur = 18;
                ctx.strokeStyle = 'rgba(255,255,255,0.85)';
                ctx.lineWidth = 3;
                ctx.strokeRect(x0 + 6 + 6, binTop + 8, binW - 12 - 12, 170 - 16);
            }
            ctx.restore();

            // --- Score UI (always-visible digit + persistent star badge) ---
            const s = scoreByBin && scoreByBin[c.id] ? scoreByBin[c.id] : { count: 0, stars: 0 };
            const countDigit = Math.max(0, Math.min(9, Math.floor(s.count || 0)));
            const stars = Math.max(0, Math.floor(s.stars || 0));

            // Digit badge (top-right inside the bin)
            const badgeCx = x0 + binW - 44;
            const badgeCy = binTop + 36;
            const bump = binScoreAnim.get(c.id);
            const bumpActive = !!(bump && bump.end > tNow);
            const bumpT = bumpActive
                ? clamp01(1 - ((bump.end - tNow) / Math.max(1, (bump.end - bump.start))))
                : 0;
            const badgeScale = bumpActive ? (1 + Math.sin(bumpT * Math.PI) * 0.28) : 1;

            ctx.save();
            ctx.translate(badgeCx, badgeCy);
            ctx.scale(badgeScale, badgeScale);
            ctx.translate(-badgeCx, -badgeCy);

            // Glassy badge disk
            ctx.globalAlpha = 0.78;
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.beginPath();
            ctx.arc(badgeCx, badgeCy, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.55;
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.55)';
            ctx.stroke();

            // Digit (stroke + fill for clarity)
            ctx.globalAlpha = 1;
            ctx.font = '900 28px system-ui, -apple-system, Segoe UI, Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const digitText = String(countDigit);
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.lineWidth = 6;
            ctx.strokeStyle = 'rgba(0,0,0,0.55)';
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.strokeText(digitText, badgeCx, badgeCy + 1);
            ctx.fillText(digitText, badgeCx, badgeCy + 1);
            ctx.restore();

            // Star badge (appears after first 10; persists; shows # of tens)
            if (stars > 0) {
                const starCx = x0 + 44;
                const starCy = binTop + 38;
                const starAnim = binStarAnim.get(c.id);
                const starActive = !!(starAnim && starAnim.end > tNow);
                const starT = starActive
                    ? clamp01(1 - ((starAnim.end - tNow) / Math.max(1, (starAnim.end - starAnim.start))))
                    : 0;
                const starScale = starActive ? (1 + Math.sin(starT * Math.PI) * 0.32) : 1;
                const glow = starActive ? (12 + 10 * Math.sin(starT * Math.PI)) : 0;

                ctx.save();
                ctx.translate(starCx, starCy);
                ctx.scale(starScale, starScale);
                ctx.translate(-starCx, -starCy);

                ctx.globalAlpha = 0.92;
                ctx.shadowColor = 'rgba(255,255,255,0.75)';
                ctx.shadowBlur = glow;
                ctx.fillStyle = 'rgba(255,255,255,0.92)';
                ctx.strokeStyle = 'rgba(0,0,0,0.62)';
                ctx.lineWidth = 4;
                starPath(ctx, starCx, starCy, 18, 8.5, 5);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.stroke();

                // Star count number (centered)
                const starText = stars >= 100 ? '99' : String(stars);
                const fontSize = starText.length >= 2 ? 14 : 16;
                ctx.font = `900 ${fontSize}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineJoin = 'round';
                ctx.miterLimit = 2;
                ctx.lineWidth = 5;
                ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                ctx.fillStyle = 'rgba(0,0,0,0.88)';
                ctx.strokeText(starText, starCx, starCy + 1);
                ctx.fillText(starText, starCx, starCy + 1);
                ctx.restore();
            }
        }

        // Draw pegs (static circles) — polished with subtle grayscale variation + black outline
        const bodies = Matter.Composite.allBodies(world);
        const nowMs = performance.now ? performance.now() : Date.now();
        for (const b of bodies) {
            if (!b) continue;
            if (b.label === 'binSensor') continue;
            if (b.isStatic && b.circleRadius && b.label === 'peg') {
                const style = b.plugin && b.plugin.style ? b.plugin.style : null;
                const baseR = b.circleRadius || 12;
                const jitterR = style ? (style.drawRadiusJitter || 0) : 0;
                const wiggle = style && style.wiggleUntilMs && nowMs < style.wiggleUntilMs
                    ? (1 + 0.10 * Math.sin((style.wiggleUntilMs - nowMs) / 36))
                    : 1;
                const r = Math.max(6, (baseR + jitterR) * wiggle);

                const shade = style ? (style.shade || 0.84) : 0.84;
                const fillA = style ? (style.fillAlpha || 0.82) : 0.82;
                const outA = style ? (style.outlineAlpha || 0.65) : 0.65;
                const ringA = style ? (style.ringAlpha || 0.18) : 0.18;

                ctx.save();
                // Main fill (grayscale)
                const v = Math.round(255 * shade);
                ctx.fillStyle = `rgba(${v},${v},${v},${fillA})`;
                ctx.beginPath();
                ctx.arc(b.position.x, b.position.y, r, 0, Math.PI * 2);
                ctx.fill();

                // Inner ring + highlight dot (still grayscale, no color)
                ctx.globalAlpha = ringA;
                ctx.strokeStyle = 'rgba(255,255,255,1)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(b.position.x, b.position.y, Math.max(2, r - 4), 0, Math.PI * 2);
                ctx.stroke();

                if (style) {
                    const ha = style.highlightAngle || 0;
                    const hx = b.position.x + Math.cos(ha) * (r * 0.35);
                    const hy = b.position.y + Math.sin(ha) * (r * 0.35);
                    ctx.globalAlpha = 0.26;
                    ctx.fillStyle = 'rgba(255,255,255,1)';
                    ctx.beginPath();
                    ctx.arc(hx, hy, Math.max(1.5, r * 0.16), 0, Math.PI * 2);
                    ctx.fill();
                }

                // Black outline stroke for clarity
                ctx.globalAlpha = 1;
                ctx.strokeStyle = `rgba(0,0,0,${outA})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(b.position.x, b.position.y, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        // Draw falling letter (pulse if stuck warning is active)
        if (falling && falling.body) {
            const b = falling.body;
            const tNow2 = performance.now ? performance.now() : Date.now();
            const pulse = stuckPulsing ? (0.92 + 0.10 * (0.5 + 0.5 * Math.sin(tNow2 / 120))) : 1;
            ctx.save();
            ctx.translate(b.position.x, b.position.y);
            ctx.rotate(b.angle);
            ctx.scale(pulse, pulse);

            // Bubble
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath();
            ctx.arc(0, 0, b.circleRadius || 32, 0, Math.PI * 2);
            ctx.fill();

            // Glyph (single character)
            ctx.fillStyle = 'rgba(17,17,17,0.92)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '900 40px system-ui, -apple-system, Segoe UI, Arial, sans-serif';
            const letter = (b.plugin && b.plugin.letter) ? String(b.plugin.letter) : 'A';
            ctx.fillText(letter, 0, 2);

            if (stuckPulsing) {
                ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                ctx.lineWidth = 3;
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                ctx.arc(0, 0, (b.circleRadius || 32) + 4, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    function step(ts) {
        if (disposed) return;
        if (!engine) return;

        if (!lastTs) lastTs = ts;
        const dt = Math.min(50, Math.max(0, ts - lastTs));
        lastTs = ts;
        accumulatorMs += dt;

        // Fixed timestep for stable physics (60 Hz)
        const stepMs = 1000 / 60;
        while (accumulatorMs >= stepMs) {
            Matter.Engine.update(engine, stepMs);
            accumulatorMs -= stepMs;
        }

        draw();
        const tNow = performance.now ? performance.now() : Date.now();
        handleStuckIfNeeded(tNow);
        handleBinCatchIfNeeded(tNow);
        raf = requestAnimationFrame(step);
    }

    function onKeyDown(e) {
        if (disposed) return;

        // Ignore modifier combos
        if (e && (e.ctrlKey || e.metaKey || e.altKey)) return;

        // Ensure audio unlocked on first user gesture
        Audio.unlock().catch(() => {});

        const key = normalizeKey(e);
        if (!key) return;

        if (phase !== 'idleAwaitingKey') {
            onNotYet();
            return;
        }

        if (key === targetLetter) {
            onCorrectKey();
        } else {
            onWrongKey();
        }
    }

    function onPointerDown(e) {
        if (disposed) return;
        if (!e) return;

        Audio.unlock().catch(() => {});

        const p = getCanvasRefPointFromClient(e.clientX, e.clientY);
        if (isInSafeTopLeft(p)) return;

        // Flavor: tap near a peg to "wiggle" / nudge it (non-solution).
        if (!world) return;

        const bodies = Matter.Composite.allBodies(world);
        let closest = null;
        let bestD2 = Infinity;
        for (const b of bodies) {
            if (!b || !b.isStatic || !b.circleRadius) continue;
            if (b.label !== 'peg') continue;
            const dx = b.position.x - p.x;
            const dy = b.position.y - p.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
                bestD2 = d2;
                closest = b;
            }
        }

        const hitRadius = 34;
        if (closest && bestD2 <= hitRadius * hitRadius) {
            // Fun + silly: give the peg a bigger random nudge, but keep it safe:
            // - can't drift too far from home
            // - can't move into no-go zones (HUD/corridor)
            // - can't get too close to neighbors (avoid stuck traps)
            const meta = pegMeta;
            const style = closest.plugin && closest.plugin.style ? closest.plugin.style : null;
            const home = closest.plugin && closest.plugin.home ? closest.plugin.home : { x: closest.position.x, y: closest.position.y };

            const minDist = meta ? meta.minDist : 38;
            const minDist2 = minDist * minDist;
            const maxDrift = meta ? meta.maxDrift : 46;
            const maxDrift2 = maxDrift * maxDrift;

            const inBounds = (x, y) => {
                const W = meta ? meta.W : (canvas.width || 1280);
                const H = meta ? meta.H : (canvas.height || 800);
                const xPad = meta ? meta.xPad : 140;
                const top = meta ? meta.pegTop : 110;
                const bottom = meta ? meta.pegBottom : (H - 180 - 62);
                if (x < xPad || x > (W - xPad)) return false;
                if (y < top || y > bottom) return false;
                if (meta && typeof meta.inNoGoZones === 'function' && meta.inNoGoZones(x, y)) return false;
                return true;
            };

            const canPlace = (x, y) => {
                const dxh = x - home.x;
                const dyh = y - home.y;
                if ((dxh * dxh + dyh * dyh) > maxDrift2) return false;
                for (const b of bodies) {
                    if (!b || b === closest) continue;
                    if (!b.isStatic || !b.circleRadius) continue;
                    if (b.label !== 'peg') continue;
                    const dx = b.position.x - x;
                    const dy = b.position.y - y;
                    if ((dx * dx + dy * dy) < minDist2) return false;
                }
                return true;
            };

            let moved = false;
            let magnitude = 0;
            for (let attempt = 0; attempt < 10; attempt++) {
                const big = Math.random() < 0.16; // occasional "silly" hop
                const dist = (big ? 16 : 8) + Math.random() * (big ? 16 : 10); // ~8..18 most, ~16..32 rare
                const ang = Math.random() * Math.PI * 2;
                const ox = Math.cos(ang) * dist;
                const oy = Math.sin(ang) * dist;
                const nx = closest.position.x + ox;
                const ny = closest.position.y + oy;
                if (!inBounds(nx, ny)) continue;
                if (!canPlace(nx, ny)) continue;
                try {
                    Body.setPosition(closest, { x: nx, y: ny });
                    moved = true;
                    magnitude = dist;
                } catch (_) { /* ignore */ }
                break;
            }

            // Visual wiggle + sound
            if (style) style.wiggleUntilMs = (performance.now ? performance.now() : Date.now()) + (moved ? 520 : 280);

            if (moved) {
                // Louder for bigger nudges (still gentle overall)
                const s = Math.min(1, 0.25 + (magnitude / 32) * 0.75);
                Audio.plink(0.20 + 0.55 * s);
                if (magnitude > 22) Audio.pop(0.22);
            } else {
                // Couldn't safely move: do a tiny wiggle and tick
                Audio.plink(0.16);
            }
        } else {
            // Tap elsewhere: tiny tick
            Audio.tick();
        }
    }

    function start() {
        if (disposed) return;

        // Ensure canvas is ready
        ctx2d = canvas.getContext('2d', { alpha: true, desynchronized: true });
        ensureCanvasSized();

        // Init audio context (lazy unlock on first gesture)
        Audio.ensure();

        // Init physics
        initWorld();

        // Start with an "intro" beat so the child doesn't feel rushed.
        // Initialize letters: show target, pre-pick next.
        setTargetLetter(targetLetter);
        nextLetter = pickRandomLetter();
        setHudEmpty(false);
        if (hudEl) hudEl.setAttribute('data-wos-letters-intro', 'none');
        if (hudEl) addClassForMs(hudEl, 'wos-letters-hud--intro-slow', 700);
        Audio.pop(0.22);
        setTimeoutTracked(() => {
            if (disposed) return;
            setPhase('idleAwaitingKey');
        }, introBeatMs);

        // Input
        document.addEventListener('keydown', onKeyDown, true);
        canvas.addEventListener('pointerdown', onPointerDown);
        cleanupFns.push(() => document.removeEventListener('keydown', onKeyDown, true));
        cleanupFns.push(() => canvas.removeEventListener('pointerdown', onPointerDown));

        // If reference resolution changes, resync canvas backing store.
        const onDisplayChange = () => ensureCanvasSized();
        document.addEventListener('winnieos:displaychange', onDisplayChange);
        cleanupFns.push(() => document.removeEventListener('winnieos:displaychange', onDisplayChange));

        // Kick loop
        raf = requestAnimationFrame(step);
    }

    function dispose() {
        if (disposed) return;
        disposed = true;

        if (stopDrumroll) {
            try { stopDrumroll(); } catch (_) { /* ignore */ }
            stopDrumroll = null;
        }

        try {
            if (raf) cancelAnimationFrame(raf);
        } catch (_) { /* ignore */ }
        raf = null;

        clearTimers();

        for (const fn of cleanupFns) {
            try { fn(); } catch (_) { /* ignore */ }
        }
        cleanupFns = [];

        try { clearFallingLetter(); } catch (_) { /* ignore */ }

        // Dispose physics world
        try {
            if (world) {
                Matter.World.clear(world, false);
            }
            if (engine) {
                Matter.Engine.clear(engine);
            }
        } catch (_) { /* ignore */ }

        engine = null;
        world = null;
        ctx2d = null;
    }

    return { start, dispose };
}


