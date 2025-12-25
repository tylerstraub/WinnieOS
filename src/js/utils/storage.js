/**
 * WinnieOS Storage Utility
 * 
 * General-purpose localStorage wrapper with JSON serialization.
 * Handles errors gracefully when storage is unavailable (e.g., in kiosk/lockdown scenarios).
 * 
 * Usage:
 *   import { Storage } from './utils/storage.js';
 *   Storage.set('my.key', { data: 'value' });
 *   const value = Storage.get('my.key', defaultValue);
 *   Storage.remove('my.key');
 */

const STORAGE_PREFIX = 'winnieos.';

/**
 * Check if localStorage is available
 */
function isAvailable() {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        // Test write/read
        const testKey = '__storage_test__';
        window.localStorage.setItem(testKey, 'test');
        window.localStorage.removeItem(testKey);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Get a namespaced storage key
 */
function getKey(key) {
    if (!key || typeof key !== 'string') {
        throw new Error('Storage key must be a non-empty string');
    }
    // If key already has prefix, don't double-prefix
    if (key.startsWith(STORAGE_PREFIX)) {
        return key;
    }
    return STORAGE_PREFIX + key;
}

export const Storage = {
    /**
     * Get a value from localStorage
     * @param {string} key - Storage key (will be prefixed with 'winnieos.')
     * @param {*} defaultValue - Default value if key doesn't exist or parsing fails
     * @returns {*} The stored value or defaultValue
     */
    get: function(key, defaultValue = null) {
        if (!isAvailable()) {
            return defaultValue;
        }
        try {
            const storageKey = getKey(key);
            const raw = window.localStorage.getItem(storageKey);
            if (raw === null) {
                return defaultValue;
            }
            // Try to parse as JSON
            try {
                return JSON.parse(raw);
            } catch (_) {
                // If JSON parsing fails, return raw string (backward compatibility)
                return raw;
            }
        } catch (err) {
            // If getKey throws (invalid key), re-throw it
            if (err.message && err.message.includes('Storage key must be')) {
                throw err;
            }
            return defaultValue;
        }
    },

    /**
     * Set a value in localStorage
     * @param {string} key - Storage key (will be prefixed with 'winnieos.')
     * @param {*} value - Value to store (will be JSON stringified)
     * @returns {boolean} True if successful, false otherwise
     */
    set: function(key, value) {
        if (!isAvailable()) {
            return false;
        }
        try {
            const storageKey = getKey(key);
            // Stringify value (handles objects, arrays, primitives)
            const serialized = JSON.stringify(value);
            window.localStorage.setItem(storageKey, serialized);
            return true;
        } catch (err) {
            // If getKey throws (invalid key), re-throw it
            if (err.message && err.message.includes('Storage key must be')) {
                throw err;
            }
            // Storage quota exceeded or other error
            return false;
        }
    },

    /**
     * Remove a value from localStorage
     * @param {string} key - Storage key (will be prefixed with 'winnieos.')
     * @returns {boolean} True if successful, false otherwise
     */
    remove: function(key) {
        if (!isAvailable()) {
            return false;
        }
        try {
            const storageKey = getKey(key);
            window.localStorage.removeItem(storageKey);
            return true;
        } catch (err) {
            // If getKey throws (invalid key), re-throw it
            if (err.message && err.message.includes('Storage key must be')) {
                throw err;
            }
            return false;
        }
    },

    /**
     * Check if a key exists in localStorage
     * @param {string} key - Storage key (will be prefixed with 'winnieos.')
     * @returns {boolean} True if key exists, false otherwise
     */
    has: function(key) {
        if (!isAvailable()) {
            return false;
        }
        try {
            const storageKey = getKey(key);
            return window.localStorage.getItem(storageKey) !== null;
        } catch (err) {
            // If getKey throws (invalid key), re-throw it
            if (err.message && err.message.includes('Storage key must be')) {
                throw err;
            }
            return false;
        }
    },

    /**
     * Clear all WinnieOS storage keys (keys prefixed with 'winnieos.')
     * Note: This only clears keys with the prefix, not all localStorage
     */
    clear: function() {
        if (!isAvailable()) {
            return false;
        }
        try {
            const keysToRemove = [];
            for (let i = 0; i < window.localStorage.length; i++) {
                const key = window.localStorage.key(i);
                if (key && key.startsWith(STORAGE_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => window.localStorage.removeItem(key));
            return true;
        } catch (_) {
            return false;
        }
    },

    /**
     * Get all keys with the WinnieOS prefix
     * @returns {string[]} Array of keys (without prefix)
     */
    keys: function() {
        if (!isAvailable()) {
            return [];
        }
        try {
            const keys = [];
            for (let i = 0; i < window.localStorage.length; i++) {
                const key = window.localStorage.key(i);
                if (key && key.startsWith(STORAGE_PREFIX)) {
                    // Return key without prefix
                    keys.push(key.substring(STORAGE_PREFIX.length));
                }
            }
            return keys;
        } catch (_) {
            return [];
        }
    }
};

// Attach to window namespace for compatibility
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Utils = window.WinnieOS.Utils || {};
    window.WinnieOS.Utils.Storage = Storage;
}

