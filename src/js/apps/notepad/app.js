/**
 * Notepad App
 *
 * Toddler-first, single endless note:
 * - Big writing area (contenteditable)
 * - Tap a color: new typing uses that color
 * - Emoji palette: insert emoji at caret
 * - Auto-saves locally (offline) via WinnieOS Storage
 */

import { Storage } from '../../utils/storage.js';
import { Audio } from '../../utils/audio.js';

const STORAGE_KEY = 'apps.notepad.v1';

// Toddler-safe palette (simple, recognizable, high-contrast on "paper")
const COLOR_SWATCHES = [
    { id: 'black', hex: '#111111' },
    { id: 'red', hex: '#E11D48' },
    { id: 'orange', hex: '#F97316' },
    { id: 'yellow', hex: '#F59E0B' },
    { id: 'green', hex: '#16A34A' },
    { id: 'blue', hex: '#2563EB' },
    { id: 'purple', hex: '#7C3AED' },
    { id: 'pink', hex: '#EC4899' }
];

// Curated emoji palette (no labels; keep it friendly + familiar)
const EMOJI_PALETTE = [
    '😀','😁','😄','😆','😊','😍','🥳','😜',
    '🐵','🙈','🙉','🙊',
    '🐶','🐱','🐭','🐰',
    '🦁','🐷','🐽','🐮',
    '🐸','🐻','🐼','🐨',
    '🦊','🐯','🐙','🦄',
    '🐞','🦋','🐝','🐢',
    '🍓','🍌','🍎','🍇',
    '🍉','🍒','🍪','🍦',
    '⭐','🌈','☀️','🌙',
    '❤️','💛','💚','💙','💜',
    '✨','🎈','🎉','🎵'
];

function debounce(fn, waitMs) {
    let t = null;
    return function(...args) {
        if (t) clearTimeout(t);
        t = setTimeout(() => fn(...args), waitMs);
    };
}

function normalizeColor(value) {
    const s = String(value || '').trim();
    if (!s) return null;
    // Accept hex colors (#rgb/#rrggbb) or rgb(a) (Chromium sometimes normalizes)
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s.toLowerCase();
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(s)) return s;
    return null;
}

function sanitizeNotepadHtml(html) {
    // Only allow a tiny subset that we generate:
    // - div / br for line structure
    // - span with style=color for colored runs
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');

    const walk = (node) => {
        const children = Array.from(node.childNodes || []);
        for (const child of children) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const tag = child.tagName.toLowerCase();
                if (tag === 'br') {
                    // ok
                } else if (tag === 'div' || tag === 'span') {
                    // Strip all attributes except color (span only)
                    const attrs = Array.from(child.attributes || []);
                    for (const a of attrs) {
                        child.removeAttribute(a.name);
                    }
                    if (tag === 'span') {
                        const rawColor = child.style && child.style.color ? child.style.color : '';
                        const color = normalizeColor(rawColor);
                        if (color) {
                            child.setAttribute('style', `color:${color}`);
                        }
                    }
                    walk(child);
                } else {
                    // Replace unknown elements with their text content
                    const text = child.textContent || '';
                    child.replaceWith(document.createTextNode(text));
                }
            } else if (child.nodeType === Node.COMMENT_NODE) {
                child.remove();
            } else {
                // text nodes: ok
            }
        }
    };

    try { walk(tpl.content); } catch (_) { /* ignore */ }
    return tpl.innerHTML;
}

function tryExecCommand(command, value) {
    try {
        // styleWithCSS helps Chromium keep formatting in spans instead of <font>
        if (command === 'foreColor') {
            try { document.execCommand('styleWithCSS', false, true); } catch (_) { /* ignore */ }
        }
        return document.execCommand(command, false, value);
    } catch (_) {
        return false;
    }
}

function applyTypingColor(editor, color) {
    const c = normalizeColor(color) || color;
    const ok = tryExecCommand('foreColor', c);
    if (!ok && editor && editor.style) {
        // Fallback: at least make future typing this color (entire editor).
        // Not as rich as per-run spans, but keeps the app usable if execCommand regresses.
        editor.style.color = c;
    }
    return ok;
}

function insertTextAtCaret(text) {
    // Prefer execCommand in Chromium (works well for contenteditable).
    if (tryExecCommand('insertText', text)) return true;

    // Fallback: Selection API
    const sel = window.getSelection && window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;

    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);

    // Move caret after inserted text node
    range.setStartAfter(node);
    range.setEndAfter(node);
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
}

function getSavedState() {
    const state = Storage.get(STORAGE_KEY, null);
    if (!state || typeof state !== 'object') return null;
    return {
        html: typeof state.html === 'string' ? state.html : '',
        color: typeof state.color === 'string' ? state.color : COLOR_SWATCHES[0].hex
    };
}

function setActiveSwatch(toolbarEl, activeHex) {
    if (!toolbarEl || typeof toolbarEl.querySelectorAll !== 'function') return;
    const swatches = toolbarEl.querySelectorAll('[data-wos-notepad-swatch]');
    swatches.forEach((btn) => {
        const hex = btn.getAttribute('data-wos-notepad-swatch') || '';
        if (hex.toLowerCase() === String(activeHex || '').toLowerCase()) {
            btn.classList.add('wos-notepad-swatch--active');
        } else {
            btn.classList.remove('wos-notepad-swatch--active');
        }
    });
}

export default {
    id: 'notepad',
    title: 'Notepad',
    iconEmoji: '📝',
    sortOrder: 5,

    mount: function({ root }) {
        if (!root) return;

        // Prepare audio graph early; unlock happens on first user gesture.
        try { Audio.ensure(); } catch (_) { /* ignore */ }

        root.className = 'wos-notepad-app';
        root.innerHTML = '';

        const saved = getSavedState();
        let currentColor = (saved && saved.color) || COLOR_SWATCHES[0].hex;

        const wrap = document.createElement('div');
        wrap.className = 'wos-notepad-wrap';

        // Some actions insert content programmatically (emoji/paste/clear). Those have their own cues.
        // Suppress the per-keystroke typing sound for a short window to avoid double-playing.
        let suppressTypeUntilMs = 0;
        const nowMs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const suppressTypeFor = (ms) => {
            const now = nowMs();
            suppressTypeUntilMs = Math.max(suppressTypeUntilMs, now + Math.max(0, ms || 0));
        };

        // Big "paper" writing area
        const paper = document.createElement('div');
        paper.className = 'wos-notepad-paper';

        const editor = document.createElement('div');
        editor.className = 'wos-notepad-editor';
        editor.setAttribute('contenteditable', 'true');
        editor.setAttribute('role', 'textbox');
        editor.setAttribute('aria-multiline', 'true');
        editor.setAttribute('aria-label', 'Notepad');
        editor.spellcheck = false;

        // Restore saved content (HTML) or start empty.
        editor.innerHTML = (saved && saved.html) ? sanitizeNotepadHtml(saved.html) : '';

        paper.appendChild(editor);

        // Top-right emoji strip (touchbar-style, swipeable)
        const emojiStrip = document.createElement('div');
        emojiStrip.className = 'wos-notepad-emoji-strip';
        emojiStrip.setAttribute('aria-label', 'Emojis');

        const emojiStripInner = document.createElement('div');
        emojiStripInner.className = 'wos-notepad-emoji-strip-inner';

        EMOJI_PALETTE.forEach((emoji) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'wos-notepad-emoji';
            b.setAttribute('aria-label', 'Emoji');
            b.textContent = emoji;
            b.addEventListener('click', () => {
                try { Audio.unlock().catch(() => {}); } catch (_) { /* ignore */ }
                // Tiny joyful "stamp" cue (keep it light; avoid music).
                try { Audio.pop(0.22); } catch (_) { /* ignore */ }
                suppressTypeFor(140);
                editor.focus({ preventScroll: true });
                insertTextAtCaret(emoji);
                scheduleSave();
            });
            emojiStripInner.appendChild(b);
        });
        emojiStrip.appendChild(emojiStripInner);

        // Bottom controls (separate cards, symbol-only)
        const controls = document.createElement('div');
        controls.className = 'wos-notepad-controls';

        const swatchRow = document.createElement('div');
        swatchRow.className = 'wos-notepad-swatches wos-notepad-card';
        COLOR_SWATCHES.forEach((c) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'wos-notepad-swatch';
            btn.setAttribute('aria-label', `Text color ${c.id}`);
            btn.setAttribute('data-wos-notepad-swatch', c.hex);
            btn.style.background = c.hex;
            btn.addEventListener('click', () => {
                try { Audio.unlock().catch(() => {}); } catch (_) { /* ignore */ }
                // Color pick feels like a gentle "plink" (a tactile selection).
                try { Audio.plink(0.28); } catch (_) { /* ignore */ }
                currentColor = c.hex;
                setActiveSwatch(controls, currentColor);
                // Make sure the next typing uses this color
                editor.focus({ preventScroll: true });
                applyTypingColor(editor, currentColor);
            });
            swatchRow.appendChild(btn);
        });

        const trashCard = document.createElement('div');
        trashCard.className = 'wos-notepad-trash wos-notepad-card';
        const trashBtn = document.createElement('button');
        trashBtn.type = 'button';
        trashBtn.className = 'wos-notepad-action';
        trashBtn.setAttribute('aria-label', 'Clear page');
        trashBtn.textContent = '🗑️';

        trashCard.appendChild(trashBtn);

        controls.appendChild(swatchRow);
        controls.appendChild(trashCard);

        // Persistence
        const saveNow = () => {
            Storage.set(STORAGE_KEY, {
                html: sanitizeNotepadHtml(editor.innerHTML),
                color: currentColor
            });
        };
        const scheduleSave = debounce(saveNow, 450);

        // Keep formatting simple:
        // - Paste becomes plain text
        // - Enter creates simple line breaks
        const onPaste = (e) => {
            try {
                e.preventDefault();
                const text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
                if (!text) return;
                try { Audio.unlock().catch(() => {}); } catch (_) { /* ignore */ }
                // Soft confirmation that something happened (paste is less "celebratory" than emoji).
                try { Audio.tick(); } catch (_) { /* ignore */ }
                suppressTypeFor(180);
                editor.focus({ preventScroll: true });
                insertTextAtCaret(text);
                scheduleSave();
            } catch (_) { /* ignore */ }
        };

        const onInput = (e) => {
            scheduleSave();

            // Fun typing SFX (only for actual character inserts; avoid deletes/undo/etc).
            try {
                const now = nowMs();
                if (now < suppressTypeUntilMs) return;

                const inputType = e && typeof e.inputType === 'string' ? e.inputType : '';
                if (!inputType || !inputType.startsWith('insert')) return;

                const data = e && typeof e.data === 'string' ? e.data : '';
                // Ignore multi-character inserts (IME/autocorrect/paste) to keep it sane.
                if (!data || data.length !== 1) return;

                const ensureUnlocked = () => {
                    try {
                        if (Audio && typeof Audio.isUnlocked === 'function' && Audio.isUnlocked()) return Promise.resolve(true);
                        if (Audio && typeof Audio.unlock === 'function') return Audio.unlock().then(() => true).catch(() => false);
                    } catch (_) { /* ignore */ }
                    return Promise.resolve(false);
                };

                const ch = data;
                const isSpace = ch === ' ';
                const isEnter = ch === '\n' || ch === '\r';
                const flavor = isEnter ? 'enter' : (isSpace ? 'space' : 'alpha');

                // Dynamic: spaces are quieter; normal letters slightly louder with random micro-variation.
                // Quieter overall (per user request) while keeping dynamics + variation.
                const base = isSpace ? 0.14 : 0.28;
                const s = Math.max(0, Math.min(1, base + (Math.random() * 0.14 - 0.07)));
                if (Audio && typeof Audio.type === 'function') {
                    ensureUnlocked().then((ok) => {
                        if (!ok) return;
                        try { Audio.type(s, flavor); } catch (_) { /* ignore */ }
                    });
                } else {
                    // Backward-compatible fallback
                    Audio.plink(isSpace ? 0.18 : 0.26);
                }
            } catch (_) { /* ignore */ }
        };

        const onPointerDown = () => {
            // Keep it simple: tapping paper just focuses for typing.
            try { Audio.unlock().catch(() => {}); } catch (_) { /* ignore */ }
            // Paper tap should feel responsive but not distracting.
            try { Audio.tick(); } catch (_) { /* ignore */ }
        };

        const onTrash = () => {
            try { Audio.unlock().catch(() => {}); } catch (_) { /* ignore */ }
            // Clearing is a "poof" (matches Letters despawn language).
            try { Audio.poof(0.75); } catch (_) { /* ignore */ }
            suppressTypeFor(240);
            editor.innerHTML = '';
            saveNow();
            // Re-apply current color so next typing is correct
            editor.focus({ preventScroll: true });
            applyTypingColor(editor, currentColor);
        };

        // Mount DOM
        wrap.appendChild(emojiStrip);
        wrap.appendChild(paper);
        wrap.appendChild(controls);
        root.appendChild(wrap);

        // Initial state
        setActiveSwatch(controls, currentColor);
        // Ensure current typing color is applied at caret position.
        // Focus after paint so on-screen keyboard can appear on touch.
        requestAnimationFrame(() => {
            editor.focus({ preventScroll: true });
            applyTypingColor(editor, currentColor);
            // Start at the beginning so a swipe-left immediately shows motion.
            // (If we start at the far right, swipe-left appears "broken" because there's nowhere to go.)
            try { emojiStripInner.scrollLeft = 0; } catch (_) { /* ignore */ }
        });

        // Safe hook: recover focus if child tries to type while editor is unfocused
        // This handles the edge case where toddlers tap around and lose focus
        const onGlobalKeyDown = (e) => {
            // Only handle printable characters (not special keys like Escape, Tab, etc.)
            // Check if key is a single character that would produce text
            const key = e.key;
            const isPrintable = key && key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
            
            // Don't interfere if user is actively interacting with a button or input
            const activeEl = document.activeElement;
            const isButtonOrInput = activeEl && (
                activeEl.tagName === 'BUTTON' ||
                activeEl.tagName === 'INPUT' ||
                activeEl.tagName === 'TEXTAREA' ||
                activeEl.hasAttribute('contenteditable')
            );
            
            // If it's a printable key and editor doesn't have focus, recover focus
            if (isPrintable && !isButtonOrInput && activeEl !== editor) {
                // Check if editor is still in the DOM (app hasn't unmounted)
                if (editor && editor.isConnected) {
                    editor.focus({ preventScroll: true });
                    // Apply current color so typing uses the right color
                    applyTypingColor(editor, currentColor);
                    // The key event will continue to the editor now that it's focused
                }
            }
        };

        // Wire events
        editor.addEventListener('input', onInput);
        editor.addEventListener('paste', onPaste);
        paper.addEventListener('pointerdown', onPointerDown);
        trashBtn.addEventListener('click', onTrash);
        // Global keyboard listener for focus recovery
        document.addEventListener('keydown', onGlobalKeyDown, true); // Use capture phase

        // Cleanup
        return function cleanup() {
            try { saveNow(); } catch (_) { /* ignore */ }
            editor.removeEventListener('input', onInput);
            editor.removeEventListener('paste', onPaste);
            paper.removeEventListener('pointerdown', onPointerDown);
            trashBtn.removeEventListener('click', onTrash);
            document.removeEventListener('keydown', onGlobalKeyDown, true);
        };
    },

    unmount: function() {
        // cleanup is handled by mount() return fn via AppHostScreen convention
    }
};


