/**
 * Phone
 *
 * A deliberately local toy phone. Presentation lives here; call resolution is
 * delegated to a replaceable provider, while microphone analysis and bounded
 * call memories stay in focused local-only adapters.
 */

import { Audio } from '../../utils/audio.js';
import {
    FAMILY_CONTACTS,
    PRETEND_CALLERS,
    choosePretendCaller,
    createPretendCallProvider
} from './pretend-call-provider.js';
import { createLocalCallMicrophone } from './local-call-microphone.js';
import {
    createCallMemoryCapture,
    createCallMemoryStore
} from './call-memory-store.js';

const MAX_DIGITS = 10;
const CONNECTED_STATES = new Set(['family-connected', 'silly-connected']);

export { FAMILY_CONTACTS, PRETEND_CALLERS, choosePretendCaller };

export function formatPhoneNumber(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, MAX_DIGITS);
    if (!digits) return '';
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function renderWaveBars() {
    return Array.from({ length: 9 }, (_, index) => (
        `<span class="wos-phone-wave-bar" data-wave-bar="${index}"></span>`
    )).join('');
}

export default {
    id: 'phone',
    title: 'Phone',
    iconEmoji: '☎️',
    sortOrder: 0,

    mount: function ({ root, phoneServices = {} }) {
        if (!root) return;

        try { Audio.ensure(); } catch (_) { /* audio is optional */ }

        const callProvider = phoneServices.callProvider || createPretendCallProvider();
        const microphone = phoneServices.microphone || createLocalCallMicrophone();
        const memoryStore = phoneServices.memoryStore || createCallMemoryStore();
        const makeCapture = phoneServices.createCallMemoryCapture || createCallMemoryCapture;

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
                        <div class="wos-phone-call-signal" data-call-signal="off"
                            role="status" aria-label="Call status">
                            <div class="wos-phone-call-signal-heading">
                                <span class="wos-phone-call-dot" aria-hidden="true"></span>
                                <span class="wos-phone-call-label">Call connected</span>
                            </div>
                            <div class="wos-phone-wave" aria-hidden="true">
                                ${renderWaveBars()}
                            </div>
                            <button class="wos-phone-mic-retry" type="button"
                                data-action="microphone" hidden>Try talk &amp; listen</button>
                        </div>
                    </div>
                    <section class="wos-phone-recents" aria-label="Recent call memories" hidden>
                        <div class="wos-phone-recents-title">Recent hellos</div>
                        <div class="wos-phone-recents-list"></div>
                    </section>
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
        const callSignal = root.querySelector('.wos-phone-call-signal');
        const callLabel = root.querySelector('.wos-phone-call-label');
        const waveBars = Array.from(root.querySelectorAll('[data-wave-bar]'));
        const microphoneButton = root.querySelector('[data-action="microphone"]');
        const callButton = root.querySelector('[data-action="call"]');
        const clearButton = root.querySelector('[data-action="clear"]');
        const soundButton = root.querySelector('[data-action="sound"]');
        const favoriteButtons = Array.from(root.querySelectorAll('[data-contact]'));
        const recents = root.querySelector('.wos-phone-recents');
        const recentsList = root.querySelector('.wos-phone-recents-list');

        let digits = '';
        let state = 'dialing';
        let soundEnabled = true;
        let activeContactId = null;
        let activeCall = null;
        let activeCapture = null;
        let microphoneRequestId = 0;
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

        function setCallSignal(signalState, label) {
            callSignal.dataset.callSignal = signalState;
            callLabel.textContent = label;
            microphoneButton.hidden = signalState !== 'connected-fallback';
            callSignal.setAttribute('aria-label', label);
            if (signalState !== 'connected-live') {
                waveBars.forEach((bar, index) => {
                    const resting = 0.24 + (index % 3) * 0.09;
                    bar.style.setProperty('--wave-level', String(resting));
                });
            }
        }

        function updateWave(level) {
            if (!CONNECTED_STATES.has(state)) return;
            setCallSignal('connected-live', 'Call connected — your voice is making waves!');
            waveBars.forEach((bar, index) => {
                const center = 1 - Math.abs(index - 4) / 5;
                const ripple = 0.72 + 0.28 * Math.sin(index * 1.7 + level * 8);
                const height = Math.max(0.18, Math.min(1, 0.18 + level * center * ripple));
                bar.style.setProperty('--wave-level', height.toFixed(3));
            });
        }

        function updateNumber() {
            const formatted = formatPhoneNumber(digits);
            numberValue.textContent = formatted;
            numberHint.textContent = formatted ? 'Ready to ring!' : 'Tap some numbers!';
            numberHint.hidden = state !== 'dialing';
            clearButton.disabled = !digits && state === 'dialing';
        }

        async function refreshRecents() {
            const records = await memoryStore.list();
            if (!mounted) return;

            recentsList.replaceChildren();
            recents.hidden = records.length === 0;
            records.forEach((record, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'wos-phone-recent';
                button.dataset.memoryId = record.id;
                button.setAttribute('aria-label', `Replay recent hello from ${record.callerName}`);

                const emoji = document.createElement('span');
                emoji.className = 'wos-phone-recent-emoji';
                emoji.setAttribute('aria-hidden', 'true');
                emoji.textContent = record.callerEmoji;

                const label = document.createElement('span');
                label.className = 'wos-phone-recent-label';
                label.textContent = index === 0 ? 'Latest hello' : 'Hello again';

                const replay = document.createElement('span');
                replay.className = 'wos-phone-recent-play';
                replay.setAttribute('aria-hidden', 'true');
                replay.textContent = '▶';

                button.append(emoji, label, replay);
                recentsList.appendChild(button);
            });
        }

        function finishActiveCapture({ save = true } = {}) {
            const capture = activeCapture;
            activeCapture = null;
            if (!capture) return;
            if (!save) {
                capture.cancel();
                return;
            }
            capture.finish()
                .then(() => refreshRecents())
                .catch(() => {});
        }

        function stopConnectedMedia({ saveMemory = true } = {}) {
            microphoneRequestId += 1;
            finishActiveCapture({ save: saveMemory });
            try { microphone.stop(); } catch (_) { /* microphone is optional */ }
        }

        function showDialing() {
            state = 'dialing';
            activeCall = null;
            setActiveContact(null);
            toy.dataset.state = state;
            characterEmoji.textContent = '☎️';
            characterName.textContent = digits ? 'That looks fun!' : 'Who should we call?';
            characterMessage.textContent = digits
                ? 'Add more, or tap the green phone.'
                : 'Every number is a silly surprise.';
            setCallSignal('off', 'Phone ready');
            setCallButton(false);
            updateNumber();
        }

        function animateCharacterArrival() {
            character.classList.remove('wos-phone-character--arriving');
            void character.offsetWidth;
            character.classList.add('wos-phone-character--arriving');
        }

        async function activateConnectedMicrophone(call) {
            if (!mounted || activeCall !== call || !CONNECTED_STATES.has(state)) return;
            if (activeCapture) {
                activeCapture.cancel();
                activeCapture = null;
            }
            const requestId = ++microphoneRequestId;
            setCallSignal('connected-starting', 'Call connected — listening for your voice…');

            let result;
            try {
                result = await microphone.start({ onLevel: updateWave });
            } catch (_) {
                result = { ok: false, reason: 'unavailable' };
            }

            if (
                !mounted ||
                requestId !== microphoneRequestId ||
                activeCall !== call ||
                !CONNECTED_STATES.has(state)
            ) {
                try { microphone.stop(); } catch (_) { /* optional cleanup */ }
                return;
            }

            if (!result.ok) {
                setCallSignal(
                    'connected-fallback',
                    'Call connected — keep talking and pretending!'
                );
                return;
            }

            setCallSignal(
                result.visualization ? 'connected-live' : 'connected-quiet',
                result.visualization
                    ? 'Call connected — talk to make waves!'
                    : 'Call connected — keep talking and pretending!'
            );

            activeCapture = makeCapture({
                stream: result.stream,
                call,
                store: memoryStore
            });
        }

        function showConnected(call) {
            activeCall = call;
            state = call.party.kind === 'family' ? 'family-connected' : 'silly-connected';
            toy.dataset.state = state;
            animateCharacterArrival();
            setActiveContact(call.party.kind === 'family' ? call.party.id : null);
            characterEmoji.textContent = call.party.emoji;
            characterName.textContent = call.party.kind === 'family'
                ? `${call.party.name} is on the line!`
                : call.party.name;
            characterMessage.textContent = call.party.message;
            numberHint.textContent = 'On the line';
            numberHint.hidden = false;
            setCallButton(true);
            setCallSignal('connected-starting', 'Call connected — listening for your voice…');
            playSound(() => Audio.phoneAnswer(call.party.kind === 'family' ? 0.54 : 0.62));
            activateConnectedMicrophone(call);
        }

        function showRinging(call) {
            activeCall = call;
            state = 'ringing';
            toy.dataset.state = state;
            setActiveContact(call.party.kind === 'family' ? call.party.id : null);
            numberValue.textContent = call.party.kind === 'family'
                ? call.party.name
                : formatPhoneNumber(call.digits);
            numberHint.textContent = 'Calling…';
            numberHint.hidden = false;
            characterEmoji.textContent = call.party.kind === 'family' ? call.party.emoji : '📞';
            characterName.textContent = call.party.kind === 'family'
                ? `Calling ${call.party.name}…`
                : 'Ring ring…';
            characterMessage.textContent = call.party.kind === 'family'
                ? 'They’ll be on the line in a moment.'
                : 'A silly friend is answering!';
            setCallSignal('ringing', 'Ringing…');
            setCallButton(true);
            playSound(() => Audio.phoneRing(0.56));
        }

        function dial({ contactId = null } = {}) {
            if (contactId) digits = '';
            callProvider.dial(
                { digits, contactId },
                {
                    onRinging: showRinging,
                    onConnected: showConnected
                }
            );
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
            dial();
        }

        function startFamilyCall(contactId) {
            if (!FAMILY_CONTACTS[contactId]) return;
            if (state !== 'dialing') sayBye({ withSound: false });
            dial({ contactId });
        }

        function sayBye({ withSound = true } = {}) {
            const saveMemory = CONNECTED_STATES.has(state);
            callProvider.disconnect();
            stopConnectedMedia({ saveMemory });
            if (withSound) playSound(() => Audio.phoneHangup(0.46));
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
            playSound(() => Audio.phoneDigit(String(digit), 0.46));
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

        async function replayMemory(id, button) {
            const record = await memoryStore.get(id);
            if (!mounted || !record?.blob) return;
            button.classList.add('is-playing');
            try {
                if (Audio.playLocalRecording) {
                    await Audio.playLocalRecording(record.blob, 0.46);
                }
            } catch (_) {
                // Replay is optional; stored memories never affect normal calls.
            } finally {
                if (mounted) button.classList.remove('is-playing');
            }
        }

        function onRootClick(event) {
            const button = event.target.closest('button');
            if (!button || !root.contains(button)) return;

            if (button.dataset.digit !== undefined) {
                pressDigit(button.dataset.digit);
            } else if (button.dataset.contact) {
                startFamilyCall(button.dataset.contact);
            } else if (button.dataset.memoryId) {
                replayMemory(button.dataset.memoryId, button);
            } else if (button.dataset.action === 'clear') {
                eraseDigit();
            } else if (button.dataset.action === 'call') {
                if (state === 'dialing') startPretendCall();
                else sayBye();
            } else if (button.dataset.action === 'microphone' && activeCall) {
                activateConnectedMicrophone(activeCall);
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
            if (
                (event.key === 'Enter' || event.key === ' ') &&
                event.target instanceof Element &&
                event.target.closest('button') &&
                root.contains(event.target)
            ) {
                return;
            }
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
        refreshRecents();

        return function cleanup() {
            const saveMemory = CONNECTED_STATES.has(state);
            mounted = false;
            callProvider.dispose();
            microphoneRequestId += 1;
            finishActiveCapture({ save: saveMemory });
            try { microphone.stop(); } catch (_) { /* optional cleanup */ }
            root.removeEventListener('click', onRootClick);
            document.removeEventListener('keydown', onKeyDown);
        };
    },

    unmount: function () {}
};
