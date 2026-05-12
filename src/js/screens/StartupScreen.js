/**
 * StartupScreen
 * Simple, fun startup sequence that can later evolve into a real boot pipeline.
 */

const LOGO_SRC = (import.meta.env.BASE_URL || '/') + 'assets/images/winnieOS_logo_temp.webp';

// Cap how long the boot will wait for the logo to arrive before giving up
// and starting anyway. The asset is ~150 KB so this is only relevant on
// very slow networks; without the cap a totally failed fetch would hang.
const LOGO_PRELOAD_MAX_MS = 3000;

function preloadImage(src, maxMs) {
    return new Promise((resolve) => {
        const img = new Image();
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        img.onload = finish;
        img.onerror = finish;
        img.src = src;
        setTimeout(finish, maxMs);
    });
}

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

        // Wait for the logo to be in cache before starting the timed steps,
        // so the animation always plays with the logo visible — not just on
        // localhost where the image arrives before first paint.
        setStatus('Waking up WinnieOS');
        await preloadImage(LOGO_SRC, LOGO_PRELOAD_MAX_MS);
        if (cancelled) return;

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
                <div class="wos-startup-logo-layer">
                    <img class="wos-startup-logo" src="${LOGO_SRC}" alt="WinnieOS" />
                </div>
                <div class="wos-startup-text-layer">
                    <div class="wos-startup-status">
                        <span data-wos-startup-status>Starting up</span>
                        <span class="wos-startup-dots" aria-hidden="true">
                            <span>.</span><span>.</span><span>.</span>
                        </span>
                    </div>
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


