/**
 * WinnieOS Utilities
 * 
 * Shared utility functions for the application
 * Add utility modules here as needed
 */

// Utilities namespace
export const Utils = {};

// Attach to window namespace for compatibility
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Utils = Utils;
}

// Utility functions will be added here as needed
// Example structure:
// - utils/dom.js - DOM manipulation helpers
// - utils/events.js - Event handling helpers
// - utils/storage.js - LocalStorage helpers
// etc.

