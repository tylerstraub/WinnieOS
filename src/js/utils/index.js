/**
 * WinnieOS Utilities
 * 
 * Shared utility functions for the application
 * Add utility modules here as needed
 */

// Import utility modules
import './storage.js';

// Utilities namespace
export const Utils = {};

// Attach to window namespace for compatibility
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Utils = Utils;
}

// Utility modules are imported above and attached to window.WinnieOS.Utils
// Example structure:
// - utils/storage.js - LocalStorage helpers (imported above)
// - utils/dom.js - DOM manipulation helpers (add as needed)
// - utils/events.js - Event handling helpers (add as needed)
// etc.

