/**
 * Pretend Phone
 *
 * A deliberately local toy phone: digits make familiar keypad tones, the call
 * button rings a whimsical pretend caller, and nothing ever leaves the browser.
 */

import { Audio } from '../../utils/audio.js';

const MAX_DIGITS = 10;
const RING_DELAY_MS = 1450;

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

export function formatPhoneNumber(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, MAX_DIGITS);
    if (!digits) return '';
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

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

export default {
    id: 'phone',
    title: 'Phone',
    iconEmoji: '☎️',
    sortOrder: 0,

    mount: function ({ root }) {
        if (!root) return;

        try { Audio.ensure(); } catch (_) { /* audio is optional */ }

        root.className = 'wos-phone-app';
        root.innerHTML = `
            <div class="wos-phone-sparkles" aria-hidden="true">
                <span>✦</span><span>●</span><span>★</span><span>✦</span><span>●</span>
            </div>
            <section class="wos-phone-toy" aria-label="Pretend phone">
                <div class="wos-phone-screen">
                    <button class="wos-phone-sound" type="button" data-action="sound"
                        aria-label="Turn sounds off" aria-pressed="true">
                        <span aria-hidden="true">♪</span>
                    </button>
                    <div class="wos-phone-number" aria-live="polite">
                        <span class="wos-phone-number-value"></span>
                        <span class="wos-phone-number-hint">Tap some numbers!</span>
                    </div>
                    <div class="wos-phone-favorites" role="group" aria-label="Call family">
                        <button class="wos-phone-favorite wos-phone-favorite--mom" type="button"
                            data-contact="mom" aria-label="Call Mom">
                            <span class="wos-phone-favorite-emoji" aria-hidden="true">👩</span>
                            <span>Mom</span>
                        </button>
                        <button class="wos-phone-favorite wos-phone-favorite--dad" type="button"
                            data-contact="dad" aria-label="Call Dad">
                            <span class="wos-phone-favorite-emoji" aria-hidden="true">👨</span>
                            <span>Dad</span>
                        </button>
                    </div>
                    <div class="wos-phone-character" aria-live="polite">
                        <div class="wos-phone-character-emoji" aria-hidden="true">☎️</div>
                        <div class="wos-phone-character-name">Who should we call?</div>
                        <div class="wos-phone-character-message">Every number is a silly surprise.</div>
                    </div>
                </div>
                <div class="wos-phone-keypad" role="group" aria-label="Phone keypad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => `
                        <button class="wos-phone-key" type="button" data-digit="${digit}" aria-label="${digit}">
                            <span>${digit}</span>
                        </button>
                    `).join('')}
                    <button class="wos-phone-key wos-phone-key--clear" type="button"
                        data-action="clear" aria-label="Erase last number">
                        <span aria-hidden="true">⌫</span>
                    </button>
                    <button class="wos-phone-key" type="button" data-digit="0" aria-label="0">
                        <span>0</span>
                    </button>
                    <button class="wos-phone-key wos-phone-key--call" type="button"
                        data-action="call" aria-label="Call">
                        <span aria-hidden="true">☎</span>
                    </button>
                </div>
            </section>
        `;

        const toy = root.querySelector('.wos-phone-toy');
        const numberValue = root.querySelector('.wos-phone-number-value');
        const numberHint = root.querySelector('.wos-phone-number-hint');
        const character = root.querySelector('.wos-phone-character');
        const characterEmoji = root.querySelector('.wos-phone-character-emoji');
        const characterName = root.querySelector('.wos-phone-character-name');
        const characterMessage = root.querySelector('.wos-phone-character-message');
        const callButton = root.querySelector('[data-action="call"]');
        const clearButton = root.querySelector('[data-action="clear"]');
        const soundButton = root.querySelector('[data-action="sound"]');
        const favoriteButtons = Array.from(root.querySelectorAll('[data-contact]'));

        let digits = '';
        let state = 'dialing';
        let soundEnabled = true;
        let ringTimer = null;
        let previousCallerIndex = -1;
        let activeContactId = null;
        let mounted = true;

        function playSound(play) {
            if (!soundEnabled || !mounted) return;
            try {
                if (Audio.isUnlocked && Audio.isUnlocked()) {
                    play();
                    return;
                }
                if (Audio.unlock) {
                    Audio.unlock().then((ok) => {
                        if (ok && soundEnabled && mounted) play();
                    }).catch(() => {});
                }
            } catch (_) { /* keep the phone fully usable without sound */ }
        }

        function clearRingTimer() {
            if (ringTimer) {
                clearTimeout(ringTimer);
                ringTimer = null;
            }
        }

        function setCallButton(isHangingUp) {
            callButton.classList.toggle('wos-phone-key--hangup', isHangingUp);
            callButton.setAttribute('aria-label', isHangingUp ? 'Say bye' : 'Call');
            callButton.querySelector('span').textContent = isHangingUp ? '×' : '☎';
        }

        function setActiveContact(contactId) {
            activeContactId = contactId;
            favoriteButtons.forEach((button) => {
                const active = button.dataset.contact === contactId;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', String(active));
            });
        }

        function updateNumber() {
            const formatted = formatPhoneNumber(digits);
            numberValue.textContent = formatted;
            numberHint.textContent = formatted ? 'Ready to ring!' : 'Tap some numbers!';
            numberHint.hidden = state !== 'dialing';
            clearButton.disabled = !digits && state === 'dialing';
        }

        function showDialing() {
            state = 'dialing';
            clearRingTimer();
            setActiveContact(null);
            toy.dataset.state = state;
            characterEmoji.textContent = '☎️';
            characterName.textContent = digits ? 'That looks fun!' : 'Who should we call?';
            characterMessage.textContent = digits
                ? 'Add more, or tap the green phone.'
                : 'Every number is a silly surprise.';
            setCallButton(false);
            updateNumber();
        }

        function animateCharacterArrival() {
            character.classList.remove('wos-phone-character--arriving');
            void character.offsetWidth;
            character.classList.add('wos-phone-character--arriving');
        }

        function showSillyCaller(caller) {
            state = 'silly-connected';
            toy.dataset.state = state;
            animateCharacterArrival();
            characterEmoji.textContent = caller.emoji;
            characterName.textContent = caller.name;
            characterMessage.textContent = caller.message;
            numberHint.hidden = true;
            setCallButton(true);
            playSound(() => Audio.phoneAnswer(0.52));
        }

        function showFamilyCall(contact) {
            state = 'family-connected';
            toy.dataset.state = state;
            animateCharacterArrival();
            setActiveContact(contact.id);
            characterEmoji.textContent = contact.emoji;
            characterName.textContent = `${contact.name} is on the line!`;
            characterMessage.textContent = 'Talk, sing, or tell a story. They’re listening.';
            numberHint.textContent = 'On the line';
            numberHint.hidden = false;
            setCallButton(true);
            playSound(() => Audio.phoneAnswer(0.42));
        }

        function beginRinging({ contact = null, caller = null }) {
            clearRingTimer();
            state = 'ringing';
            toy.dataset.state = state;
            setActiveContact(contact ? contact.id : null);
            numberValue.textContent = contact ? contact.name : formatPhoneNumber(digits);
            numberHint.textContent = 'Calling…';
            numberHint.hidden = false;
            characterEmoji.textContent = contact ? contact.emoji : '📞';
            characterName.textContent = contact ? `Calling ${contact.name}…` : 'Ring ring…';
            characterMessage.textContent = contact
                ? 'They’ll be on the line in a moment.'
                : 'A silly friend is answering!';
            setCallButton(true);
            playSound(() => Audio.phoneRing(0.44));

            ringTimer = setTimeout(() => {
                ringTimer = null;
                if (!mounted || state !== 'ringing') return;
                if (contact) showFamilyCall(contact);
                else showSillyCaller(caller);
            }, RING_DELAY_MS);
        }

        function startPretendCall() {
            if (!digits) {
                characterEmoji.textContent = '☝️';
                characterName.textContent = 'First, pick a number!';
                characterMessage.textContent = 'Any number will do.';
                toy.classList.remove('wos-phone-needs-number');
                void toy.offsetWidth;
                toy.classList.add('wos-phone-needs-number');
                playSound(() => Audio.tick());
                return;
            }

            const result = choosePretendCaller(digits, previousCallerIndex);
            previousCallerIndex = result.index;
            beginRinging({ caller: result.caller });
        }

        function startFamilyCall(contactId) {
            const contact = FAMILY_CONTACTS[contactId];
            if (!contact) return;
            digits = '';
            beginRinging({ contact });
        }

        function sayBye({ withSound = true } = {}) {
            if (withSound) playSound(() => Audio.phoneHangup(0.36));
            digits = '';
            character.classList.remove('wos-phone-character--arriving');
            showDialing();
        }

        function pressDigit(digit) {
            if (state !== 'dialing') sayBye({ withSound: false });
            if (digits.length >= MAX_DIGITS) {
                playSound(() => Audio.tick());
                return;
            }

            digits += String(digit);
            characterEmoji.textContent = ['🐸', '⭐', '🫧', '🦆', '🍓'][digits.length % 5];
            characterName.textContent = 'Keep going!';
            characterMessage.textContent = digits.length >= 3
                ? 'That number is ready to ring.'
                : 'Every tap makes a phone tone.';
            updateNumber();
            playSound(() => Audio.phoneDigit(String(digit), 0.36));
        }

        function eraseDigit() {
            if (state !== 'dialing') {
                sayBye();
                return;
            }
            if (!digits) return;
            digits = digits.slice(0, -1);
            playSound(() => Audio.poof(0.20));
            showDialing();
        }

        function onRootClick(event) {
            const button = event.target.closest('button');
            if (!button || !root.contains(button)) return;

            if (button.dataset.digit !== undefined) {
                pressDigit(button.dataset.digit);
            } else if (button.dataset.contact) {
                startFamilyCall(button.dataset.contact);
            } else if (button.dataset.action === 'clear') {
                eraseDigit();
            } else if (button.dataset.action === 'call') {
                if (state === 'dialing') startPretendCall();
                else sayBye();
            } else if (button.dataset.action === 'sound') {
                soundEnabled = !soundEnabled;
                soundButton.setAttribute('aria-pressed', String(soundEnabled));
                soundButton.setAttribute('aria-label', soundEnabled ? 'Turn sounds off' : 'Turn sounds on');
                soundButton.classList.toggle('is-muted', !soundEnabled);
                if (soundEnabled) playSound(() => Audio.ready(0.22));
            }
        }

        function onKeyDown(event) {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            if (/^\d$/.test(event.key)) {
                pressDigit(event.key);
                event.preventDefault();
            } else if (event.key === 'Backspace' || event.key === 'Delete') {
                eraseDigit();
                event.preventDefault();
            } else if (event.key === 'Enter' || event.key === ' ') {
                if (state === 'dialing') startPretendCall();
                else sayBye();
                event.preventDefault();
            } else if (event.key === 'Escape' && state !== 'dialing') {
                sayBye();
                event.preventDefault();
            }
        }

        root.addEventListener('click', onRootClick);
        document.addEventListener('keydown', onKeyDown);
        showDialing();

        return function cleanup() {
            mounted = false;
            clearRingTimer();
            root.removeEventListener('click', onRootClick);
            document.removeEventListener('keydown', onKeyDown);
        };
    },

    unmount: function () {}
};
