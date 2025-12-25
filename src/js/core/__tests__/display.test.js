import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Display } from '../display.js';
import { Storage } from '../../utils/storage.js';

describe('Display', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset document styles
    document.documentElement.style.removeProperty('--ref-width');
    document.documentElement.style.removeProperty('--ref-height');
    document.documentElement.style.removeProperty('--ref-aspect-ratio');
  });

  it('should initialize with default reference size', () => {
    Display.init();
    const size = Display.getReferenceSize();
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });

  it('should set and get reference size', () => {
    Display.init();
    const result = Display.setReferenceSize({ width: 1920, height: 1080 });
    expect(result).toBe(true);
    
    const size = Display.getReferenceSize();
    expect(size.width).toBe(1920);
    expect(size.height).toBe(1080);
  });

  it('should clamp invalid reference sizes to valid ranges', () => {
    Display.init();
    // Values below minimum get clamped to minimum (320x240)
    const result1 = Display.setReferenceSize({ width: 100, height: 100 });
    expect(result1).toBe(true); // Clamped to valid range
    const size1 = Display.getReferenceSize();
    expect(size1.width).toBe(320); // Clamped to minimum
    expect(size1.height).toBe(240); // Clamped to minimum
    
    // Values above maximum get clamped to maximum (7680x4320)
    const result2 = Display.setReferenceSize({ width: 10000, height: 10000 });
    expect(result2).toBe(true); // Clamped to valid range
    const size2 = Display.getReferenceSize();
    expect(size2.width).toBe(7680); // Clamped to maximum
    expect(size2.height).toBe(4320); // Clamped to maximum
  });

  it('should persist reference size to localStorage', () => {
    Display.init();
    Display.setReferenceSize({ width: 1920, height: 1080, persist: true });
    
    // Verify storage using Storage utility (consistent with implementation)
    const stored = Storage.get('display.reference');
    expect(stored).toBeTruthy();
    expect(stored.width).toBe(1920);
    expect(stored.height).toBe(1080);
  });

  it('should attach to window.WinnieOS namespace', () => {
    expect(window.WinnieOS).toBeDefined();
    expect(window.WinnieOS.Display).toBe(Display);
  });
});

