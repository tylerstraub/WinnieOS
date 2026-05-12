/**
 * Health poll: detect server-side deploys and reload the page.
 *
 * On deploy, the server restarts with a new git SHA. Instead of the deploy
 * script killing Chromium (which causes a visible black flash on the kiosk),
 * this already-loaded page polls /healthz and self-reloads when it sees a
 * new version — Chromium keeps its window, and the kiosk transitions
 * seamlessly to the new build.
 *
 * Two invariants that prevent a reload-storm:
 *   1. knownVersion is captured (awaited) BEFORE any tick can fire, so the
 *      first comparison always has a real value on both sides.
 *   2. Ticks self-schedule via setTimeout after each completes — never
 *      setInterval — so a slow server can't stack overlapping requests.
 * If the initial capture fails, we abandon the poll entirely rather than
 * risk a spurious reload.
 */

const POLL_INTERVAL_MS = 5000;

// Resolve under Vite's base so the same source works at both the kiosk's
// root ('/') and at a GitHub Pages subpath ('/WinnieOS/'). On Pages there
// is no /healthz at all — the 404 surfaces here as a thrown error, the
// initial fetchVersion() catch below abandons the poll, and the kiosk's
// deploy-reload behavior is unaffected.
const HEALTH_URL = (import.meta.env.BASE_URL || '/') + 'healthz';

async function fetchVersion() {
    const res = await fetch(HEALTH_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`healthz ${res.status}`);
    const data = await res.json();
    if (typeof data.version !== 'string' || !data.version) {
        throw new Error('healthz missing version');
    }
    return data.version;
}

async function startHealthPoll() {
    let knownVersion;
    try {
        knownVersion = await fetchVersion();
    } catch (_) {
        // /healthz unreachable at startup — abandon the poll rather than reload-loop.
        return;
    }

    const tick = async () => {
        try {
            const version = await fetchVersion();
            if (version !== knownVersion) {
                window.location.reload();
                return;
            }
        } catch (_) {
            // Transient failure; try again next tick.
        }
        setTimeout(tick, POLL_INTERVAL_MS);
    };

    setTimeout(tick, POLL_INTERVAL_MS);
}

// Defer until after the app's initial paint so the poll can't race with
// page parsing or the startup boot animation.
if (document.readyState === 'complete') {
    startHealthPoll();
} else {
    window.addEventListener('load', startHealthPoll, { once: true });
}
