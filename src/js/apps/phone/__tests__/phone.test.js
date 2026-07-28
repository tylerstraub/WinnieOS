import { afterEach, describe, expect, it, vi } from 'vitest';
import PhoneApp, {
    FAMILY_CONTACTS,
    PRETEND_CALLERS,
    choosePretendCaller,
    formatPhoneNumber
} from '../app.js';

afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
});

describe('Pretend Phone helpers', () => {
    it('formats a growing number in easy-to-read groups', () => {
        expect(formatPhoneNumber('')).toBe('');
        expect(formatPhoneNumber('123')).toBe('123');
        expect(formatPhoneNumber('123456')).toBe('123 456');
        expect(formatPhoneNumber('1234567890')).toBe('123 456 7890');
    });

    it('keeps only ten digits', () => {
        expect(formatPhoneNumber('(123) 456-78901')).toBe('123 456 7890');
    });

    it('always chooses a pretend caller and avoids an immediate repeat', () => {
        const first = choosePretendCaller('2468', -1, 0.25);
        const second = choosePretendCaller('2468', first.index, 0.25);

        expect(PRETEND_CALLERS).toContain(first.caller);
        expect(PRETEND_CALLERS).toContain(second.caller);
        expect(second.index).not.toBe(first.index);
    });
});

describe('Pretend Phone family calls', () => {
    it.each(Object.values(FAMILY_CONTACTS))(
        'keeps $name on the line for open-ended role-play',
        (contact) => {
            vi.useFakeTimers();
            const root = document.createElement('div');
            document.body.appendChild(root);
            const cleanup = PhoneApp.mount({ root });

            root.querySelector(`[data-contact="${contact.id}"]`).click();
            expect(root.querySelector('.wos-phone-character-name').textContent)
                .toBe(`Calling ${contact.name}…`);

            vi.advanceTimersByTime(1450);
            expect(root.querySelector('.wos-phone-toy').dataset.state).toBe('family-connected');
            expect(root.querySelector('.wos-phone-character-name').textContent)
                .toBe(`${contact.name} is on the line!`);
            expect(root.querySelector('.wos-phone-character-message').textContent)
                .toContain('Talk, sing, or tell a story');

            vi.advanceTimersByTime(60000);
            expect(root.querySelector('.wos-phone-character-name').textContent)
                .toBe(`${contact.name} is on the line!`);

            cleanup();
        }
    );
});
