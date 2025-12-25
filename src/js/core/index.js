/**
 * WinnieOS Core Initialization
 * 
 * Initializes all core systems on DOM ready
 * This is the entry point for core functionality
 */

import { Display } from './display.js';
import { Viewport } from './viewport.js';
import { Kiosk } from './kiosk.js';

/**
 * Initialize all core systems
 */
function init() {
    // Initialize Display (reference resolution owner) first so CSS vars are set
    if (Display) {
        Display.init();
    } else {
        // Viewport can fall back to CSS tokens, but this should normally never happen
        console.warn('WinnieOS: Display module failed to load; falling back to CSS reference tokens');
    }

    // Initialize viewport scaling
    if (Viewport) {
        Viewport.init();
    } else {
        console.error('WinnieOS: Viewport module failed to load');
    }

    // Initialize kiosk protections
    if (Kiosk) {
        Kiosk.init();
    } else {
        console.error('WinnieOS: Kiosk module failed to load');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

