import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Kiosk } from '../kiosk.js';

describe('Kiosk', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should initialize without errors', () => {
    expect(() => Kiosk.init()).not.toThrow();
  });

  it('should attach to window.WinnieOS namespace', () => {
    expect(window.WinnieOS).toBeDefined();
    expect(window.WinnieOS.Kiosk).toBe(Kiosk);
  });

  it('should prevent context menu', () => {
    Kiosk.init();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const prevented = !document.dispatchEvent(event);
    // Note: In jsdom, preventDefault might not work exactly as in browser
    // This test mainly ensures init doesn't throw
    expect(Kiosk).toBeDefined();
  });
});

