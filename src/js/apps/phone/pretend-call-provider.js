const DEFAULT_RING_DELAY_MS = 1450;

export const FAMILY_CONTACTS = {
    mom: {
        id: 'mom',
        name: 'Mom',
        emoji: '👩',
        color: 'coral'
    },
    dad: {
        id: 'dad',
        name: 'Dad',
        emoji: '👨',
        color: 'blue'
    }
};

export const PRETEND_CALLERS = [
    { emoji: '🍌', name: 'Banana Phone', message: 'Ring ring, peel-o!' },
    { emoji: '🐭🌙', name: 'Moon Mice', message: 'Squeak squeak! Tiny hello!' },
    { emoji: '🧦', name: 'Silly Socks', message: 'They found the other sock!' },
    { emoji: '🦆', name: 'Dancing Ducks', message: 'Quack quack — dance break!' },
    { emoji: '☁️', name: 'A Fluffy Cloud', message: 'The cloud says booooop!' },
    { emoji: '🤖', name: 'Beep-Boop Robot', message: 'Beep boop! You found me!' },
    { emoji: '🦕', name: 'Dinosaur Friend', message: 'Roooar means hello!' },
    { emoji: '🍕', name: 'Pizza Planet', message: 'Extra giggles delivered!' },
    { emoji: '🐸', name: 'The Frog Pond', message: 'Ribbit ribbit, Winnie!' },
    { emoji: '🐱🚀', name: 'Captain Whiskers', message: 'Floating through space!' },
    { emoji: '🫧', name: 'Bubble Club', message: 'Pop pop, hooray!' },
    { emoji: '🐙', name: 'Octopus Office', message: 'Eight hands are waving!' }
];

export function choosePretendCaller(digits, previousIndex = -1, randomValue = Math.random()) {
    const digitScore = String(digits || '')
        .split('')
        .reduce((sum, digit, index) => sum + Number(digit) * (index + 3), 0);
    const randomScore = Math.floor(
        Math.max(0, Math.min(0.999999, randomValue)) * PRETEND_CALLERS.length
    );
    let index = (digitScore + randomScore) % PRETEND_CALLERS.length;

    if (PRETEND_CALLERS.length > 1 && index === previousIndex) {
        index = (index + 1) % PRETEND_CALLERS.length;
    }

    return { index, caller: PRETEND_CALLERS[index] };
}

/**
 * Replaceable local call adapter.
 *
 * The Phone UI owns presentation state; this provider only resolves who the
 * pretend call reaches and emits ringing/connected lifecycle events. A future
 * real-call provider can implement this same small surface without changing
 * the dialer or call presentation.
 */
export function createPretendCallProvider({
    ringDelayMs = DEFAULT_RING_DELAY_MS,
    random = Math.random,
    setTimer = setTimeout,
    clearTimer = clearTimeout
} = {}) {
    let timer = null;
    let activeCall = null;
    let previousCallerIndex = -1;
    let nextCallId = 0;

    function disconnect() {
        if (timer !== null) {
            clearTimer(timer);
            timer = null;
        }
        activeCall = null;
    }

    function dial({ digits = '', contactId = null } = {}, observer = {}) {
        disconnect();

        let party;
        if (contactId && FAMILY_CONTACTS[contactId]) {
            const contact = FAMILY_CONTACTS[contactId];
            party = {
                ...contact,
                kind: 'family',
                message: 'Talk, sing, or tell a story. They’re listening.'
            };
        } else {
            const result = choosePretendCaller(digits, previousCallerIndex, random());
            previousCallerIndex = result.index;
            party = {
                ...result.caller,
                id: `pretend-${result.index}`,
                kind: 'silly'
            };
        }

        const call = {
            id: ++nextCallId,
            digits: String(digits || ''),
            party
        };
        activeCall = call;
        observer.onRinging?.(call);

        timer = setTimer(() => {
            timer = null;
            if (activeCall !== call) return;
            observer.onConnected?.(call);
        }, ringDelayMs);

        return call;
    }

    return {
        id: 'local-pretend',
        dial,
        disconnect,
        dispose: disconnect
    };
}
