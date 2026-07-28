export const MAX_CALL_MEMORY_DURATION_MS = 6000;
export const MAX_CALL_MEMORY_COUNT = 3;
export const MAX_CALL_MEMORY_BYTES = 3 * 1024 * 1024;

const DB_NAME = 'winnieos-phone-call-memories';
const DB_VERSION = 1;
const STORE_NAME = 'clips';

function getDefaultIndexedDb() {
    if (typeof indexedDB === 'undefined') return null;
    return indexedDB;
}

function getDefaultMediaRecorder() {
    if (typeof MediaRecorder === 'undefined') return null;
    return MediaRecorder;
}

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionToPromise(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
    });
}

export function pruneCallMemories(entries, {
    maxCount = MAX_CALL_MEMORY_COUNT,
    maxBytes = MAX_CALL_MEMORY_BYTES
} = {}) {
    const newestFirst = [...entries].sort((a, b) => b.createdAt - a.createdAt);
    const kept = [];
    const removed = [];
    let bytes = 0;

    for (const entry of newestFirst) {
        const size = Math.max(0, Number(entry.size) || Number(entry.blob?.size) || 0);
        if (kept.length < maxCount && bytes + size <= maxBytes) {
            kept.push(entry);
            bytes += size;
        } else {
            removed.push(entry);
        }
    }

    return { kept, removed };
}

export function createCallMemoryStore({
    indexedDBRef = getDefaultIndexedDb()
} = {}) {
    let dbPromise = null;

    function forgetDatabase(db) {
        try { db?.close(); } catch (_) { /* storage is optional */ }
        dbPromise = null;
    }

    function open() {
        if (!indexedDBRef) return Promise.resolve(null);
        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDBRef.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('createdAt', 'createdAt');
                }
            };
            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => forgetDatabase(db);
                db.onclose = () => {
                    if (dbPromise) dbPromise = null;
                };
                resolve(db);
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error('Call memory database is blocked'));
        }).catch(() => {
            dbPromise = null;
            return null;
        });

        return dbPromise;
    }

    async function list() {
        const db = await open();
        if (!db) return [];
        try {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const records = await requestToPromise(transaction.objectStore(STORE_NAME).getAll());
            return records.sort((a, b) => b.createdAt - a.createdAt);
        } catch (_) {
            forgetDatabase(db);
            return [];
        }
    }

    async function add(record) {
        const db = await open();
        if (!db || !record?.blob || record.blob.size <= 0) return false;

        try {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.put({
                ...record,
                size: record.blob.size
            });
            const records = await requestToPromise(store.getAll());
            const { removed } = pruneCallMemories(records);
            removed.forEach((entry) => store.delete(entry.id));
            await transactionToPromise(transaction);
            return true;
        } catch (_) {
            forgetDatabase(db);
            return false;
        }
    }

    async function get(id) {
        const db = await open();
        if (!db) return null;
        try {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            return await requestToPromise(transaction.objectStore(STORE_NAME).get(id));
        } catch (_) {
            forgetDatabase(db);
            return null;
        }
    }

    return {
        available: Boolean(indexedDBRef),
        add,
        get,
        list
    };
}

function chooseMimeType(MediaRecorderCtor) {
    if (!MediaRecorderCtor || typeof MediaRecorderCtor.isTypeSupported !== 'function') {
        return '';
    }
    return [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus'
    ].find((type) => MediaRecorderCtor.isTypeSupported(type)) || '';
}

/**
 * Captures one bounded, automatic local call memory.
 *
 * Data remains in memory until finish() is called at hang-up, then is handed
 * directly to the bounded IndexedDB store. Unsupported APIs fail silently.
 */
export function createCallMemoryCapture({
    stream,
    call,
    store,
    MediaRecorderCtor = getDefaultMediaRecorder(),
    maxDurationMs = MAX_CALL_MEMORY_DURATION_MS,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    now = Date.now
} = {}) {
    if (!stream || !store?.available || !MediaRecorderCtor) return null;

    let recorder;
    try {
        const mimeType = chooseMimeType(MediaRecorderCtor);
        recorder = new MediaRecorderCtor(stream, mimeType ? { mimeType } : undefined);
    } catch (_) {
        return null;
    }

    const chunks = [];
    const startedAt = now();
    let stopTimer = null;
    let saved = false;
    let discard = false;
    let resolveStopped;
    const stopped = new Promise((resolve) => { resolveStopped = resolve; });

    recorder.ondataavailable = (event) => {
        if (!discard && event.data?.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => resolveStopped(null);
    recorder.onstop = () => {
        if (stopTimer !== null) {
            clearTimer(stopTimer);
            stopTimer = null;
        }
        if (discard || chunks.length === 0) {
            resolveStopped(null);
            return;
        }
        const type = recorder.mimeType || chunks[0]?.type || 'audio/webm';
        resolveStopped(new Blob(chunks, { type }));
    };

    try {
        recorder.start(250);
        stopTimer = setTimer(() => {
            stopTimer = null;
            if (recorder.state === 'recording') recorder.stop();
        }, maxDurationMs);
    } catch (_) {
        return null;
    }

    function stopRecorder() {
        if (stopTimer !== null) {
            clearTimer(stopTimer);
            stopTimer = null;
        }
        if (recorder.state === 'recording') {
            try { recorder.stop(); } catch (_) { resolveStopped(null); }
        }
    }

    return {
        async finish() {
            if (saved || discard) return false;
            saved = true;
            stopRecorder();
            const blob = await stopped;
            if (!blob) return false;
            const endedAt = now();
            return store.add({
                id: `${startedAt}-${call.id}`,
                createdAt: startedAt,
                callerName: call.party.name,
                callerEmoji: call.party.emoji,
                durationMs: Math.min(maxDurationMs, Math.max(0, endedAt - startedAt)),
                mimeType: blob.type,
                blob
            });
        },
        cancel() {
            discard = true;
            chunks.length = 0;
            stopRecorder();
        }
    };
}
