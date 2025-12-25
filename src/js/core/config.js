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
            cached = cfg || null;
            inFlight = null;
            return cached;
        })();

        return inFlight;
    }
};

// Attach to window namespace for compatibility/debugging
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Config = RuntimeConfig;
}


