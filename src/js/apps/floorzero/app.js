/**
 * Space (floor-zero)
 *
 * Thin adapter that embeds the WinnieRPG "winnie" client (hosted on
 * GitHub Pages at tylerstraub.github.io/floor-zero) inside WinnieOS.
 *
 * Deploys are completely decoupled: push to the floor-zero repo and
 * WinnieOS picks up the new build on the next app mount. SpacetimeDB
 * lives on Maincloud; all networking happens inside the iframe.
 *
 * Kid-friendly affordances:
 *   - Offline splash instead of Chrome's default error page, with auto
 *     retry when the kiosk reconnects.
 *   - Dark background on both the app root and iframe element so there
 *     is no white flash while the Three.js bundle boots.
 */

const GAME_URL = 'https://tylerstraub.github.io/floor-zero/?view=winnie';

export default {
    id: 'floorzero',
    title: 'Space',
    iconEmoji: '🛸',
    sortOrder: 10,

    mount: function({ root }) {
        if (!root) return;

        root.className = 'wos-floorzero-app';
        root.innerHTML = '';

        let iframe = null;
        let offlineEl = null;
        let onlineHandler = null;
        let rootPointerHandler = null;
        let windowFocusHandler = null;

        function focusFrame() {
            if (!iframe) return;
            // Cross-origin iframes on Chromium need BOTH calls. `iframe.focus()`
            // sets the parent's activeElement, but that alone does NOT activate
            // the iframe's content-level focus — its own `window.addEventListener
            // ('keydown')` listeners will silently never fire, even though
            // `document.activeElement` shows the iframe as focused. `Window.focus()`
            // is one of the few cross-origin-safe operations (alongside
            // postMessage / blur / close), and calling it on `contentWindow`
            // forces real content focus. Without it, keyboard input only comes
            // alive after the user manually blurs and refocuses the window.
            try { iframe.focus(); } catch (_) { /* ignore */ }
            try {
                const cw = iframe.contentWindow;
                if (cw && typeof cw.focus === 'function') cw.focus();
            } catch (_) { /* ignore */ }
        }

        function clearOffline() {
            if (offlineEl && offlineEl.parentNode) {
                offlineEl.parentNode.removeChild(offlineEl);
            }
            offlineEl = null;
        }

        function showOffline() {
            clearOffline();
            offlineEl = document.createElement('div');
            offlineEl.className = 'wos-floorzero-offline';
            offlineEl.innerHTML = `
                <div class="wos-floorzero-offline-icon" aria-hidden="true">🛸</div>
                <div class="wos-floorzero-offline-title">Need wifi to play!</div>
                <div class="wos-floorzero-offline-text">Ask a grown-up to check the internet.</div>
            `;
            root.appendChild(offlineEl);
        }

        function showGame() {
            if (iframe) return;
            clearOffline();
            iframe = document.createElement('iframe');
            iframe.className = 'wos-floorzero-frame';
            iframe.src = GAME_URL;
            iframe.setAttribute('title', 'Space');
            // Cross-origin iframes start with everything off; explicitly grant
            // the permissions a Three.js + audio game actually needs.
            iframe.allow = 'fullscreen; autoplay; gamepad; clipboard-read; clipboard-write';
            iframe.addEventListener('load', focusFrame);
            root.appendChild(iframe);
            focusFrame();
        }

        // Refocus on any tap inside the app area — cheap guard against focus
        // drift. The Home button lives in the shell topbar, outside `root`,
        // so this does not fight it.
        rootPointerHandler = () => focusFrame();
        root.addEventListener('pointerdown', rootPointerHandler);

        // When the top-level window regains focus (alt-tab, kiosk wake, etc.),
        // re-activate the iframe's content focus so keys keep working.
        windowFocusHandler = () => focusFrame();
        window.addEventListener('focus', windowFocusHandler);

        if (navigator.onLine === false) {
            showOffline();
            onlineHandler = () => showGame();
            window.addEventListener('online', onlineHandler);
        } else {
            showGame();
        }

        return function cleanup() {
            if (onlineHandler) {
                window.removeEventListener('online', onlineHandler);
                onlineHandler = null;
            }
            if (rootPointerHandler) {
                try { root.removeEventListener('pointerdown', rootPointerHandler); } catch (_) { /* ignore */ }
                rootPointerHandler = null;
            }
            if (windowFocusHandler) {
                try { window.removeEventListener('focus', windowFocusHandler); } catch (_) { /* ignore */ }
                windowFocusHandler = null;
            }
            if (iframe) {
                try { iframe.src = 'about:blank'; } catch (_) { /* ignore */ }
                if (iframe.parentNode) {
                    try { iframe.parentNode.removeChild(iframe); } catch (_) { /* ignore */ }
                }
                iframe = null;
            }
            clearOffline();
        };
    },

    unmount: function() {}
};
