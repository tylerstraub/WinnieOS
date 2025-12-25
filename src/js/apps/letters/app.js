/**
 * Letters (Game)
 *
 * Keyboard-first letter matching:
 * - A target glyph lives in a top-right box.
 * - Press the correct key: it pops out and falls through a pachinko board.
 * - Wrong key: gentle buzz + nudge the HUD glyph.
 *
 * This app is intentionally structured as a thin adapter around a game module
 * so future games can share scaffolding patterns.
 */

import { createLettersGame } from '../../games/letters/game.js';
import { RuntimeConfig } from '../../core/config.js';

export default {
    id: 'letters',
    title: 'Letters',
    iconEmoji: '🔤',
    sortOrder: 10,

    mount: function({ root }) {
        if (!root) return;

        root.className = 'wos-letters-app';
        root.innerHTML = '';

        const canvas = document.createElement('canvas');
        canvas.className = 'wos-letters-canvas';
        canvas.setAttribute('aria-label', 'Letters game');
        canvas.setAttribute('role', 'application');

        const hud = document.createElement('div');
        hud.className = 'wos-letters-hud';
        // Render the glyph into a canvas so it can be perfectly centered (using text metrics)
        // and outlined for clarity regardless of font rendering quirks.
        const glyphCanvas = document.createElement('canvas');
        glyphCanvas.className = 'wos-letters-glyph';
        glyphCanvas.setAttribute('aria-hidden', 'true');
        hud.appendChild(glyphCanvas);

        root.appendChild(canvas);
        root.appendChild(hud);

        // Load runtime config (safe subset) and pass app-specific config down if present.
        // We don't block mount if config isn't ready yet.
        let cancelled = false;
        let game = null;

        const start = async () => {
            let cfg = null;
            try { cfg = await RuntimeConfig.load(); } catch (_) { /* ignore */ }
            if (cancelled) return;

            const appCfg =
                cfg && cfg.apps && cfg.apps.config && typeof cfg.apps.config === 'object'
                    ? (cfg.apps.config.letters || null)
                    : null;

            game = createLettersGame({
                canvas,
                hudEl: hud,
                glyphEl: glyphCanvas,
                config: appCfg
            });
            game.start();
        };

        start();

        return function cleanup() {
            cancelled = true;
            if (game && typeof game.dispose === 'function') {
                try { game.dispose(); } catch (_) { /* ignore */ }
            }
            game = null;
        };
    },

    unmount: function() {
        // Cleanup handled by mount() return fn via AppHostScreen convention.
    }
};


