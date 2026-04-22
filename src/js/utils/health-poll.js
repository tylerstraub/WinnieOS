/**
 * Health poll: detect server-side deploys and reload the page.
 *
 * On deploy, the server restarts with a new git SHA. Instead of the deploy
 * script killing Chromium (which causes a visible black flash on the kiosk),
 * this already-loaded page polls /healthz and self-reloads when it sees a
 * new version — Chromium keeps its window, and the kiosk transitions
 * seamlessly to the new build.
 */

const POLL_INTERVAL_MS = 5000;

async function fetchVersion() {
    try {
        const res = await fetch('/healthz', { cache: 'no-store' });
        if (!res.ok) return null;
        const data = await res.json();
        return typeof data.version === 'string' ? data.version : null;
    } catch (_) {
        return null;
    }
}

async function start() {
    const initialVersion = await fetchVersion();
    if (!initialVersion) return; // server not reachable or /healthz unavailable — give up quietly

    setInterval(async () => {
        const current = await fetchVersion();
        if (current && current !== initialVersion) {
            window.location.reload();
        }
    }, POLL_INTERVAL_MS);
}

start();
