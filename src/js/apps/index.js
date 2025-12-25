/**
 * WinnieOS Apps Registry
 *
 * Apps are discoverable plug-ins. Dad adds a new app by creating:
 * - `src/js/apps/<appId>/app.js`
 *
 * Vite auto-registers these modules via `import.meta.glob`.
 */

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

function listSorted() {
    return Array.from(appsById.values()).sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.title.localeCompare(b.title);
    });
}

export const Apps = {
    list: function() {
        return listSorted();
    },
    get: function(id) {
        return appsById.get(String(id || '')) || null;
    }
};

// Attach to window namespace for compatibility/debugging
if (typeof window !== 'undefined') {
    window.WinnieOS = window.WinnieOS || {};
    window.WinnieOS.Apps = Apps;
}


