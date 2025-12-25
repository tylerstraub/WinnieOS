/**
 * WinnieOS Screens Registry
 */

import { StartupScreen } from './StartupScreen.js';
import { DesktopScreen } from './DesktopScreen.js';
import { AppHostScreen } from './AppHostScreen.js';

export const Screens = {
    startup: StartupScreen,
    desktop: DesktopScreen,
    app: AppHostScreen
};

// Attach to window namespace for compatibility/debugging
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Screens = Screens;
}


