/**
 * WinnieOS Kiosk Protections
 * 
 * Prevents browser navigation and accidental interactions
 * Essential for kiosk mode operation
 */

let initialized = false;
let dragStartHandler = null;

// Disable context menu (right-click)
function disableContextMenu(e) {
    e.preventDefault();
    return false;
}

// Block browser navigation shortcuts
function blockNavigation(e) {
    // Block F5 (refresh)
    if (e.key === 'F5') {
        e.preventDefault();
        return false;
    }

    // Block Ctrl+R, Ctrl+Shift+R (refresh)
    if (e.ctrlKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        return false;
    }

    // Block Alt+Left/Right (back/forward navigation)
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        return false;
    }

    // Block browser backspace navigation (when not in input)
    if (e.key === 'Backspace' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && !e.target.isContentEditable) {
        e.preventDefault();
        return false;
    }

    // Block Ctrl+W, Ctrl+Shift+W (close window/tab)
    if (e.ctrlKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        return false;
    }
}

// Disable drag-to-scroll gestures (reinforce Chrome args)
function preventDragScroll(e) {
    if (e.button === 1) { // Middle mouse button
        e.preventDefault();
        return false;
    }
}

function preventDragStart(e) {
    e.preventDefault();
    return false;
}

export const Kiosk = {
    init: function() {
        if (initialized) return;
        initialized = true;

        // Context menu prevention
        document.addEventListener('contextmenu', disableContextMenu);
        
        // Navigation blocking
        document.addEventListener('keydown', blockNavigation);
        
        // Drag scroll prevention
        document.addEventListener('mousedown', preventDragScroll);
        
        // Prevent default browser drag behaviors
        dragStartHandler = preventDragStart;
        document.addEventListener('dragstart', dragStartHandler);
    },

    /**
     * For development/testing only.
     * In production kiosk mode we generally never “un-init”, but Vitest/HMR may want cleanup.
     */
    _resetForTests: function() {
        // Remove listeners if they were added.
        if (initialized) {
            document.removeEventListener('contextmenu', disableContextMenu);
            document.removeEventListener('keydown', blockNavigation);
            document.removeEventListener('mousedown', preventDragScroll);
            if (dragStartHandler) {
                document.removeEventListener('dragstart', dragStartHandler);
            }
        }
        initialized = false;
        dragStartHandler = null;
    }
};

// Attach to window namespace for compatibility
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Kiosk = Kiosk;
}

