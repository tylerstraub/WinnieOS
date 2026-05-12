import { describe, it, expect, beforeEach } from 'vitest';
import { Display } from '../display.js';
import { Storage } from '../../utils/storage.js';

describe('Display', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.style.removeProperty('--ref-width');
        document.documentElement.style.removeProperty('--ref-height');
        document.documentElement.style.removeProperty('--ref-aspect-ratio');
        Display.init();
    });

    // The clamp policy is what keeps a typo'd config (e.g. 0x0 or 99999x99999)
    // from silently producing a broken canvas. Both bounds tested in one place.
    it.each([
        { input: { width: 100, height: 100 }, expected: { width: 320, height: 240 } },     // below min
        { input: { width: 10000, height: 10000 }, expected: { width: 7680, height: 4320 } } // above max
    ])('clamps reference size $input to allowed range', ({ input, expected }) => {
        expect(Display.setReferenceSize(input)).toBe(true);
        expect(Display.getReferenceSize()).toEqual(expected);
    });

    it('persists reference size to localStorage when persist:true', () => {
        Display.setReferenceSize({ width: 1920, height: 1080, persist: true });
        const stored = Storage.get('display.reference');
        expect(stored).toEqual({ width: 1920, height: 1080 });
    });
});
