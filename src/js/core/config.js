/**
 * WinnieOS Runtime Config (frontend)
 *
 * The server exposes a safe, merged subset of config at `/winnieos-config.json`.
 * In dev, Vite serves the same endpoint via middleware.
 */

let cached = null;
let inFlight = null;

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
            const cfg = await fetchJsonWithTimeout('/winnieos-config.json', 750);
            // Only cache if we got a valid config object (not null/undefined)
            // This allows retries if the initial fetch fails
            if (cfg && typeof cfg === 'object') {
                cached = cfg;
            } else {
                // Don't cache null - allow retry on next call
                cached = null;
            }
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


