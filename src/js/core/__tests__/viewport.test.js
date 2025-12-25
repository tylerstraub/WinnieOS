import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Viewport } from '../viewport.js';
import { Display } from '../display.js';

describe('Viewport', () => {
  let originalRAF;
  let originalVisualViewportDescriptor;

  beforeEach(() => {
    // Create a mock canvas element
    document.body.innerHTML = '<div id="winnieos-canvas"></div>';

    // Make requestAnimationFrame deterministic but still async-like.
    // Viewport’s scheduling assumes the callback runs after the id is stored.
    vi.useFakeTimers();
    originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => setTimeout(cb, 0);

    // Ensure tests are deterministic: Viewport prefers VisualViewport when present.
    // In jsdom, visualViewport may exist with values that don't track innerWidth/innerHeight.
    originalVisualViewportDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true, writable: true });

    // Ensure we can override innerWidth/innerHeight in jsdom.
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true });

    Display.init();
    Viewport._resetForTests();
  });

  afterEach(() => {
    // Restore global overrides to avoid cross-test leakage.
    if (originalRAF) window.requestAnimationFrame = originalRAF;
    if (originalVisualViewportDescriptor) {
      Object.defineProperty(window, 'visualViewport', originalVisualViewportDescriptor);
    } else {
      // If the property didn't exist originally, best effort delete.
      try { delete window.visualViewport; } catch (_) { /* ignore */ }
    }
    vi.useRealTimers();
  });

  it('should initialize without errors', () => {
    expect(() => Viewport.init()).not.toThrow();
  });

  it('should get reference size', () => {
    Display.setReferenceSize({ width: 1280, height: 800 });
    const size = Viewport.getReferenceSize();
    expect(size.width).toBe(1280);
    expect(size.height).toBe(800);
  });

  it('should scale to fit viewport while preserving aspect ratio', () => {
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

  it('should be idempotent (init can be called multiple times safely)', () => {
    Display.setReferenceSize({ width: 1280, height: 800, persist: false });
    Viewport.init();
    Viewport.init();
    Viewport.refresh();
    vi.runAllTimers();

    const metrics = Viewport.getMetrics();
    expect(metrics.reference.width).toBe(1280);
    expect(metrics.reference.height).toBe(800);
    expect(metrics.scale).toBe(1);
  });

  it('should attach to window.WinnieOS namespace', () => {
    expect(window.WinnieOS).toBeDefined();
    expect(window.WinnieOS.Viewport).toBe(Viewport);
  });
});

