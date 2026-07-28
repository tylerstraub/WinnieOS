import { afterEach, describe, expect, it, vi } from 'vitest';
import PhoneApp, {
    FAMILY_CONTACTS,
    PRETEND_CALLERS,
    choosePretendCaller,
    formatPhoneNumber
} from '../app.js';
import { createPretendCallProvider } from '../pretend-call-provider.js';

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

    it('requests the microphone only after an intentional call connects', async () => {
        vi.useFakeTimers();
        const microphone = {
            start: vi.fn().mockResolvedValue({
                ok: true,
                stream: { getTracks: () => [] },
                visualization: true
            }),
            stop: vi.fn()
        };
        const root = document.createElement('div');
        document.body.appendChild(root);
        const cleanup = PhoneApp.mount({
            root,
            phoneServices: {
                microphone,
                memoryStore: {
                    available: false,
                    get: vi.fn(),
                    list: vi.fn().mockResolvedValue([])
                }
            }
        });

        expect(microphone.start).not.toHaveBeenCalled();
        root.querySelector('[data-contact="mom"]').click();
        expect(microphone.start).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1450);
        await Promise.resolve();
        expect(microphone.start).toHaveBeenCalledTimes(1);
        expect(root.querySelector('.wos-phone-call-signal').dataset.callSignal)
            .toBe('connected-live');

        cleanup();
        expect(microphone.stop).toHaveBeenCalled();
    });

    it('keeps the call visibly connected when microphone access is unavailable', async () => {
        vi.useFakeTimers();
        const root = document.createElement('div');
        document.body.appendChild(root);
        const cleanup = PhoneApp.mount({
            root,
            phoneServices: {
                microphone: {
                    start: vi.fn().mockResolvedValue({ ok: false, reason: 'denied' }),
                    stop: vi.fn()
                },
                memoryStore: {
                    available: false,
                    get: vi.fn(),
                    list: vi.fn().mockResolvedValue([])
                }
            }
        });

        root.querySelector('[data-contact="dad"]').click();
        vi.advanceTimersByTime(1450);
        await Promise.resolve();

        const signal = root.querySelector('.wos-phone-call-signal');
        expect(root.querySelector('.wos-phone-toy').dataset.state).toBe('family-connected');
        expect(signal.dataset.callSignal).toBe('connected-fallback');
        expect(signal.getAttribute('aria-label')).toContain('Call connected');
        expect(root.querySelector('[data-action="microphone"]').hidden).toBe(false);

        cleanup();
    });

    it('finishes an automatic call memory at hang-up and shows replay', async () => {
        vi.useFakeTimers();
        const records = [];
        const record = {
            id: 'recent-1',
            createdAt: 10,
            callerName: 'Mom',
            callerEmoji: '👩',
            blob: new Blob(['hello'], { type: 'audio/webm' })
        };
        const capture = {
            cancel: vi.fn(),
            finish: vi.fn().mockImplementation(async () => {
                records.push(record);
                return true;
            })
        };
        const memoryStore = {
            available: true,
            get: vi.fn().mockResolvedValue(record),
            list: vi.fn().mockImplementation(async () => [...records])
        };
        const root = document.createElement('div');
        document.body.appendChild(root);
        const cleanup = PhoneApp.mount({
            root,
            phoneServices: {
                microphone: {
                    start: vi.fn().mockResolvedValue({
                        ok: true,
                        stream: { getTracks: () => [] },
                        visualization: true
                    }),
                    stop: vi.fn()
                },
                memoryStore,
                createCallMemoryCapture: vi.fn(() => capture)
            }
        });

        root.querySelector('[data-contact="mom"]').click();
        vi.advanceTimersByTime(1450);
        await Promise.resolve();
        root.querySelector('[data-action="call"]').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(capture.finish).toHaveBeenCalledTimes(1);
        expect(root.querySelector('.wos-phone-recents').hidden).toBe(false);
        expect(root.querySelector('[data-memory-id="recent-1"]')).not.toBeNull();

        cleanup();
    });
});

describe('Pretend call provider', () => {
    it('cancels a ringing call without emitting connected', () => {
        vi.useFakeTimers();
        const onConnected = vi.fn();
        const provider = createPretendCallProvider();

        provider.dial({ digits: '123' }, { onConnected });
        provider.disconnect();
        vi.advanceTimersByTime(2000);

        expect(onConnected).not.toHaveBeenCalled();
    });
});
