/**
 * WinnieOS Utilities
 * 
 * Shared utility functions for the application
 * Add utility modules here as needed
 */

// Ensure the shared Utils namespace exists first, so utility modules can safely attach to it.
// NOTE: This file must NOT overwrite `window.WinnieOS.Utils`, otherwise previously-attached
// utilities (Storage/Background/Audio/etc) would disappear.
export const Utils = (typeof window !== 'undefined')
    ? (window.WinnieOS = window.WinnieOS || {}, window.WinnieOS.Utils = window.WinnieOS.Utils || {}, window.WinnieOS.Utils)
    : {};

// Import utility modules (they attach themselves to `window.WinnieOS.Utils`)
import './storage.js';
import './background.js';
import './audio.js';

// Utility modules are imported above and attached to window.WinnieOS.Utils
// Example structure:
// - utils/storage.js - LocalStorage helpers (imported above)
// - utils/dom.js - DOM manipulation helpers (add as needed)
// - utils/events.js - Event handling helpers (add as needed)
// etc.

