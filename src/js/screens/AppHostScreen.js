/**
 * AppHostScreen
 * Mounts a registered app full-screen. Shell owns navigation chrome.
 */

export const AppHostScreen = (function() {
    let hostEl = null;
    let appRootEl = null;
    let activeApp = null;
    let cleanupFn = null;

    function safeCleanup() {
        // Convention: if an app returns a cleanup function from mount(), we run it,
        // and we also run app.unmount() if provided. This avoids ambiguity and leaks.
        if (typeof cleanupFn === 'function') {
            try { cleanupFn(); } catch (_) { /* ignore */ }
        }
        if (activeApp && typeof activeApp.unmount === 'function') {
            try { activeApp.unmount(); } catch (_) { /* ignore */ }
        }
        cleanupFn = null;
        activeApp = null;
    }

    return {
        mount: function(ctx) {
            const root = ctx && ctx.root;
            const nav = ctx && ctx.nav;
            const apps = ctx && ctx.apps;
            const appId = ctx && ctx.appId;
            if (!root || !apps) return;

            hostEl = document.createElement('div');
            hostEl.className = 'wos-app-host';
            appRootEl = document.createElement('div');
            appRootEl.className = 'wos-app-root';
            hostEl.appendChild(appRootEl);
            root.replaceChildren(hostEl);

            const app = apps.get(appId);
            if (!app) {
                appRootEl.className = 'wos-app-placeholder';
                appRootEl.innerHTML = `
                    <div class="wos-app-placeholder-title">Oops!</div>
                    <div class="wos-app-placeholder-text">That app isn’t here yet.</div>
                `;
                return;
            }

            activeApp = app;
            try {
                const maybeCleanup = app.mount({ root: appRootEl, nav });
                cleanupFn = typeof maybeCleanup === 'function' ? maybeCleanup : null;
            } catch (_) {
                appRootEl.className = 'wos-app-placeholder';
                appRootEl.innerHTML = `
                    <div class="wos-app-placeholder-title">Uh oh!</div>
                    <div class="wos-app-placeholder-text">This app had a little problem starting.</div>
                `;
                activeApp = null;
                cleanupFn = null;
            }
        },

        unmount: function() {
            safeCleanup();
            if (hostEl && hostEl.parentNode) {
                try { hostEl.parentNode.removeChild(hostEl); } catch (_) { /* ignore */ }
            }
            hostEl = null;
            appRootEl = null;
        }
    };
})();


