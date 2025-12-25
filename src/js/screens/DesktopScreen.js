/**
 * DesktopScreen
 * Scrollable, touch-first list of registered apps.
 */

export const DesktopScreen = (function() {
    let rootEl = null;
    let cleanup = null;

    function renderAppTile(app, nav) {
        const btn = document.createElement('button');
        btn.className = 'wos-app-tile';
        btn.type = 'button';
        btn.setAttribute('aria-label', app.title);
        btn.addEventListener('click', () => nav.openApp(app.id));

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
        mount: function(ctx) {
            const root = ctx && ctx.root;
            const nav = ctx && ctx.nav;
            const apps = ctx && ctx.apps;
            if (!root || !nav || !apps) return;

            // Render immediately with current app list
            renderDesktop(root, nav, apps);

            // Ensure config loads and re-render if app list changes (config filters apps)
            // This handles the race condition where DesktopScreen mounts before config loads
            const initialCount = apps.list().length;
            if (apps.refreshConfig && typeof apps.refreshConfig === 'function') {
                // Trigger config refresh - this will reload config if not already loaded
                // If already loaded, it will reload the same config (acceptable for correctness)
                apps.refreshConfig().then(() => {
                    // Config loaded - check if app list changed and re-render if needed
                    if (rootEl && rootEl.parentNode === root) {
                        const newCount = apps.list().length;
                        if (newCount !== initialCount) {
                            // App list changed (config filtered apps) - re-render
                            renderDesktop(root, nav, apps);
                        }
                    }
                }).catch(() => {
                    // Config load failed - keep current render (backward compatible)
                });
            }
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


