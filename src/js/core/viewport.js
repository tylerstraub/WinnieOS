/**
 * WinnieOS Viewport Scaling System
 * 
 * Fits the current reference-resolution canvas into the real device viewport.
 *
 * Canonical rule:
 * - The canvas keeps a stable internal coordinate system (reference resolution).
 * - We apply a uniform scale-to-fit transform (letterbox/pillarbox as needed).
 *
 * Reference resolution source of truth:
 * - Prefer WinnieOS.Display.getReferenceSize() if available.
 * - Fallback to CSS variables --ref-width / --ref-height.
 */

import { Display } from './display.js';

let canvas = null;
let rafId = null;
let initialized = false;
let visualViewportTarget = null;

function getCanvas() {
    if (!canvas) {
        canvas = document.getElementById('winnieos-canvas');
    }
    return canvas;
}

function getReferenceSize() {
    if (Display && typeof Display.getReferenceSize === 'function') {
        const ref = Display.getReferenceSize();
        if (ref && Number.isFinite(ref.width) && Number.isFinite(ref.height) && ref.width > 0 && ref.height > 0) {
            return { width: ref.width, height: ref.height };
        }
    }

    const cs = window.getComputedStyle(document.documentElement);
    // Computed values are typically like "1280px". parseFloat handles both "1280" and "1280px".
    const w = parseFloat(cs.getPropertyValue('--ref-width'));
    const h = parseFloat(cs.getPropertyValue('--ref-height'));
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        return { width: Math.round(w), height: Math.round(h) };
    }

    return { width: 1280, height: 800 };
}

function getViewportSize() {
    // Prefer VisualViewport when available (better behavior on mobile + zoom)
    const vv = window.visualViewport;
    if (vv && typeof vv.width === 'number' && typeof vv.height === 'number') {
        return {
            width: vv.width,
            height: vv.height,
            offsetLeft: vv.offsetLeft || 0,
            offsetTop: vv.offsetTop || 0
        };
    }

    return {
        width: window.innerWidth,
        height: window.innerHeight,
        offsetLeft: 0,
        offsetTop: 0
    };
}

function applyScale() {
    const canvasElement = getCanvas();
    if (!canvasElement) return;

    const ref = getReferenceSize();
    const REF_WIDTH = ref.width;
    const REF_HEIGHT = ref.height;

    const vp = getViewportSize();
    const vw = vp.width;
    const vh = vp.height;

    // Single rule everywhere: scale-to-fit while preserving aspect ratio.
    // The reference "locks" naturally at scale=1 when viewport exactly matches the current reference size.
    const scale = Math.min(vw / REF_WIDTH, vh / REF_HEIGHT);
    const scaledWidth = REF_WIDTH * scale;
    const scaledHeight = REF_HEIGHT * scale;

    // Snap position to whole pixels to reduce subpixel blur/jitter.
    const left = Math.round(vp.offsetLeft + (vw - scaledWidth) / 2);
    const top = Math.round(vp.offsetTop + (vh - scaledHeight) / 2);

    // Keep the internal coordinate system stable: always REF_WIDTH x REF_HEIGHT (the active reference size).
    canvasElement.style.position = 'fixed';
    canvasElement.style.width = REF_WIDTH + 'px';
    canvasElement.style.height = REF_HEIGHT + 'px';
    canvasElement.style.left = left + 'px';
    canvasElement.style.top = top + 'px';
    canvasElement.style.margin = '0';
    canvasElement.style.padding = '0';
    canvasElement.style.transformOrigin = 'top left';
    // Avoid giant float strings in DOM attributes/styles.
    const scaleStr = String(roundScale(scale));
    canvasElement.style.transform = `scale(${scaleStr})`;

    // Expose scale for debugging / future utilities.
    canvasElement.dataset.scale = scaleStr;
    canvasElement.dataset.vw = String(Math.round(vw));
    canvasElement.dataset.vh = String(Math.round(vh));
    canvasElement.dataset.left = String(left);
    canvasElement.dataset.top = String(top);
    document.documentElement.style.setProperty('--viewport-scale', scaleStr);
}

function scheduleUpdate() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(function() {
        rafId = null;
        applyScale();
    });
}

function roundScale(n) {
    return Math.round(n * 100000) / 100000;
}

export const Viewport = {
    init: function() {
        if (initialized) return;
        if (!getCanvas()) return;
        initialized = true;

        scheduleUpdate();
        window.addEventListener('resize', scheduleUpdate);
        document.addEventListener('winnieos:displaychange', scheduleUpdate);

        // VisualViewport can change via pinch-zoom / virtual keyboard on some devices.
        if (window.visualViewport) {
            visualViewportTarget = window.visualViewport;
            visualViewportTarget.addEventListener('resize', scheduleUpdate);
            visualViewportTarget.addEventListener('scroll', scheduleUpdate);
        }
    },
    
    getScale: function() {
        const el = getCanvas();
        return el ? parseFloat(el.dataset.scale || '1') : 1;
    },
    
    getReferenceSize: function() {
        return getReferenceSize();
    },

    getMetrics: function() {
        const ref = getReferenceSize();
        const vp = getViewportSize();
        const el = getCanvas();
        const scale = el
            ? parseFloat(el.dataset.scale || '1')
            : roundScale(Math.min(vp.width / ref.width, vp.height / ref.height));
        return {
            reference: { width: ref.width, height: ref.height },
            viewport: { width: vp.width, height: vp.height, offsetLeft: vp.offsetLeft || 0, offsetTop: vp.offsetTop || 0 },
            scale
        };
    },

    refresh: function() {
        scheduleUpdate();
    },

    /**
     * For development/testing only.
     * Helps Vitest reset module-level state without relying on module reload semantics.
     */
    _resetForTests: function() {
        // Remove listeners if they were added.
        if (initialized) {
            window.removeEventListener('resize', scheduleUpdate);
            document.removeEventListener('winnieos:displaychange', scheduleUpdate);

            if (visualViewportTarget) {
                visualViewportTarget.removeEventListener('resize', scheduleUpdate);
                visualViewportTarget.removeEventListener('scroll', scheduleUpdate);
            }
        }

        // Cancel pending animation frame work (if any).
        if (rafId && typeof window.cancelAnimationFrame === 'function') {
            try { window.cancelAnimationFrame(rafId); } catch (_) { /* ignore */ }
        }

        initialized = false;
        rafId = null;
        canvas = null;
        visualViewportTarget = null;
    }
};

// Attach to window namespace for compatibility
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Viewport = Viewport;
}

