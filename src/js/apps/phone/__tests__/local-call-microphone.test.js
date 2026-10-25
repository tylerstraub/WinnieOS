import { describe, expect, it, vi } from 'vitest';
import { createLocalCallMicrophone } from '../local-call-microphone.js';

describe('Phone microphone origin boundary', () => {
    it.each([
        { protocol: 'https:', hostname: 'tylerstraub.github.io' },
        { protocol: 'http:', hostname: 'winnie.example' },
        { protocol: 'https:', hostname: 'localhost' }
    ])('does not request microphone access at $protocol//$hostname', async (locationRef) => {
        const getUserMedia = vi.fn();
        const microphone = createLocalCallMicrophone({
            locationRef,
            mediaDevices: { getUserMedia },
            AudioContextCtor: null
        });

        await expect(microphone.start()).resolves.toEqual({ ok: false, reason: 'unavailable' });
        expect(getUserMedia).not.toHaveBeenCalled();
    });

    it.each(['localhost', '127.0.0.1', '[::1]'])(
        'allows microphone access at the local HTTP host %s', async (hostname) => {
            const stream = { getTracks: () => [] };
            const getUserMedia = vi.fn().mockResolvedValue(stream);
            const microphone = createLocalCallMicrophone({
                locationRef: { protocol: 'http:', hostname },
                mediaDevices: { getUserMedia },
                AudioContextCtor: null
            });

            await expect(microphone.start()).resolves.toEqual({
                ok: true,
                stream,
                visualization: false
            });
            expect(getUserMedia).toHaveBeenCalledTimes(1);
            microphone.stop();
        }
    );
});
