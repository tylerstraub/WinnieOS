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

        root.className = 'wos-notepad-app';
        root.innerHTML = '';

        const saved = getSavedState();
        let currentColor = (saved && saved.color) || COLOR_SWATCHES[0].hex;

        const wrap = document.createElement('div');
        wrap.className = 'wos-notepad-wrap';

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
                editor.focus({ preventScroll: true });
                insertTextAtCaret(text);
                scheduleSave();
            } catch (_) { /* ignore */ }
        };

        const onInput = () => {
            scheduleSave();
        };

        const onPointerDown = () => {
            // Keep it simple: tapping paper just focuses for typing.
        };

        const onTrash = () => {
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

        // Wire events
        editor.addEventListener('input', onInput);
        editor.addEventListener('paste', onPaste);
        paper.addEventListener('pointerdown', onPointerDown);
        trashBtn.addEventListener('click', onTrash);

        // Cleanup
        return function cleanup() {
            try { saveNow(); } catch (_) { /* ignore */ }
            editor.removeEventListener('input', onInput);
            editor.removeEventListener('paste', onPaste);
            paper.removeEventListener('pointerdown', onPointerDown);
            trashBtn.removeEventListener('click', onTrash);
        };
    },

    unmount: function() {
        // cleanup is handled by mount() return fn via AppHostScreen convention
    }
};


