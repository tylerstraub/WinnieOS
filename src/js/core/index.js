/**
 * WinnieOS Core Initialization
 * 
 * Initializes all core systems on DOM ready
 * This is the entry point for core functionality
 */

import { Display } from './display.js';
import { Viewport } from './viewport.js';
import { Kiosk } from './kiosk.js';
import { RuntimeConfig } from './config.js';

const DISPLAY_STORAGE_KEY = 'winnieos.display.reference';

function hasPersistedDisplayReference() {
    try {
        return !!window.localStorage.getItem(DISPLAY_STORAGE_KEY);
    } catch (_) {
        return false;
    }
}

function applyDisplayDefaultsFromConfig(cfg) {
    const ref = cfg && cfg.display && cfg.display.reference;
    if (!ref) return;
    if (!Number.isFinite(ref.width) || !Number.isFinite(ref.height)) return;
    if (ref.width <= 0 || ref.height <= 0) return;

    // Config acts as the "default reference resolution" ONLY when the user hasn't persisted a preference.
    if (hasPersistedDisplayReference()) return;

    if (Display && typeof Display.setReferenceSize === 'function') {
        Display.setReferenceSize({ width: ref.width, height: ref.height, persist: false });
        return;
    }

    // Fallback if Display fails to load: apply CSS variables directly.
    const root = document.documentElement;
    root.style.setProperty('--ref-width', `${Math.round(ref.width)}px`);
    root.style.setProperty('--ref-height', `${Math.round(ref.height)}px`);
    root.style.setProperty('--ref-aspect-ratio', String(ref.width / ref.height));
}

/**
 * Initialize all core systems
 */
function init() {
    const configPromise = RuntimeConfig && typeof RuntimeConfig.load === 'function'
        ? RuntimeConfig.load()
        : Promise.resolve(null);

    // Initialize Display (reference resolution owner) first so CSS vars are set
    if (Display) {
        Display.init();
    } else {
        // Viewport can fall back to CSS tokens, but this should normally never happen
        console.warn('WinnieOS: Display module failed to load; falling back to CSS reference tokens');
    }

    // Initialize viewport scaling
    if (Viewport) {
        Viewport.init();
    } else {
        console.error('WinnieOS: Viewport module failed to load');
    }

    // Initialize kiosk protections
    if (Kiosk) {
        Kiosk.init();
    } else {
        console.error('WinnieOS: Kiosk module failed to load');
    }

    // Apply config-driven default reference resolution (non-persistent) after core is up.
    // This ensures we don't block startup, and Viewport will react via `winnieos:displaychange`.
    configPromise.then(applyDisplayDefaultsFromConfig).catch(() => {});
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

