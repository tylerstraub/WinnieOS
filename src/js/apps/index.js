/**
 * WinnieOS Apps Registry
 *
 * Apps are discoverable plug-ins. Dad adds a new app by creating:
 * - `src/js/apps/<appId>/app.js`
 *
 * Vite auto-registers these modules via `import.meta.glob`.
 * Apps can be enabled/disabled via config/apps.enabled array.
 */

import { RuntimeConfig } from '../core/config.js';

function normalizeApp(def) {
    if (!def || typeof def !== 'object') return null;
    const id = typeof def.id === 'string' && def.id.trim() ? def.id.trim() : null;
    const title = typeof def.title === 'string' && def.title.trim() ? def.title.trim() : null;
    const mount = typeof def.mount === 'function' ? def.mount : null;
    const unmount = typeof def.unmount === 'function' ? def.unmount : null;
    if (!id || !title || !mount) return null;
    return {
        id,
        title,
        iconSrc: typeof def.iconSrc === 'string' ? def.iconSrc : null,
        iconEmoji: typeof def.iconEmoji === 'string' ? def.iconEmoji : null,
        sortOrder: Number.isFinite(def.sortOrder) ? def.sortOrder : 0,
        mount,
        unmount
    };
}

const modules = import.meta.glob('./*/app.js', { eager: true });
const appsById = new Map();

Object.keys(modules).forEach((path) => {
    const mod = modules[path];
    const candidate = (mod && (mod.default || mod.app)) || null;
    const app = normalizeApp(candidate);
    if (!app) {
        console.warn(`WinnieOS.Apps: invalid app module at ${path}`);
        return;
    }
    if (appsById.has(app.id)) {
        console.warn(`WinnieOS.Apps: duplicate app id "${app.id}" (skipping ${path})`);
        return;
    }
    appsById.set(app.id, app);
});

// Cache for enabled app IDs from config (null = not loaded yet, Set = loaded)
let enabledAppIds = null;

async function loadEnabledAppIds() {
    if (enabledAppIds !== null) return enabledAppIds;
    
    try {
        const config = await RuntimeConfig.load();
        if (config && config.apps && Array.isArray(config.apps.enabled)) {
            enabledAppIds = new Set(config.apps.enabled.map(id => String(id).trim()).filter(Boolean));
        } else {
            // No config or invalid config - enable all apps (backward compatible)
            enabledAppIds = new Set(appsById.keys());
        }
    } catch (err) {
        console.warn('WinnieOS.Apps: failed to load config, enabling all apps', err);
        enabledAppIds = new Set(appsById.keys());
    }
    
    return enabledAppIds;
}

function listSorted() {
    return Array.from(appsById.values()).sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.title.localeCompare(b.title);
    });
}

function listSortedFiltered(enabledSet) {
    if (!enabledSet) {
        // Config not loaded yet - return all apps (backward compatible)
        return listSorted();
    }
    return listSorted().filter(app => enabledSet.has(app.id));
}

// Load config eagerly (don't await - it will be available when needed)
if (typeof window !== 'undefined') {
    loadEnabledAppIds().catch(() => {
        // Already handled in loadEnabledAppIds
    });
}

export const Apps = {
    list: function() {
        // If config is loaded, filter; otherwise return all (will be filtered on next call)
        if (enabledAppIds !== null) {
            return listSortedFiltered(enabledAppIds);
        }
        // Config not loaded yet - return all apps
        // Trigger async load for next time
        loadEnabledAppIds().catch(() => {});
        return listSorted();
    },
    get: function(id) {
        const app = appsById.get(String(id || '')) || null;
        if (!app) return null;
        
        // If config is loaded, check if app is enabled
        if (enabledAppIds !== null && !enabledAppIds.has(app.id)) {
            return null; // App is disabled
        }
        
        return app;
    },
    /**
     * Refresh the enabled apps list from config.
     * Useful after config changes.
     */
    refreshConfig: async function() {
        enabledAppIds = null;
        await loadEnabledAppIds();
    }
};

// Attach to window namespace for compatibility/debugging
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Apps = Apps;
}


