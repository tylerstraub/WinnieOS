/**
 * Jet Slalom (Game)
 *
 * A toddler-friendly space jet slalom — steer left/right to dodge
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

        // Size canvas to fill the app root at 16:10 (320x200 virtual)
        function sizeCanvas() {
            const rect = root.getBoundingClientRect();
            const aspect = 320 / 200;
            let cw, ch;
            if (rect.width / rect.height > aspect) {
                ch = rect.height;
                cw = Math.floor(ch * aspect);
            } else {
                cw = rect.width;
                ch = Math.floor(cw / aspect);
            }
            canvas.width = cw;
            canvas.height = ch;
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
