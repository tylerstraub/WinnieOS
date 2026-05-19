/**
 * Orbits — gravity sandbox (app shell)
 *
 * Thin adapter around `createOrbitsGame`. Owns the DOM structure
 * (canvas + glass HUD strip), keyboard + pointer input, and cleanup.
 */

import { createOrbitsGame } from '../../games/orbits/game.js';
import { Audio } from '../../utils/audio.js';

export default {
    id: 'orbits',
    title: 'Orbits',
    iconEmoji: '🪐',
    sortOrder: 25,

    mount: function ({ root }) {
        if (!root) return;

        root.className = 'wos-orbits-app';
        root.innerHTML = '';

        // Canvas fills the app root.
        const canvas = document.createElement('canvas');
        canvas.className = 'wos-orbits-canvas';
        canvas.setAttribute('aria-label', 'Orbits gravity sandbox');
        canvas.setAttribute('role', 'application');
        canvas.setAttribute('tabindex', '0');
        root.appendChild(canvas);

        // Body-count display floats top-right, on its own.
        // Default text is overwritten by the first onPlanetCountChange call;
        // we still render plausible values to avoid a "0/0" flash on mount.
        const counter = document.createElement('div');
        counter.className = 'wos-orbits-count';
        counter.setAttribute('aria-live', 'polite');
        counter.innerHTML = `
            <span class="wos-orbits-hud-label">Bodies</span>
            <span class="wos-orbits-count-num">
                <span id="orbits-count">0</span><span class="wos-orbits-count-sep">/</span><span id="orbits-max">8</span>
            </span>
        `;
        root.appendChild(counter);

        // HUD — keyboard-shaped controls. Every button shows the actual key
        // glyph it mirrors, so the on-screen ↔ keyboard mapping is explicit.
        const hud = document.createElement('div');
        hud.className = 'wos-orbits-hud';
        hud.innerHTML = `
            <div class="wos-orbits-hud-group">
                <button class="wos-orbits-key" data-action="sun-down" aria-label="Smaller sun (down arrow)">↓</button>
                <input class="wos-orbits-slider" id="orbits-sun" type="range"
                    min="8000" max="200000" step="2000" value="60000"
                    aria-label="Sun mass">
                <button class="wos-orbits-key" data-action="sun-up" aria-label="Bigger sun (up arrow)">↑</button>
            </div>
            <div class="wos-orbits-hud-group">
                <button class="wos-orbits-key" data-action="time-down" aria-label="Slower time (left arrow)">←</button>
                <input class="wos-orbits-slider" id="orbits-time" type="range"
                    min="0" max="2" step="0.05" value="1"
                    aria-label="Time scale">
                <button class="wos-orbits-key" data-action="time-up" aria-label="Faster time (right arrow)">→</button>
            </div>
            <div class="wos-orbits-hud-actions">
                <button class="wos-orbits-key" data-action="launch" aria-label="Launch (Space)">␣</button>
                <button class="wos-orbits-key" data-action="remove" aria-label="Remove body (key R)">R</button>
            </div>
        `;
        root.appendChild(hud);

        // Size canvas to fill the app root (HUD overlays the bottom edge).
        function sizeCanvas() {
            const rect = root.getBoundingClientRect();
            canvas.width = Math.round(rect.width);
            canvas.height = Math.round(rect.height);
        }
        sizeCanvas();

        const ro = new ResizeObserver(sizeCanvas);
        ro.observe(root);

        const countEl = counter.querySelector('#orbits-count');
        const maxEl = counter.querySelector('#orbits-max');

        const game = createOrbitsGame({
            canvas,
            onPlanetCountChange: (n, max) => {
                countEl.textContent = String(n);
                maxEl.textContent = String(max);
                counter.classList.toggle('is-full', n >= max);
            },
            onLaunchRejected: () => {
                // Re-trigger animations by toggling each class off → reflow → on.
                counter.classList.remove('is-rejected');
                void counter.offsetWidth;
                counter.classList.add('is-rejected');

                root.classList.remove('is-shaking');
                void root.offsetWidth;
                root.classList.add('is-shaking');
            },
        });
        const api = game.api;
        game.start();

        // Opening chime — three sines bloom up through a filter sweep.
        Audio.unlock();
        Audio.emerge(0.55);

        // ── Keyboard ──
        // ↑/↓ adjust sun mass.  ←/→ adjust time scale.
        // Space: spawn a new planet on a random stable orbit.
        // R: remove the most recent body.
        function onKeyDown(e) {
            const k = e.key;
            let handled = false;
            if      (k === 'ArrowUp')    { api.adjustSunMass(1.111); syncSliders(); Audio.swirl(); handled = true; }
            else if (k === 'ArrowDown')  { api.adjustSunMass(0.9);   syncSliders(); Audio.swirl(); handled = true; }
            else if (k === 'ArrowLeft')  { api.adjustTimeScale(-0.2); syncSliders(); Audio.swirl(); handled = true; }
            else if (k === 'ArrowRight') { api.adjustTimeScale( 0.2); syncSliders(); Audio.swirl(); handled = true; }
            else if (k === ' ')          { api.launchRandom(); handled = true; }
            else if (k === 'r' || k === 'R') { api.removeLastPlanet(); handled = true; }

            if (handled) {
                e.preventDefault();
                // If the user previously mouse-dragged a HUD slider, the slider
                // still holds focus. Chrome's :focus-visible heuristic flips
                // to "keyboarding" on the first key event, which renders the
                // slider's default focus outline. Snap focus back to the
                // canvas so the HUD never wears the keyboard focus ring
                // during gameplay.
                if (document.activeElement !== canvas) {
                    canvas.focus({ preventScroll: true });
                }
            }
        }
        document.addEventListener('keydown', onKeyDown);

        // ── Pointer slingshot ──
        // Drag on empty space to slingshot-launch a new planet at the drag origin
        // with velocity proportional to the drag vector.
        function pointerPos(evt) {
            const rect = canvas.getBoundingClientRect();
            const sx = canvas.width / rect.width;
            const sy = canvas.height / rect.height;
            const clientX = evt.touches ? evt.touches[0]?.clientX : evt.clientX;
            const clientY = evt.touches ? evt.touches[0]?.clientY : evt.clientY;
            if (clientX === undefined) return null;
            return {
                x: (clientX - rect.left) * sx,
                y: (clientY - rect.top) * sy,
            };
        }

        // Pointer logic:
        //  - down on a body  → "tap to remove" gesture (no slingshot drawn)
        //  - down on empty   → begin slingshot
        //  - up within 8 px  → tap. Removes the body if we started on one.
        //  - up after drag   → completes slingshot, or cancels removal.
        let dragStart = null;
        let pendingRemoval = null;
        let slingshotActive = false;

        const TAP_THRESHOLD = 8;

        function onDown(e) {
            if (e.target && e.target.closest && e.target.closest('.wos-orbits-hud, .wos-orbits-count')) return;
            const p = pointerPos(e);
            if (!p) return;
            dragStart = p;
            pendingRemoval = api.findPlanetAt(p.x, p.y);
            if (!pendingRemoval) {
                api.beginSlingshot(p.x, p.y);
                slingshotActive = true;
            }
            e.preventDefault();
        }
        function onMove(e) {
            if (!dragStart) return;
            const p = pointerPos(e);
            if (!p) return;
            const dragDist = Math.hypot(p.x - dragStart.x, p.y - dragStart.y);
            if (pendingRemoval && dragDist > TAP_THRESHOLD) {
                // Started on a body, but they're dragging — cancel the removal.
                // We don't promote this into a slingshot mid-gesture (would feel weird).
                pendingRemoval = null;
            }
            if (slingshotActive) api.updateSlingshot(p.x, p.y);
        }
        function onUp(e) {
            if (!dragStart) return;
            const t = e.changedTouches ? e.changedTouches[0] : e;
            let releaseX = dragStart.x, releaseY = dragStart.y;
            if (t.clientX !== undefined) {
                const rect = canvas.getBoundingClientRect();
                const sx = canvas.width / rect.width;
                const sy = canvas.height / rect.height;
                releaseX = (t.clientX - rect.left) * sx;
                releaseY = (t.clientY - rect.top) * sy;
            }
            const dragDist = Math.hypot(releaseX - dragStart.x, releaseY - dragStart.y);

            if (pendingRemoval && dragDist < TAP_THRESHOLD) {
                api.removePlanet(pendingRemoval);
            } else if (slingshotActive) {
                api.endSlingshot(releaseX, releaseY);
            }

            dragStart = null;
            pendingRemoval = null;
            slingshotActive = false;
        }
        function onCancel() {
            api.cancelSlingshot();
            dragStart = null;
            pendingRemoval = null;
            slingshotActive = false;
        }
        canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        canvas.addEventListener('touchstart', onDown, { passive: false });
        canvas.addEventListener('touchmove', onMove, { passive: false });
        canvas.addEventListener('touchend', onUp);
        canvas.addEventListener('touchcancel', onCancel);

        // ── HUD wiring ──
        const sunSlider  = hud.querySelector('#orbits-sun');
        const timeSlider = hud.querySelector('#orbits-time');

        function syncSliders() {
            sunSlider.value  = api.getSunMass();
            timeSlider.value = api.getTimeScale();
        }

        sunSlider.addEventListener('input', (e) => { api.setSunMass(Number(e.target.value));  Audio.swirl(); });
        timeSlider.addEventListener('input', (e) => { api.setTimeScale(Number(e.target.value)); Audio.swirl(); });

        hud.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const a = btn.dataset.action;
            if (a === 'launch')        api.launchRandom();
            if (a === 'remove')        api.removeLastPlanet();
            if (a === 'sun-down')      { api.adjustSunMass(0.9);   syncSliders(); Audio.swirl(); }
            if (a === 'sun-up')        { api.adjustSunMass(1.111); syncSliders(); Audio.swirl(); }
            if (a === 'time-down')     { api.adjustTimeScale(-0.2); syncSliders(); Audio.swirl(); }
            if (a === 'time-up')       { api.adjustTimeScale( 0.2); syncSliders(); Audio.swirl(); }
        });

        // Grab focus so keyboard works immediately
        canvas.focus();

        return function cleanup() {
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            ro.disconnect();
            try { game.dispose(); } catch (_) {}
        };
    },

    unmount: function () {}
};
