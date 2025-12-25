/**
 * WinnieOS Runtime Config (frontend)
 *
 * The server exposes a safe, merged subset of config at `/winnieos-config.json`.
 * In dev, Vite serves the same endpoint via middleware.
 */

let cached = null;
let inFlight = null;

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithTimeout(url, timeoutMs) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
        const res = await fetch(url, { cache: 'no-store', signal: controller ? controller.signal : undefined });
        if (!res.ok) return null;
        return await res.json();
    } catch (_) {
        return null;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

export const RuntimeConfig = {
    /**
     * Load runtime config once (cached).
     * Returns null if unavailable.
     */
    load: async function() {
        if (cached) return cached;
        if (inFlight) return inFlight;

        inFlight = (async () => {
            // Startup hardening:
            // On slower boots, the frontend can request config before the server is fully ready.
            // If we fail once and immediately fall back, the UI can appear to "ignore" default.json.
            // Retry for a few seconds before giving up.
            const attempts = [
                { timeoutMs: 1500, sleepMs: 250 },
                { timeoutMs: 1500, sleepMs: 250 },
                { timeoutMs: 2000, sleepMs: 500 },
                { timeoutMs: 2500, sleepMs: 750 }
            ];

            let cfg = null;
            for (let i = 0; i < attempts.length; i++) {
                const a = attempts[i];
                cfg = await fetchJsonWithTimeout('/winnieos-config.json', a.timeoutMs);
                if (cfg && typeof cfg === 'object') break;
                if (a.sleepMs) await delay(a.sleepMs);
            }

            // Only cache if we got a valid config object (not null/undefined).
            // This allows retry on later calls if startup is still in flux.
            cached = (cfg && typeof cfg === 'object') ? cfg : null;
            inFlight = null;
            return cached;
        })();

        return inFlight;
    },
    /**
     * Clear the config cache and force a fresh load on next call.
     * Useful when config may have changed or when initial load may have failed.
     */
    clearCache: function() {
        cached = null;
        inFlight = null;
    }
};

// Attach to window namespace for compatibility/debugging
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Config = RuntimeConfig;
}


