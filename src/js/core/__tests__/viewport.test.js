import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Viewport } from '../viewport.js';
import { Display } from '../display.js';

describe('Viewport', () => {
    let originalRAF;
    let originalVisualViewportDescriptor;

    beforeEach(() => {
        document.body.innerHTML = '<div id="winnieos-canvas"></div>';

        // Make requestAnimationFrame deterministic but still async-like.
        // Viewport's scheduling assumes the callback runs after the id is stored.
        vi.useFakeTimers();
        originalRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = (cb) => setTimeout(cb, 0);

        // Viewport prefers VisualViewport when present; in jsdom it can have
        // values that don't track innerWidth/innerHeight, so force it off.
        originalVisualViewportDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport');
        Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true, writable: true });

        Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true, writable: true });
        Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true });

        Display.init();
        Viewport._resetForTests();
    });

    afterEach(() => {
        if (originalRAF) window.requestAnimationFrame = originalRAF;
        if (originalVisualViewportDescriptor) {
            Object.defineProperty(window, 'visualViewport', originalVisualViewportDescriptor);
        } else {
            try { delete window.visualViewport; } catch (_) { /* ignore */ }
        }
        vi.useRealTimers();
    });

    // The single most load-bearing invariant in WinnieOS: every pixel of UI is
    // designed at the reference resolution and scaled uniformly via this math.
    // Get this wrong and the whole canvas is the wrong size or off-center.
    it('scales to fit viewport while preserving aspect ratio', () => {
        // Reference 1280x800 into viewport 1024x768:
        // scale = min(1024/1280=0.8, 768/800=0.96) = 0.8
        Display.setReferenceSize({ width: 1280, height: 800, persist: false });
        window.innerWidth = 1024;
        window.innerHeight = 768;

        Viewport.init();
        Viewport.refresh();
        vi.runAllTimers();

        const el = document.getElementById('winnieos-canvas');
        expect(el.style.width).toBe('1280px');
        expect(el.style.height).toBe('800px');
        expect(el.style.transform).toBe('scale(0.8)');

        // Centered: scaled width = 1024, left = 0; scaled height = 640, top = (768-640)/2 = 64
        expect(el.style.left).toBe('0px');
        expect(el.style.top).toBe('64px');
        expect(el.dataset.scale).toBe('0.8');
    });
});
