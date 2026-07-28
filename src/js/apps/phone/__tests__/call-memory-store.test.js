import { describe, expect, it, vi } from 'vitest';
import {
    createCallMemoryCapture,
    pruneCallMemories
} from '../call-memory-store.js';

describe('Phone call memory bounds', () => {
    it('keeps only the newest clips within count and byte limits', () => {
        const entries = [
            { id: 'old', createdAt: 1, size: 40 },
            { id: 'middle', createdAt: 2, size: 40 },
            { id: 'new', createdAt: 3, size: 40 }
        ];

        const result = pruneCallMemories(entries, { maxCount: 2, maxBytes: 70 });

        expect(result.kept.map((entry) => entry.id)).toEqual(['new']);
        expect(result.removed.map((entry) => entry.id)).toEqual(['middle', 'old']);
    });

    it('records automatically, stops at the duration cap, and stores on finish', async () => {
        vi.useFakeTimers();

        class FakeMediaRecorder {
            static isTypeSupported(type) {
                return type === 'audio/webm;codecs=opus';
            }

            constructor() {
                this.mimeType = 'audio/webm;codecs=opus';
                this.state = 'inactive';
            }

            start() {
                this.state = 'recording';
            }

            stop() {
                this.state = 'inactive';
                this.ondataavailable?.({
                    data: new Blob(['voice'], { type: this.mimeType })
                });
                this.onstop?.();
            }
        }

        const store = {
            available: true,
            add: vi.fn().mockResolvedValue(true)
        };
        const capture = createCallMemoryCapture({
            stream: {},
            call: {
                id: 7,
                party: { name: 'Mom', emoji: '👩' }
            },
            store,
            MediaRecorderCtor: FakeMediaRecorder,
            maxDurationMs: 1000,
            now: vi.fn()
                .mockReturnValueOnce(100)
                .mockReturnValueOnce(1100)
        });

        expect(capture).not.toBeNull();
        vi.advanceTimersByTime(1000);
        await capture.finish();

        expect(store.add).toHaveBeenCalledTimes(1);
        expect(store.add.mock.calls[0][0]).toMatchObject({
            id: '100-7',
            callerName: 'Mom',
            callerEmoji: '👩',
            durationMs: 1000,
            mimeType: 'audio/webm;codecs=opus'
        });
        expect(store.add.mock.calls[0][0].blob.size).toBeGreaterThan(0);
    });

    it('does nothing when recording or IndexedDB support is unavailable', () => {
        expect(createCallMemoryCapture({
            stream: {},
            call: { id: 1, party: { name: 'Friend', emoji: '☎️' } },
            store: { available: false },
            MediaRecorderCtor: null
        })).toBeNull();
    });
});
