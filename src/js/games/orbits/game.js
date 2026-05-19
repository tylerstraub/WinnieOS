/**
 * Orbits — gravity sandbox
 *
 * N-body: planets feel gravity from each other AND from a fixed central sun.
 * Velocity-Verlet integrator (stable for orbits, cheap) with softened 1/r²
 * so close passes slingshot instead of receiving infinite force.
 *
 * Factory returns { start, dispose } following the WinnieOS game contract.
 */

import { Audio } from '../../utils/audio.js';
import { Background } from '../../utils/background.js';

// ── Physics constants ────────────────────────────────────────────────────
// All units are arbitrary "game units" — calibrated so that a planet
// spawned at radius r with v = √(G·M/r) traces a circular orbit.
const G = 1;
const DEFAULT_SUN_MASS = 60000;
const MIN_SUN_MASS = 8000;
const MAX_SUN_MASS = 200000;

// Per render frame at timeScale=1, advance the simulation by FRAME_DT. We
// then split into substeps no larger than MAX_SUBSTEP_DT to keep the
// integrator stable when timeScale is high. Calibrated so the inner default
// orbit takes ~7s at 1× — easy to watch, easy to count.
const FRAME_DT = 0.1;
const MAX_SUBSTEP_DT = 0.5;

// Range of radii used when Space spawns a random stable orbit.
const RANDOM_R_MIN = 110;
const RANDOM_R_MAX = 360;

// Cap to keep the scene watchable. Hitting the cap plays a soft buzz so
// it's clear the launch was rejected, but the system never visually breaks.
const MAX_PLANETS = 8;

// Planet-on-planet gravity. PLANET_MASS_SCALE × r³ gives each planet a mass
// of a few hundred (sun is 60k by default), so mutual perturbations are
// visible but the sun stays dominant. SOFTENING_SQ avoids the 1/r² blow-up
// when two planets pass very close — they slingshot off each other instead
// of receiving infinite force.
const PLANET_MASS_SCALE = 1.5;
const SOFTENING_SQ = 64;

const TRAIL_MAX = 420;
const TRAIL_STRIDE = 2;         // push a trail point every N physics steps
const ESCAPE_MARGIN = 1.4;      // multiples of half-diagonal beyond which a planet is "gone"

// Small palette to pick from when a new planet is born.
const PLANET_COLORS = [
  '#ffd166', '#ef476f', '#06d6a0', '#118ab2',
  '#c77dff', '#ff8fab', '#7bf1a8', '#fca311'
];

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 200, g: 200, b: 255 };
}

/**
 * @param {{
 *   canvas: HTMLCanvasElement,
 *   onPlanetCountChange?: (n: number, max: number) => void,
 *   onLaunchRejected?: () => void,
 * }} opts
 * @returns {{ start: () => void, dispose: () => void, api: object }}
 */
export function createOrbitsGame({ canvas, onPlanetCountChange, onLaunchRejected }) {
  const ctx = canvas.getContext('2d');
  let disposed = false;

  // ── Dimensions ────────────────────────────────────────────────────────
  let width = canvas.width;
  let height = canvas.height;
  let cx = width / 2;
  let cy = height / 2;
  let halfDiag = Math.hypot(cx, cy);

  function syncSize() {
    width = canvas.width;
    height = canvas.height;
    cx = width / 2;
    cy = height / 2;
    halfDiag = Math.hypot(cx, cy);
  }

  // Theme color inherited from the desktop background primary, so the sun
  // and corona belong to the rest of the OS visually.
  const primaryHex = Background.getSaved() || '#667eea';

  // ── World state ───────────────────────────────────────────────────────
  let sunMass = DEFAULT_SUN_MASS;
  let timeScale = 1.0;          // 0 (paused) .. 2.0 (fast)
  let physicsStep = 0;
  // Animation clock — advances proportional to timeScale, so star
  // twinkling AND the sun's corona / rays / hotspots all freeze when the
  // user pauses time and speed up together at 2×.
  let animClock = 0;

  /** @type {Array<{x:number,y:number,vx:number,vy:number,ax:number,ay:number,r:number,color:string,trail:Array<{x:number,y:number}>,age:number}>} */
  let planets = [];

  // Particles for collision/escape feedback
  /** @type {Array<{x:number,y:number,dx:number,dy:number,r:number,life:number,color:string}>} */
  let particles = [];

  // Brief "no — can't add another" effects at the rejected touch position.
  /** @type {Array<{x:number,y:number,age:number,maxAge:number}>} */
  const rejectionEffects = [];

  // Pre-generated starfield. Positions are normalized (0..1) so they scale
  // with the canvas; size + twinkle phase are baked in once.
  const STAR_COUNT = 110;
  const stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      xNorm: Math.random(),
      yNorm: Math.random(),
      size: 0.4 + Math.random() * 1.3,
      twinkle: Math.random() * Math.PI * 2,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function sunRadius() {
    // Linear in mass so the slider's effect is visually obvious — a bigger
    // sun means more gravity, and you can *see* it grow as you slide.
    return 10 + sunMass * 0.00012;
  }

  function circularOrbitSpeed(r) {
    return Math.sqrt((G * sunMass) / Math.max(r, 1));
  }

  function pickColor() {
    return PLANET_COLORS[(Math.random() * PLANET_COLORS.length) | 0];
  }

  function notifyCount() {
    if (onPlanetCountChange) onPlanetCountChange(planets.length, MAX_PLANETS);
  }

  function spawnPlanet(x, y, vx, vy) {
    if (planets.length >= MAX_PLANETS) {
      try { Audio.deny(0.5); } catch (_) {}
      rejectionEffects.push({ x, y, age: 0, maxAge: 32 });
      if (onLaunchRejected) onLaunchRejected();
      return false;
    }
    const r = 5 + Math.random() * 3;
    // Mass scales with volume (r³). PLANET_MASS_SCALE keeps planets at a few
    // tenths of a percent of the sun — enough to perturb each other visibly
    // without overwhelming the sun's pull.
    const mass = r * r * r * PLANET_MASS_SCALE;
    planets.push({
      x, y, vx, vy, ax: 0, ay: 0,
      _newAx: 0, _newAy: 0,
      r, mass,
      color: pickColor(),
      trail: [],
      age: 0,
    });
    notifyCount();
    return true;
  }

  function spawnDefaultScene() {
    planets = [];
    // Three planets at randomized radii / angles / direction so each launch
    // of the app feels like a slightly different universe.
    for (let i = 0; i < 3; i++) {
      const r = 120 + Math.random() * 220;
      const ang = Math.random() * Math.PI * 2;
      const px = cx + Math.cos(ang) * r;
      const py = cy + Math.sin(ang) * r;
      const v = circularOrbitSpeed(r);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const vx = -Math.sin(ang) * v * dir;
      const vy =  Math.cos(ang) * v * dir;
      spawnPlanet(px, py, vx, vy);
    }
  }

  function removePlanet(p) {
    const idx = planets.indexOf(p);
    if (idx < 0) return false;
    spawnBloom(p.x, p.y, p.color);
    planets.splice(idx, 1);
    try { Audio.dissolve(0.45); } catch (_) {}
    notifyCount();
    return true;
  }

  function removeLastPlanet() {
    if (planets.length === 0) {
      try { Audio.deny(0.35); } catch (_) {}
      return false;
    }
    return removePlanet(planets[planets.length - 1]);
  }

  /** Hit-test: returns the topmost (last-spawned) planet at (x, y), or null.
   *  Includes a small touch-padding so taps don't require pixel precision. */
  function findPlanetAt(x, y) {
    const FINGER_PAD = 12;
    for (let i = planets.length - 1; i >= 0; i--) {
      const p = planets[i];
      const dx = p.x - x;
      const dy = p.y - y;
      const hit = p.r + FINGER_PAD;
      if (dx * dx + dy * dy <= hit * hit) return p;
    }
    return null;
  }

  /** Merge two planets (by their array indices). Larger one absorbs smaller —
   *  position and velocity become the center-of-mass values, mass is summed,
   *  and the radius is recomputed from total mass (r = ³√(m / scale)). */
  function mergePlanets(i, j) {
    const a = planets[i];
    const b = planets[j];
    const total = a.mass + b.mass;
    const newX = (a.x * a.mass + b.x * b.mass) / total;
    const newY = (a.y * a.mass + b.y * b.mass) / total;
    const newVx = (a.vx * a.mass + b.vx * b.mass) / total;
    const newVy = (a.vy * a.mass + b.vy * b.mass) / total;
    const newR = Math.cbrt(total / PLANET_MASS_SCALE);

    const keepIdx = a.mass >= b.mass ? i : j;
    const removeIdx = a.mass >= b.mass ? j : i;
    const keep = planets[keepIdx];
    const lost = planets[removeIdx];

    keep.x = newX; keep.y = newY;
    keep.vx = newVx; keep.vy = newVy;
    keep.mass = total;
    keep.r = newR;

    spawnBloom(newX, newY, lost.color);
    // Two bodies merging — deep low double-sine with a slight pitch dip.
    try { Audio.coalesce(0.6); } catch (_) {}
    planets.splice(removeIdx, 1);
    // Count change is observed by the end-of-tick check in physicsTick.
  }

  // ── Physics step (velocity-verlet, N-body) ────────────────────────────
  // Each planet feels gravity from the (fixed) sun AND every other planet.
  // The sun does not move — keeping it pinned at the canvas center anchors
  // the scene visually and prevents center-of-mass drift over long sessions.
  function computeAccel(p) {
    let ax = 0, ay = 0;

    // Sun (always at canvas center, mass = sunMass)
    const sx = cx - p.x;
    const sy = cy - p.y;
    const sr2 = sx * sx + sy * sy;
    if (sr2 >= 1) {
      const sr = Math.sqrt(sr2);
      const sf = (G * sunMass) / (sr2 * sr);
      ax += sf * sx;
      ay += sf * sy;
    }

    // Other planets — softened 1/r² so close passes slingshot cleanly.
    for (let i = 0; i < planets.length; i++) {
      const q = planets[i];
      if (q === p) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const r2 = dx * dx + dy * dy + SOFTENING_SQ;
      const r = Math.sqrt(r2);
      const f = (G * q.mass) / (r2 * r);
      ax += f * dx;
      ay += f * dy;
    }

    return { ax, ay };
  }

  function physicsTick(dt) {
    physicsStep++;
    const N = planets.length;
    const startCount = N;

    // For correct N-body velocity-verlet we must advance all positions
    // first, then compute new accelerations using everyone's new positions,
    // then update velocities. Doing it in a single per-planet pass would
    // mean later planets see earlier planets at their new positions and
    // vice versa — an ordering bias.

    // Step 1: positions, and lazy init of accel on first tick.
    for (let i = 0; i < N; i++) {
      const p = planets[i];
      if (p.age === 0) {
        const a0 = computeAccel(p);
        p.ax = a0.ax; p.ay = a0.ay;
      }
      p.x += p.vx * dt + 0.5 * p.ax * dt * dt;
      p.y += p.vy * dt + 0.5 * p.ay * dt * dt;
    }

    // Step 2: new accelerations at the new positions.
    for (let i = 0; i < N; i++) {
      const p = planets[i];
      const a1 = computeAccel(p);
      p._newAx = a1.ax;
      p._newAy = a1.ay;
    }

    // Step 3: velocities, trails, sun-collision, escape — iterate in
    // reverse so splice() is safe.
    for (let i = N - 1; i >= 0; i--) {
      const p = planets[i];
      p.vx += 0.5 * (p.ax + p._newAx) * dt;
      p.vy += 0.5 * (p.ay + p._newAy) * dt;
      p.ax = p._newAx;
      p.ay = p._newAy;
      p.age++;

      if (physicsStep % TRAIL_STRIDE === 0) {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > TRAIL_MAX) p.trail.shift();
      }

      const dx = p.x - cx, dy = p.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < sunRadius() + p.r * 0.5) {
        spawnBloom(p.x, p.y, p.color);
        // Planet falls into the sun — bright flash sweeping down to rumble.
        try { Audio.absorb(0.55); } catch (_) {}
        planets.splice(i, 1);
        continue;
      }
      if (dist > halfDiag * ESCAPE_MARGIN) {
        // Planet escapes off-screen — rising doppler + airy whoosh.
        try { Audio.vanish(0.45); } catch (_) {}
        planets.splice(i, 1);
      }
    }

    // Step 4: planet-on-planet collisions → merge. Loop until no more merges
    // can happen this tick (a pile-up could chain through several pairs).
    let mergedAny = true;
    let safety = 0;
    while (mergedAny && safety++ < MAX_PLANETS) {
      mergedAny = false;
      outer: for (let a = planets.length - 1; a >= 1; a--) {
        for (let b = a - 1; b >= 0; b--) {
          const pa = planets[a], pb = planets[b];
          const dx = pa.x - pb.x, dy = pa.y - pb.y;
          const touchR = (pa.r + pb.r) * 0.9;
          if (dx * dx + dy * dy < touchR * touchR) {
            mergePlanets(a, b);
            mergedAny = true;
            break outer;
          }
        }
      }
    }

    if (planets.length !== startCount) notifyCount();
  }

  // ── Particles ─────────────────────────────────────────────────────────
  function spawnBloom(x, y, color) {
    const rgb = hexToRgb(color);
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.6 + Math.random() * 2.4;
      particles.push({
        x, y,
        dx: Math.cos(a) * s, dy: Math.sin(a) * s,
        r: 1.5 + Math.random() * 2.5,
        life: 28 + (Math.random() * 18) | 0,
        color: `rgb(${rgb.r},${rgb.g},${rgb.b})`,
      });
    }
  }

  function updateAndDrawRejections() {
    for (let i = rejectionEffects.length - 1; i >= 0; i--) {
      const e = rejectionEffects[i];
      e.age++;
      if (e.age >= e.maxAge) { rejectionEffects.splice(i, 1); continue; }
      const t = e.age / e.maxAge;
      const ringR = 10 + t * 52;
      const alpha = 0.95 * (1 - t);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Expanding red ring
      ctx.strokeStyle = `rgba(255, 78, 78, ${alpha})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      // X inside the ring — universal "no"
      const cr = 13;
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = `rgba(255, 110, 110, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(e.x - cr, e.y - cr);
      ctx.lineTo(e.x + cr, e.y + cr);
      ctx.moveTo(e.x + cr, e.y - cr);
      ctx.lineTo(e.x - cr, e.y + cr);
      ctx.stroke();
      ctx.restore();
    }
  }

  function updateAndDrawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.dx;
      p.y += p.dy;
      p.dx *= 0.97;
      p.dy *= 0.97;
      p.life--;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.life / 22);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Render ────────────────────────────────────────────────────────────
  function drawSpaceBackdrop() {
    // Heavy dark fill — when Orbits is open, the world looks like space.
    // Only a soft theme-colored halo near the sun lets the WinnieOS palette
    // bleed through, so the OS still feels present without dominating.
    ctx.fillStyle = 'rgba(4, 7, 20, 0.93)';
    ctx.fillRect(0, 0, width, height);

    const rgb = hexToRgb(primaryHex);
    const haloR = Math.min(width, height) * 0.5;
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
    halo.addColorStop(0,    `rgba(${rgb.r},${rgb.g},${rgb.b},0.16)`);
    halo.addColorStop(0.55, `rgba(${rgb.r},${rgb.g},${rgb.b},0.05)`);
    halo.addColorStop(1,    `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStars() {
    ctx.fillStyle = '#ffffff';
    for (const s of stars) {
      const x = s.xNorm * width;
      const y = s.yNorm * height;
      const tw = 0.35 + 0.4 * Math.sin(animClock * 0.035 + s.twinkle);
      ctx.globalAlpha = tw;
      ctx.beginPath();
      ctx.arc(x, y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSun() {
    const r = sunRadius();
    const rgb = hexToRgb(primaryHex);
    const warmR = Math.min(255, rgb.r + 100);
    const warmG = Math.min(255, rgb.g + 100);
    const warmB = Math.min(255, rgb.b + 100);

    // ── 1. Outer corona — wide faint glow, breathing. ──
    // Radius scales with the body so the "gravity reach" visually expands as
    // the sun grows. Colors come from the desktop theme so the sun belongs
    // to the OS. Animations use animClock so they pause with timeScale.
    const breathe = 0.85 + 0.15 * Math.sin(animClock * 0.025);
    const coronaR = r * 6;
    const corona = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, coronaR);
    corona.addColorStop(0,   `rgba(${rgb.r},${rgb.g},${rgb.b},${0.32 * breathe})`);
    corona.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.10 * breathe})`);
    corona.addColorStop(1,   `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(cx, cy, coronaR, 0, Math.PI * 2);
    ctx.fill();

    // ── 2. Rotating rays — 8 wedges of light. ──
    // The single biggest "this is a sun" cue (kid drawings always have rays).
    // Each ray pulses on its own phase so the sun feels alive, not mechanical.
    const NUM_RAYS = 8;
    const baseRot = animClock * 0.0025;
    for (let i = 0; i < NUM_RAYS; i++) {
      const a = baseRot + (i / NUM_RAYS) * Math.PI * 2;
      const phase = (Math.sin(animClock * 0.04 + i * 0.83) + 1) * 0.5;
      const rayLen = r * (3.0 + phase * 1.6);
      const halfWidth = 0.075;
      const tipX = cx + Math.cos(a) * rayLen;
      const tipY = cy + Math.sin(a) * rayLen;
      const baseInner = r * 0.95;

      const grad = ctx.createLinearGradient(cx, cy, tipX, tipY);
      grad.addColorStop(0, `rgba(${warmR},${warmG},${warmB},${0.45 + phase * 0.25})`);
      grad.addColorStop(0.6, `rgba(${rgb.r},${rgb.g},${rgb.b},${0.18 + phase * 0.12})`);
      grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(cx + Math.cos(a + halfWidth) * baseInner, cy + Math.sin(a + halfWidth) * baseInner);
      ctx.lineTo(cx + Math.cos(a - halfWidth) * baseInner, cy + Math.sin(a - halfWidth) * baseInner);
      ctx.closePath();
      ctx.fill();
    }

    // ── 3. Body — bright glowing disk with limb darkening. ──
    const dimR = Math.floor(rgb.r * 0.82);
    const dimG = Math.floor(rgb.g * 0.82);
    const dimB = Math.floor(rgb.b * 0.82);
    const body = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    body.addColorStop(0,    'rgba(255, 255, 245, 1)');
    body.addColorStop(0.32, `rgb(${warmR},${warmG},${warmB})`);
    body.addColorStop(0.85, `rgb(${rgb.r},${rgb.g},${rgb.b})`);
    body.addColorStop(1,    `rgb(${dimR},${dimG},${dimB})`);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // ── 4. Surface hotspots — three bright blobs that drift across the disk. ──
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.98, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < 3; i++) {
      const driftAng = animClock * 0.009 + i * 2.1;
      const driftR = r * (0.25 + 0.35 * Math.sin(animClock * 0.013 + i * 1.7));
      const px = cx + Math.cos(driftAng) * driftR;
      const py = cy + Math.sin(driftAng) * driftR;
      const spotR = r * 0.4;
      const sg = ctx.createRadialGradient(px, py, 0, px, py, spotR);
      sg.addColorStop(0, 'rgba(255, 250, 220, 0.45)');
      sg.addColorStop(1, 'rgba(255, 250, 220, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(px, py, spotR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

  }

  function drawTrails() {
    for (const p of planets) {
      if (p.trail.length < 2) continue;
      // Trail draws as a polyline whose alpha fades from tail (oldest) to head.
      // We render in segments so we can vary alpha — fast but cheap.
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const N = p.trail.length;
      for (let i = 1; i < N; i++) {
        const t = i / N;                      // 0 (oldest) .. 1 (newest)
        ctx.globalAlpha = t * 0.55;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1 + t * 1.6;
        ctx.beginPath();
        ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPlanets() {
    for (const p of planets) {
      // Halo
      const grad = ctx.createRadialGradient(p.x, p.y, p.r * 0.4, p.x, p.y, p.r * 3);
      const rgb = hexToRgb(p.color);
      grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.55)`);
      grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Slingshot preview (when pointer is dragging)
  let slingshot = null;   // { startX, startY, curX, curY }

  // Reusable spans for the predicted trajectory so we don't allocate per
  // frame while dragging. STEPS chosen so even a strong launch fits.
  const TRAJECTORY_STEPS = 80;

  function drawSlingshot() {
    if (!slingshot) return;
    const { startX, startY, curX, curY } = slingshot;

    // Match launchSlingshot's velocity math exactly — the preview must agree
    // with what the launch will actually do.
    const dragX = startX - curX;
    const dragY = startY - curY;
    const dragLen = Math.hypot(dragX, dragY);
    const vx = dragX * 0.22;
    const vy = dragY * 0.22;

    // Pull intensity 0..1. ~120 px = "full charge."
    const intensity = Math.min(1, dragLen / 120);
    // Hue shifts from cool white at rest to warm orange at max pull — the
    // body is "charging up energy" the further you pull.
    const hue = 50 - intensity * 50;             // 50 (yellow) → 0 (red)
    const sat = 75 + intensity * 25;             // 75% → 100%

    ctx.save();

    // ── Predicted trajectory — forward-simulate sun-only gravity. ──
    // Other planets are moving too; their influence is unpredictable from a
    // freeze-frame, so we deliberately ignore them. The user sees the orbit
    // they'd get against the dominant body, which is what matters.
    if (dragLen > 8) {
      let px = startX, py = startY;
      let pvx = vx, pvy = vy;

      // Initial accel from the sun.
      const rx0 = cx - px, ry0 = cy - py;
      const r02 = rx0 * rx0 + ry0 * ry0;
      let pax = 0, pay = 0;
      if (r02 >= 1) {
        const f0 = (G * sunMass) / (r02 * Math.sqrt(r02));
        pax = f0 * rx0; pay = f0 * ry0;
      }

      ctx.strokeStyle = `hsla(${hue}, ${sat}%, 75%, ${0.30 + intensity * 0.45})`;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(px, py);

      for (let i = 0; i < TRAJECTORY_STEPS; i++) {
        const dt = FRAME_DT;
        px += pvx * dt + 0.5 * pax * dt * dt;
        py += pvy * dt + 0.5 * pay * dt * dt;
        const rx = cx - px, ry = cy - py;
        const r2 = rx * rx + ry * ry;
        let nax = 0, nay = 0;
        if (r2 >= 1) {
          const f = (G * sunMass) / (r2 * Math.sqrt(r2));
          nax = f * rx; nay = f * ry;
        }
        pvx += 0.5 * (pax + nax) * dt;
        pvy += 0.5 * (pay + nay) * dt;
        pax = nax; pay = nay;

        // Stop drawing if the predicted path falls into the sun or escapes.
        const distSq = rx * rx + ry * ry;
        if (distSq < (sunRadius() + 6) ** 2) break;
        if (distSq > (halfDiag * ESCAPE_MARGIN) ** 2) break;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Pull line — tapered, intensity-scaled. ──
    if (dragLen > 2) {
      const lineGrad = ctx.createLinearGradient(curX, curY, startX, startY);
      lineGrad.addColorStop(0, `hsla(${hue}, ${sat}%, 70%, 0.25)`);
      lineGrad.addColorStop(1, `hsla(${hue}, ${sat}%, 85%, 0.9)`);
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 2 + intensity * 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(curX, curY);
      ctx.lineTo(startX, startY);
      ctx.stroke();
    }

    // ── Charging spawn point — grows and warms with pull. ──
    // The wide soft glow telegraphs "this is where the planet will appear,
    // and it's storing energy."
    const dotR = 4 + intensity * 6;
    const glowR = 14 + intensity * 28;
    const glow = ctx.createRadialGradient(startX, startY, 0, startX, startY, glowR);
    glow.addColorStop(0,    `hsla(${hue}, ${sat}%, 75%, ${0.55 + intensity * 0.35})`);
    glow.addColorStop(0.45, `hsla(${hue}, ${sat}%, 65%, ${0.18 + intensity * 0.20})`);
    glow.addColorStop(1,    `hsla(${hue}, ${sat}%, 60%, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(startX, startY, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `hsla(${hue}, 100%, 92%, ${0.85 + intensity * 0.15})`;
    ctx.beginPath();
    ctx.arc(startX, startY, dotR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Main loop ─────────────────────────────────────────────────────────
  let rafId = null;

  function frameLoop() {
    if (disposed) return;
    syncSize();

    // Advance simulation time. timeScale=0 pauses; otherwise we split into
    // substeps small enough to keep velocity-verlet stable at high speed.
    const advance = FRAME_DT * timeScale;
    if (advance > 0) {
      const substeps = Math.max(1, Math.ceil(advance / MAX_SUBSTEP_DT));
      const subDt = advance / substeps;
      for (let i = 0; i < substeps; i++) physicsTick(subDt);
    }
    // Stars and the sun's surface life all share this clock — they freeze
    // when time is paused and run faster when it's sped up.
    animClock += timeScale;

    ctx.clearRect(0, 0, width, height);
    drawSpaceBackdrop();
    drawStars();
    drawTrails();
    drawSun();
    drawPlanets();
    updateAndDrawParticles();
    updateAndDrawRejections();
    drawSlingshot();

    rafId = requestAnimationFrame(frameLoop);
  }

  // ── Public API used by app.js (keyboard + HUD) ────────────────────────
  const api = {
    /** Spawn a new planet on a random stable circular orbit. Keyboard launch. */
    launchRandom() {
      const ang = Math.random() * Math.PI * 2;
      const r = RANDOM_R_MIN + Math.random() * (RANDOM_R_MAX - RANDOM_R_MIN);
      const px = cx + Math.cos(ang) * r;
      const py = cy + Math.sin(ang) * r;
      const v = circularOrbitSpeed(r);
      // Tangent velocity, randomly clockwise or counter-clockwise.
      const dir = Math.random() < 0.5 ? 1 : -1;
      const vx = -Math.sin(ang) * v * dir;
      const vy =  Math.cos(ang) * v * dir;
      if (spawnPlanet(px, py, vx, vy)) {
        try { Audio.materialize(0.55); } catch (_) {}
      }
    },
    launchSlingshot(startX, startY, releaseX, releaseY) {
      // Velocity is proportional to drag vector (released → start direction, like a slingshot).
      const dx = (startX - releaseX) * 0.22;
      const dy = (startY - releaseY) * 0.22;
      if (spawnPlanet(startX, startY, dx, dy)) {
        try { Audio.materialize(0.55); } catch (_) {}
      }
    },
    removeLastPlanet,
    removePlanet,
    findPlanetAt,
    adjustSunMass(factor) {
      sunMass = Math.max(MIN_SUN_MASS, Math.min(MAX_SUN_MASS, sunMass * factor));
    },
    setSunMass(value) {
      sunMass = Math.max(MIN_SUN_MASS, Math.min(MAX_SUN_MASS, value));
    },
    adjustTimeScale(delta) {
      timeScale = Math.max(0, Math.min(2.0, timeScale + delta));
    },
    setTimeScale(value) {
      timeScale = Math.max(0, Math.min(2.0, value));
    },
    getSunMass() { return sunMass; },
    getTimeScale() { return timeScale; },
    beginSlingshot(x, y) {
      slingshot = { startX: x, startY: y, curX: x, curY: y };
    },
    updateSlingshot(x, y) {
      if (slingshot) { slingshot.curX = x; slingshot.curY = y; }
    },
    endSlingshot(x, y) {
      if (!slingshot) return;
      const { startX, startY } = slingshot;
      slingshot = null;
      // Ignore tiny taps
      if (Math.hypot(x - startX, y - startY) < 8) return;
      api.launchSlingshot(startX, startY, x, y);
    },
    cancelSlingshot() {
      slingshot = null;
    },
  };

  return {
    start() {
      syncSize();
      spawnDefaultScene();
      rafId = requestAnimationFrame(frameLoop);
    },
    dispose() {
      disposed = true;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      planets = [];
      particles = [];
    },
    api,
  };
}
