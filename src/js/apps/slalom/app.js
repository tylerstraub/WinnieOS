/**
 * Jet Slalom (Game)
 *
 * A gentle space jet slalom — steer left/right to dodge
 * colorful diamond obstacles, earn stars, enjoy candy explosions.
 *
 * Ported from JSlalom2024 "Winnie Edition" into the WinnieOS app framework.
 */

import { createSlalomGame } from '../../games/slalom/game.js';

export default {
    id: 'slalom',
    title: 'Jet',
    iconEmoji: '🚀',
    sortOrder: 20,

    mount: function({ root }) {
        if (!root) return;

        root.className = 'wos-slalom-app';
        root.innerHTML = '';

        const canvas = document.createElement('canvas');
        canvas.className = 'wos-slalom-canvas';
        canvas.setAttribute('aria-label', 'Jet Slalom game');
        canvas.setAttribute('role', 'application');
        root.appendChild(canvas);

        // Size canvas to fill the app root completely.
        // WinnieOS reference is 1280x800 (16:10) — same aspect as the game's
        // 320x200 virtual space, so no letterboxing is needed. The game's
        // DrawEnv scales all rendering from 320x200 to whatever canvas size.
        function sizeCanvas() {
            const rect = root.getBoundingClientRect();
            canvas.width = Math.round(rect.width);
            canvas.height = Math.round(rect.height);
        }
        sizeCanvas();

        const ro = new ResizeObserver(sizeCanvas);
        ro.observe(root);

        let cancelled = false;
        let game = null;

        game = createSlalomGame({ canvas });
        game.start();

        return function cleanup() {
            cancelled = true;
            ro.disconnect();
            if (game) {
                try { game.dispose(); } catch (_) {}
            }
            game = null;
        };
    },

    unmount: function() {}
};
