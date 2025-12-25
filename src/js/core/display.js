/**
 * WinnieOS Display System (Reference Resolution Owner)
 *
 * Purpose:
 * - Own the "virtual computer" reference resolution (design coordinate system).
 * - Persist user-selected reference resolution for future sessions.
 * - Apply reference values to CSS custom properties (tokens) so CSS stays consistent.
 * - Broadcast changes so other systems (Viewport, UI, etc.) can react.
 *
 * NOTE:
 * - The app should be *designed* in one reference coordinate system at a time.
 * - Viewport scaling is responsible for fitting that reference canvas into the real device viewport.
 */

const STORAGE_KEY = 'winnieos.display.reference';
const FALLBACK_REFERENCE = { width: 1280, height: 800 };

let reference = null;

function parsePx(value) {
    if (value == null) return null;
    const str = String(value).trim();
    if (!str) return null;
    const match = str.match(/^([0-9.]+)px$/i);
    if (!match) return null;
    const num = Number(match[1]);
    return Number.isFinite(num) ? num : null;
}

function clampInt(n, min, max) {
    const x = Math.round(Number(n));
    if (!Number.isFinite(x)) return null;
    return Math.min(max, Math.max(min, x));
}

function isValidReference(ref) {
    return !!ref &&
        Number.isFinite(ref.width) && Number.isFinite(ref.height) &&
        ref.width >= 320 && ref.height >= 240 &&
        ref.width <= 7680 && ref.height <= 4320;
}

function readDefaultFromCss() {
    const root = document.documentElement;
    const cs = window.getComputedStyle(root);
    const w = parsePx(cs.getPropertyValue('--ref-width'));
    const h = parsePx(cs.getPropertyValue('--ref-height'));
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        return { width: Math.round(w), height: Math.round(h) };
    }
    return null;
}

function readPersisted() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const width = clampInt(parsed.width, 320, 7680);
        const height = clampInt(parsed.height, 240, 4320);
        const ref = { width, height };
        return isValidReference(ref) ? ref : null;
    } catch (_) {
        return null;
    }
}

function persist(ref) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ref));
    } catch (_) {
        // ignore (storage may be unavailable in some kiosk/lockdown scenarios)
    }
}

function clearPersisted() {
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
        // ignore
    }
}

function applyToCss(ref) {
    const root = document.documentElement;
    root.style.setProperty('--ref-width', ref.width + 'px');
    root.style.setProperty('--ref-height', ref.height + 'px');
    root.style.setProperty('--ref-aspect-ratio', String(ref.width / ref.height));

    // Helpful for debugging / QA screenshots.
    root.dataset.refWidth = String(ref.width);
    root.dataset.refHeight = String(ref.height);
}

function broadcast(ref) {
    try {
        const evt = new CustomEvent('winnieos:displaychange', {
            detail: { reference: { width: ref.width, height: ref.height } }
        });
        document.dispatchEvent(evt);
    } catch (_) {
        // ignore
    }
}

function ensureInitialized() {
    if (reference) return;
    reference = readPersisted() || readDefaultFromCss() || FALLBACK_REFERENCE;
    applyToCss(reference);
}

export const Display = {
    init: function() {
        ensureInitialized();
        broadcast(reference);
    },

    getReferenceSize: function() {
        ensureInitialized();
        return { width: reference.width, height: reference.height };
    },

    /**
     * Set the app's reference resolution (virtual computer resolution).
     * @param {{width:number, height:number, persist?:boolean}} next
     */
    setReferenceSize: function(next) {
        ensureInitialized();

        const width = clampInt(next && next.width, 320, 7680);
        const height = clampInt(next && next.height, 240, 4320);
        const ref = { width, height };
        if (!isValidReference(ref)) return false;

        reference = ref;
        applyToCss(reference);

        const shouldPersist = !next || next.persist !== false;
        if (shouldPersist) persist(reference);

        broadcast(reference);
        return true;
    },

    resetReferenceSize: function() {
        reference = readDefaultFromCss() || FALLBACK_REFERENCE;
        clearPersisted();
        applyToCss(reference);
        broadcast(reference);
    }
};

// Attach to window namespace for compatibility
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Display = Display;
}

