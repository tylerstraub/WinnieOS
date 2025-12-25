import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Viewport } from '../viewport.js';
import { Display } from '../display.js';

describe('Viewport', () => {
  beforeEach(() => {
    // Create a mock canvas element
    document.body.innerHTML = '<div id="winnieos-canvas"></div>';
    Display.init();
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

  it('should attach to window.WinnieOS namespace', () => {
    expect(window.WinnieOS).toBeDefined();
    expect(window.WinnieOS.Viewport).toBe(Viewport);
  });
});

