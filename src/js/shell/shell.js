/**
 * WinnieOS Shell
 *
 * Always-mounted UI chrome + screen host.
 * - Top-left Home button (returns to desktop)
 * - Mounts exactly one screen at a time into content host
 */

import { Navigation } from '../nav/navigation.js';
import { Apps } from '../apps/index.js';
import { Screens } from '../screens/index.js';

let initialized = false;
let unsubscribe = null;
let shellEl = null;
let contentEl = null;
let activeScreen = null;
let activeKey = null;

function getCanvas() {
    return document.getElementById('winnieos-canvas');
}

function ensureDom() {
    const canvas = getCanvas();
    if (!canvas) return false;

    // If JS is running, remove the HTML fallback so it doesn't push the Shell out of view.
    const fallback = canvas.querySelector('.wos-html-fallback');
    if (fallback && fallback.parentNode) {
        try { fallback.parentNode.removeChild(fallback); } catch (_) { /* ignore */ }
    }

    shellEl = canvas.querySelector('#wos-shell');
    if (!shellEl) {
        shellEl = document.createElement('div');
        shellEl.id = 'wos-shell';
        canvas.appendChild(shellEl);
    }

    let topbar = shellEl.querySelector('#wos-topbar');
    if (!topbar) {
        topbar = document.createElement('div');
        topbar.id = 'wos-topbar';
        shellEl.appendChild(topbar);
    }

    let homeBtn = shellEl.querySelector('#wos-home-btn');
    if (!homeBtn) {
        homeBtn = document.createElement('button');
        homeBtn.id = 'wos-home-btn';
        homeBtn.type = 'button';
        homeBtn.setAttribute('aria-label', 'Home');
        homeBtn.innerHTML = `<span class="wos-home-icon" aria-hidden="true">⌂</span>`;
        homeBtn.addEventListener('click', () => Navigation.goHome());
        topbar.appendChild(homeBtn);
    }

    contentEl = shellEl.querySelector('#wos-content');
    if (!contentEl) {
        contentEl = document.createElement('div');
        contentEl.id = 'wos-content';
        shellEl.appendChild(contentEl);
    }

    return true;
}

function unmountActive() {
    if (activeScreen && typeof activeScreen.unmount === 'function') {
        try { activeScreen.unmount(); } catch (_) { /* ignore */ }
    }
    activeScreen = null;
}

function mountForState(state) {
    if (!contentEl || !shellEl) return;
    const screenName = state && state.screen ? state.screen : 'desktop';
    shellEl.dataset.screen = screenName;

    const next = Screens[screenName] || Screens.desktop;
    const nextKey = screenName === 'app'
        ? `app:${String(state && state.appId || '')}`
        : screenName;
    if (activeScreen === next && activeKey === nextKey) return;

    unmountActive();
    activeScreen = next;
    activeKey = nextKey;
    if (activeScreen && typeof activeScreen.mount === 'function') {
        activeScreen.mount({
            root: contentEl,
            nav: Navigation,
            apps: Apps,
            appId: state && state.appId
        });
    }
}

export const Shell = {
    init: function() {
        if (initialized) return;
        if (!ensureDom()) return;
        initialized = true;

        // Start navigation and mount initial screen
        Navigation.init({ initialState: { screen: 'startup' } });
        unsubscribe = Navigation.subscribe(mountForState);
        mountForState(Navigation.getState());
    },

    /**
     * For development/testing only.
     */
    _resetForTests: function() {
        if (unsubscribe) {
            try { unsubscribe(); } catch (_) { /* ignore */ }
        }
        unsubscribe = null;
        unmountActive();
        initialized = false;
        shellEl = null;
        contentEl = null;
        activeKey = null;
    }
};

// Attach to window namespace for compatibility/debugging
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Shell = Shell;
}


