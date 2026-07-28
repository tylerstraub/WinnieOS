const DEFAULT_FFT_SIZE = 256;

function getDefaultAudioContext() {
    if (typeof window === 'undefined') return null;
    return window.AudioContext || window.webkitAudioContext || null;
}

function getDefaultMediaDevices() {
    if (typeof navigator === 'undefined') return null;
    return navigator.mediaDevices || null;
}

function getDefaultRequestFrame() {
    if (typeof requestAnimationFrame === 'function') return requestAnimationFrame;
    return (callback) => setTimeout(callback, 16);
}

function getDefaultCancelFrame() {
    if (typeof cancelAnimationFrame === 'function') return cancelAnimationFrame;
    return clearTimeout;
}

/**
 * Local-only microphone analyser for connected pretend calls.
 *
 * The media stream is never connected to an output, network, transcription,
 * or persistence surface here. Consumers receive only a normalized 0..1 level
 * and the stream reference needed by the bounded local call-memory adapter.
 */
export function createLocalCallMicrophone({
    mediaDevices = getDefaultMediaDevices(),
    AudioContextCtor = getDefaultAudioContext(),
    requestFrame = getDefaultRequestFrame(),
    cancelFrame = getDefaultCancelFrame()
} = {}) {
    let stream = null;
    let context = null;
    let source = null;
    let analyser = null;
    let frameId = null;
    let generation = 0;

    function stop() {
        generation += 1;
        if (frameId !== null) {
            cancelFrame(frameId);
            frameId = null;
        }
        try { source?.disconnect(); } catch (_) { /* optional cleanup */ }
        try { analyser?.disconnect(); } catch (_) { /* optional cleanup */ }
        if (stream) {
            stream.getTracks().forEach((track) => {
                try { track.stop(); } catch (_) { /* optional cleanup */ }
            });
        }
        if (context && context.state !== 'closed') {
            try { context.close().catch(() => {}); } catch (_) { /* optional cleanup */ }
        }
        stream = null;
        context = null;
        source = null;
        analyser = null;
    }

    async function start({ onLevel = () => {} } = {}) {
        stop();
        const startGeneration = generation;

        if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
            return { ok: false, reason: 'unavailable' };
        }

        let nextStream;
        try {
            nextStream = await mediaDevices.getUserMedia({
                audio: {
                    autoGainControl: true,
                    echoCancellation: true,
                    noiseSuppression: true
                },
                video: false
            });
        } catch (error) {
            const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
            return { ok: false, reason: denied ? 'denied' : 'unavailable' };
        }

        if (generation !== startGeneration) {
            nextStream.getTracks().forEach((track) => track.stop());
            return { ok: false, reason: 'cancelled' };
        }

        stream = nextStream;
        if (!AudioContextCtor) {
            return { ok: true, stream, visualization: false };
        }

        try {
            context = new AudioContextCtor({ latencyHint: 'interactive' });
            source = context.createMediaStreamSource(stream);
            analyser = context.createAnalyser();
            analyser.fftSize = DEFAULT_FFT_SIZE;
            analyser.smoothingTimeConstant = 0.82;
            source.connect(analyser);

            const samples = new Uint8Array(analyser.fftSize);
            const draw = () => {
                if (!analyser || generation !== startGeneration) return;
                analyser.getByteTimeDomainData(samples);
                let energy = 0;
                for (const sample of samples) {
                    const centered = (sample - 128) / 128;
                    energy += centered * centered;
                }
                const rms = Math.sqrt(energy / samples.length);
                const level = Math.max(0, Math.min(1, (rms - 0.012) * 7.5));
                onLevel(level);
                frameId = requestFrame(draw);
            };
            draw();
            return { ok: true, stream, visualization: true };
        } catch (_) {
            return { ok: true, stream, visualization: false };
        }
    }

    return {
        start,
        stop,
        getStream: () => stream
    };
}
