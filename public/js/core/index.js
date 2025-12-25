/**
 * WinnieOS Core Initialization
 * 
 * Initializes all core systems on DOM ready
 * This is the entry point for core functionality
 */

(function() {
    'use strict';

    const WinnieOS = window.WinnieOS = window.WinnieOS || {};

    /**
     * Initialize all core systems
     */
    function init() {
        // Initialize Display (reference resolution owner) first so CSS vars are set
        if (WinnieOS.Display) {
            WinnieOS.Display.init();
        } else {
            // Viewport can fall back to CSS tokens, but this should normally never happen
            // because `public/index.html` loads `js/core/display.js` before `viewport.js`.
            console.warn('WinnieOS: Display module failed to load; falling back to CSS reference tokens');
        }

        // Initialize viewport scaling
        if (WinnieOS.Viewport) {
            WinnieOS.Viewport.init();
        } else {
            console.error('WinnieOS: Viewport module failed to load');
        }

        // Initialize kiosk protections
        if (WinnieOS.Kiosk) {
            WinnieOS.Kiosk.init();
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
})();

