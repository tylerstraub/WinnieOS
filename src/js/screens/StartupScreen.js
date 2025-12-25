/**
 * StartupScreen
 * Simple, fun startup sequence that can later evolve into a real boot pipeline.
 */

const LOGO_SRC = '/assets/images/winnieOS_logo_temp.png';

export const StartupScreen = (function() {
    let rootEl = null;
    let cancelled = false;
    const timers = new Map(); // id -> resolve()

    function clearTimers() {
        timers.forEach((resolve, id) => {
            try { clearTimeout(id); } catch (_) { /* ignore */ }
            // Ensure any awaiting code can continue and observe `cancelled`.
            try { resolve(); } catch (_) { /* ignore */ }
        });
        timers.clear();
    }

    function delay(ms) {
        return new Promise((resolve) => {
            const id = setTimeout(() => {
                timers.delete(id);
                resolve();
            }, ms);
            timers.set(id, resolve);
        });
    }

    async function runBoot(nav) {
        const statusEl = rootEl ? rootEl.querySelector('[data-wos-startup-status]') : null;
        const setStatus = (txt) => {
            if (!statusEl) return;
            statusEl.textContent = txt;
        };

        // Room to grow: replace delays with real async work later (asset preload, migrations, etc.)
        const steps = [
            { label: 'Waking up WinnieOS', run: () => delay(450) },
            { label: 'Checking apps', run: () => delay(450) },
            { label: 'Almost ready', run: () => delay(450) }
        ];

        for (const step of steps) {
            if (cancelled) return;
            setStatus(step.label);
            try { await step.run(); } catch (_) { /* ignore */ }
        }

        if (cancelled) return;
        try { nav.goHome(); } catch (_) { /* ignore */ }
    }

    return {
        mount: function(ctx) {
            const root = ctx && ctx.root;
            const nav = ctx && ctx.nav;
            if (!root) return;

            cancelled = false;
            rootEl = document.createElement('div');
            rootEl.className = 'wos-startup';
            rootEl.innerHTML = `
                <img class="wos-startup-logo" src="${LOGO_SRC}" alt="WinnieOS" />
                <div class="wos-startup-title">WinnieOS</div>
                <div class="wos-startup-status">
                    <span data-wos-startup-status>Starting up</span>
                    <span class="wos-startup-dots" aria-hidden="true">
                        <span>.</span><span>.</span><span>.</span>
                    </span>
                </div>
            `;
            root.replaceChildren(rootEl);

            // Kick off async boot
            if (nav) runBoot(nav);
        },

        unmount: function() {
            cancelled = true;
            clearTimers();
            if (rootEl && rootEl.parentNode) {
                try { rootEl.parentNode.removeChild(rootEl); } catch (_) { /* ignore */ }
            }
            rootEl = null;
        }
    };
})();


