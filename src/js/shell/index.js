/**
 * Shell entrypoint
 * Initializes the always-mounted WinnieOS shell on DOM ready.
 */

import { Shell } from './shell.js';

function init() {
    if (!Shell || typeof Shell.init !== 'function') return;
    Shell.init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}


