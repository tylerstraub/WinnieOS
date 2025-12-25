/**
 * WinnieOS Background Color Utility
 * 
 * Manages global background color preferences and application.
 * Applies color to both body and canvas elements with natural gradient.
 */

import { Storage } from './storage.js';

const STORAGE_KEY = 'preferences.backgroundColor';
const DEFAULT_PRIMARY = '#667eea';
const DEFAULT_SECONDARY = '#764ba2';

/**
 * Convert RGB values to hex color string
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} Hex color string (e.g., "#ff0000")
 */
function rgbToHex(r, g, b) {
    const toHex = (n) => {
        const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert hex color string to RGB values
 * @param {string} hex - Hex color string (e.g., "#ff0000", "ff0000", or "#f00")
 * @returns {{r: number, g: number, b: number}} RGB values, or default black if invalid
 */
function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') {
        return { r: 0, g: 0, b: 0 };
    }
    
    // Remove # prefix if present
    let cleanHex = hex.replace('#', '').trim();
    
    // Handle 3-digit hex (#abc -> #aabbcc)
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(char => char + char).join('');
    }
    
    // Validate: must be 6 hex digits
    if (cleanHex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(cleanHex)) {
        return { r: 0, g: 0, b: 0 };
    }
    
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    
    // Validate parsed values (should never be NaN if regex passed, but double-check)
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
        return { r: 0, g: 0, b: 0 };
    }
    
    return { r, g, b };
}

/**
 * Generate a natural secondary color from a primary color
 * Creates a complementary/secondary color for gradient
 * @param {string} primaryHex - Primary color hex string
 * @returns {string} Secondary color hex string
 */
function generateSecondaryColor(primaryHex) {
    const rgb = hexToRgb(primaryHex);
    // Shift hue by ~30 degrees for natural gradient
    // Convert to HSL, shift hue, convert back
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let h = 0;
    if (delta !== 0) {
        if (max === r) {
            h = ((g - b) / delta) % 6;
        } else if (max === g) {
            h = (b - r) / delta + 2;
        } else {
            h = (r - g) / delta + 4;
        }
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    
    // Shift hue by 30 degrees
    h = (h + 30) % 360;
    
    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    
    // Convert HSL back to RGB
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    
    let r2 = 0, g2 = 0, b2 = 0;
    if (h < 60) {
        r2 = c; g2 = x; b2 = 0;
    } else if (h < 120) {
        r2 = x; g2 = c; b2 = 0;
    } else if (h < 180) {
        r2 = 0; g2 = c; b2 = x;
    } else if (h < 240) {
        r2 = 0; g2 = x; b2 = c;
    } else if (h < 300) {
        r2 = x; g2 = 0; b2 = c;
    } else {
        r2 = c; g2 = 0; b2 = x;
    }
    
    return rgbToHex(
        Math.round((r2 + m) * 255),
        Math.round((g2 + m) * 255),
        Math.round((b2 + m) * 255)
    );
}

/**
 * Apply background color to body and canvas
 * @param {string} primaryHex - Primary color hex string
 * @param {string} secondaryHex - Optional secondary color (auto-generated if not provided)
 */
function applyBackgroundColor(primaryHex, secondaryHex = null) {
    if (!primaryHex || typeof primaryHex !== 'string') {
        return;
    }
    
    const secondary = secondaryHex || generateSecondaryColor(primaryHex);
    
    const body = document.body;
    const canvas = document.getElementById('winnieos-canvas');
    
    if (body) {
        body.style.setProperty('background', primaryHex);
    }
    
    if (canvas) {
        canvas.style.setProperty(
            'background',
            `linear-gradient(135deg, ${primaryHex} 0%, ${secondary} 100%)`
        );
    }
}

/**
 * Get saved background color preference
 * @returns {string|null} Hex color string or null if not set
 */
function getSavedColor() {
    return Storage.get(STORAGE_KEY, null);
}

/**
 * Save background color preference
 * @param {string} hexColor - Hex color string
 * @returns {boolean} True if saved successfully
 */
function saveColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') {
        return false;
    }
    return Storage.set(STORAGE_KEY, hexColor);
}

/**
 * Load and apply saved background color preference
 * Falls back to default if no preference is saved
 */
function loadSavedColor() {
    const saved = getSavedColor();
    if (saved) {
        applyBackgroundColor(saved);
    } else {
        // Apply defaults
        applyBackgroundColor(DEFAULT_PRIMARY, DEFAULT_SECONDARY);
    }
}

export const Background = {
    apply: applyBackgroundColor,
    getSaved: getSavedColor,
    save: saveColor,
    load: loadSavedColor,
    rgbToHex,
    hexToRgb,
    generateSecondary: generateSecondaryColor
};

// Attach to window namespace for compatibility/debugging
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Utils = window.WinnieOS.Utils || {};
    window.WinnieOS.Utils.Background = Background;
}

