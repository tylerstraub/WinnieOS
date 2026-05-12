import { describe, it, expect, beforeEach } from 'vitest';
import { Storage } from '../storage.js';

describe('Storage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    // One representative round-trip per JSON-serializable shape covers the only
    // real code path (JSON.stringify on the way in, JSON.parse on the way out).
    it.each([
        ['string', 'hello'],
        ['number', 42],
        ['array', [1, 2, 3]],
        ['nested object', { nested: { data: [1, 2, { deep: 'value' }] } }]
    ])('round-trips %s values via JSON', (_label, value) => {
        Storage.set('round.trip', value);
        expect(Storage.get('round.trip')).toEqual(value);
    });

    it('returns the provided default when key is missing', () => {
        expect(Storage.get('nonexistent.key', 'fallback')).toBe('fallback');
        expect(Storage.get('nonexistent.key')).toBeNull();
    });

    it('prefixes keys with "winnieos." in localStorage', () => {
        Storage.set('test.key', 'value');
        expect(JSON.parse(localStorage.getItem('winnieos.test.key'))).toBe('value');
    });

    it('does not double-prefix keys that already start with "winnieos."', () => {
        Storage.set('winnieos.already.prefixed', 'value');
        expect(JSON.parse(localStorage.getItem('winnieos.already.prefixed'))).toBe('value');
        expect(localStorage.getItem('winnieos.winnieos.already.prefixed')).toBeNull();
    });

    it('clears only WinnieOS keys, leaving foreign keys intact', () => {
        Storage.set('mine.a', 1);
        Storage.set('mine.b', 2);
        localStorage.setItem('foreign.key', 'should remain');

        Storage.clear();

        expect(Storage.has('mine.a')).toBe(false);
        expect(Storage.has('mine.b')).toBe(false);
        expect(localStorage.getItem('foreign.key')).toBe('should remain');
    });

    it('throws on invalid keys', () => {
        expect(() => Storage.get(null)).toThrow('Storage key must be');
        expect(() => Storage.set('', 'value')).toThrow('Storage key must be');
    });
});
