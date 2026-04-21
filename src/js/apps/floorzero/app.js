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
            root.appendChild(iframe);
        }

        if (navigator.onLine === false) {
            showOffline();
            onlineHandler = function() { showGame(); };
            window.addEventListener('online', onlineHandler);
        } else {
            showGame();
        }

        return function cleanup() {
            if (onlineHandler) {
                window.removeEventListener('online', onlineHandler);
                onlineHandler = null;
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
