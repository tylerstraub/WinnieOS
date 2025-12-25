/**
 * WinnieOS Components
 * 
 * Component modules for the application
 * Components will be registered here as they are created
 */

// Components namespace
export const Components = {};

// Attach to window namespace for compatibility
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Components = Components;
}

// Component modules will be added here as features are built
// Example structure:
// - components/Button.js
// - components/Card.js
// - components/Modal.js
// etc.

