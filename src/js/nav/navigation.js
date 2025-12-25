/**
 * WinnieOS Navigation
 *
 * Very small in-memory navigation state machine:
 * - startup -> desktop -> app
 *
 * We keep it simple and toddler-friendly:
 * - Home always returns to desktop (no deep back stack yet).
 */

let initialized = false;
let state = { screen: 'startup' };
const listeners = new Set();

function isSameState(a, b) {
    if (!a || !b) return false;
    if (a.screen !== b.screen) return false;
    if (a.screen === 'app') return a.appId === b.appId;
    return true;
}

function notify() {
    listeners.forEach((fn) => {
        try { fn(Navigation.getState()); } catch (_) { /* ignore */ }
    });
}

function setState(next) {
    const cleaned = next && typeof next === 'object' ? next : { screen: 'desktop' };
    const nextState = cleaned.screen === 'app'
        ? { screen: 'app', appId: String(cleaned.appId || '') }
        : { screen: cleaned.screen === 'startup' ? 'startup' : 'desktop' };

    if (isSameState(state, nextState)) return;
    state = nextState;
    notify();
}

export const Navigation = {
    init: function(options) {
        if (initialized) return;
        initialized = true;
        if (options && options.initialState) setState(options.initialState);
        notify();
    },

    getState: function() {
        return { ...state };
    },

    subscribe: function(fn) {
        if (typeof fn !== 'function') return function() {};
        listeners.add(fn);
        return function unsubscribe() {
            listeners.delete(fn);
        };
    },

    start: function() {
        setState({ screen: 'startup' });
    },

    goHome: function() {
        setState({ screen: 'desktop' });
    },

    openApp: function(appId) {
        setState({ screen: 'app', appId });
    },

    /**
     * For development/testing only.
     */
    _resetForTests: function() {
        initialized = false;
        state = { screen: 'startup' };
        listeners.clear();
    }
};

// Attach to window namespace for compatibility/debugging
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Navigation = Navigation;
}


