/**
 * Stargazer
 *
 * Winnie stands on the moon. Each "night," a constellation appears in the sky
 * one star at a time as she presses a random digit sequence on the keyboard.
 * `0` is always the climactic release key — pressing it after all stars are
 * placed connects them with luminous lines and names the constellation.
 *
 * Thin adapter around `createStargazerGame`. Owns DOM, keyboard wiring, cleanup.
 */

import { createStargazerGame } from '../../games/stargazer/game.js';
import { Audio } from '../../utils/audio.js';

export default {
    id: 'stargazer',
    title: 'Stargazer',
    iconEmoji: '🌙',
    sortOrder: 20,

    mount: function ({ root }) {
        if (!root) return;

        root.className = 'wos-stargazer-app';
        root.innerHTML = '';

        const canvas = document.createElement('canvas');
        canvas.className = 'wos-stargazer-canvas';
        canvas.setAttribute('aria-label', 'Stargazer — make constellations on the moon');
        canvas.setAttribute('role', 'application');
        canvas.setAttribute('tabindex', '0');
        root.appendChild(canvas);

        // Star count badge — top-right. Updates whenever a star is placed or a
        // constellation finishes.
        const badge = document.createElement('div');
        badge.className = 'wos-stargazer-badge';
        badge.innerHTML = `
            <span class="wos-stargazer-badge-icon">★</span>
            <span class="wos-stargazer-badge-num" id="stargazer-stars">0</span>
            <span class="wos-stargazer-badge-sep">·</span>
            <span class="wos-stargazer-badge-num" id="stargazer-cons">0</span>
            <span class="wos-stargazer-badge-icon-small">✦</span>
        `;
        root.appendChild(badge);

        // Constellation name banner — bottom-center, only visible at reveal.
        const banner = document.createElement('div');
        banner.className = 'wos-stargazer-name';
        banner.setAttribute('aria-live', 'polite');
        banner.innerHTML = `
            <span class="wos-stargazer-name-prefix">The</span>
            <span class="wos-stargazer-name-text" id="stargazer-name">—</span>
        `;
        root.appendChild(banner);

        function sizeCanvas() {
            const rect = root.getBoundingClientRect();
            canvas.width = Math.max(1, Math.round(rect.width));
            canvas.height = Math.max(1, Math.round(rect.height));
        }
        sizeCanvas();
        const ro = new ResizeObserver(sizeCanvas);
        ro.observe(root);

        const starsEl = badge.querySelector('#stargazer-stars');
        const consEl = badge.querySelector('#stargazer-cons');
        const nameEl = banner.querySelector('#stargazer-name');

        let bannerTimer = null;

        const game = createStargazerGame({
            canvas,
            onStatsChange: (totalStars, totalCons) => {
                starsEl.textContent = String(totalStars);
                consEl.textContent = String(totalCons);
            },
            onConstellationNamed: (name) => {
                nameEl.textContent = name;
                banner.classList.add('is-visible');
                if (bannerTimer) clearTimeout(bannerTimer);
                bannerTimer = setTimeout(() => {
                    banner.classList.remove('is-visible');
                    bannerTimer = null;
                }, 3800);
            },
        });

        game.start();

        // Opening cue — soft, warm, moonlit.
        try { Audio.unlock(); } catch (_) {}
        try { Audio.emerge(0.4); } catch (_) {}

        // Keyboard: digit keys 0-9 (top row + numpad). Skip modifier combos so
        // system shortcuts like Cmd+5 pass through untouched.
        function onKeyDown(e) {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            const k = e.key;
            if (k.length === 1 && k >= '0' && k <= '9') {
                game.api.pressDigit(Number(k));
                e.preventDefault();
                if (document.activeElement !== canvas) {
                    canvas.focus({ preventScroll: true });
                }
            }
        }
        document.addEventListener('keydown', onKeyDown);

        canvas.focus();

        return function cleanup() {
            document.removeEventListener('keydown', onKeyDown);
            ro.disconnect();
            if (bannerTimer) clearTimeout(bannerTimer);
            try { game.dispose(); } catch (_) {}
        };
    },

    unmount: function () {}
};
