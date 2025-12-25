/**
 * DesktopScreen
 * Scrollable, touch-first list of registered apps.
 */

import { Audio } from '../utils/audio.js';

export const DesktopScreen = (function() {
    let rootEl = null;
    let cleanup = null;

    function playAfterUnlock(fn) {
        try {
            if (Audio && typeof Audio.isUnlocked === 'function' && Audio.isUnlocked()) {
                try { fn(); } catch (_) { /* ignore */ }
                return;
            }
            if (Audio && typeof Audio.unlock === 'function') {
                Audio.unlock().then(() => {
                    try { fn(); } catch (_) { /* ignore */ }
                }).catch(() => {});
            }
        } catch (_) { /* ignore */ }
    }

    function renderAppTile(app, nav) {
        const btn = document.createElement('button');
        btn.className = 'wos-app-tile';
        btn.type = 'button';
        btn.setAttribute('aria-label', app.title);
        btn.addEventListener('click', () => {
            // App launch cue (matches Letters "launch" energy)
            playAfterUnlock(() => Audio.launch(0.80));
            nav.openApp(app.id);
        });

        if (app.iconSrc) {
            const img = document.createElement('img');
            img.className = 'wos-app-icon';
            img.alt = '';
            img.src = app.iconSrc;
            btn.appendChild(img);
        } else {
            const emoji = document.createElement('div');
            emoji.className = 'wos-app-emoji';
            emoji.textContent = app.iconEmoji || '⭐';
            btn.appendChild(emoji);
        }

        const title = document.createElement('div');
        title.className = 'wos-app-title';
        title.textContent = app.title;
        btn.appendChild(title);
        return btn;
    }

    function renderDesktop(root, nav, apps) {
        // Clean up previous render
        if (cleanup) {
            try { cleanup(); } catch (_) { /* ignore */ }
        }

        const list = apps.list();

        rootEl = document.createElement('div');
        rootEl.className = 'wos-desktop';

        const inner = document.createElement('div');
        inner.className = 'wos-desktop-inner';

        const grid = document.createElement('div');
        grid.className = 'wos-app-grid';

        list.forEach((app) => {
            grid.appendChild(renderAppTile(app, nav));
        });

        inner.appendChild(grid);
        rootEl.appendChild(inner);
        root.replaceChildren(rootEl);

        const recalcCentering = () => {
            if (!rootEl) return;
            const cs = getComputedStyle(rootEl);
            const pt = parseFloat(cs.paddingTop) || 0;
            const pb = parseFloat(cs.paddingBottom) || 0;
            const available = Math.max(0, rootEl.clientHeight - pt - pb);
            const content = grid.getBoundingClientRect().height;

            if (content > 0 && content < available) {
                rootEl.classList.add('wos-desktop--centered');
            } else {
                rootEl.classList.remove('wos-desktop--centered');
            }
        };

        // After DOM paints, decide whether we should vertically center the grid.
        const raf = requestAnimationFrame(recalcCentering);
        window.addEventListener('resize', recalcCentering);
        cleanup = () => {
            try { cancelAnimationFrame(raf); } catch (_) { /* ignore */ }
            window.removeEventListener('resize', recalcCentering);
        };
    }

    return {
        mount: async function(ctx) {
            const root = ctx && ctx.root;
            const nav = ctx && ctx.nav;
            const apps = ctx && ctx.apps;
            if (!root || !nav || !apps) return;

            // CRITICAL: Wait for config to load before rendering to avoid race condition
            // If Apps.list() is called before config loads, it returns ALL apps (backward compatible fallback)
            // We need to ensure config is loaded so filtering works correctly
            if (apps.refreshConfig && typeof apps.refreshConfig === 'function') {
                try {
                    // Wait for config to load (or reload if already loaded)
                    await apps.refreshConfig();
                } catch (err) {
                    // Config load failed - log warning but continue (backward compatible)
                    console.warn('DesktopScreen: Failed to load config, using safe defaults', err);
                }
            }

            // Now render with filtered app list (config should be loaded)
            renderDesktop(root, nav, apps);
        },

        unmount: function() {
            if (cleanup) {
                try { cleanup(); } catch (_) { /* ignore */ }
            }
            cleanup = null;
            if (rootEl && rootEl.parentNode) {
                try { rootEl.parentNode.removeChild(rootEl); } catch (_) { /* ignore */ }
            }
            rootEl = null;
        }
    };
})();


