import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock RuntimeConfig before importing Apps
let mockConfig = null;
let mockConfigLoadError = null;

vi.mock('../../core/config.js', () => ({
    RuntimeConfig: {
        load: vi.fn(async () => {
            if (mockConfigLoadError) throw mockConfigLoadError;
            return mockConfig;
        })
    }
}));

async function flushAsync() {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
}

describe('Apps registry filtering by config', () => {
    let Apps;

    beforeEach(async () => {
        vi.resetModules();
        mockConfig = null;
        mockConfigLoadError = null;

        const appsModule = await import('../index.js');
        Apps = appsModule.Apps;

        if (Apps.refreshConfig) {
            await Apps.refreshConfig();
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('shows exactly the apps named in config.apps.enabled', async () => {
        mockConfig = { apps: { enabled: ['colors', 'letters', 'notepad'] } };
        await Apps.refreshConfig();

        const ids = Apps.list().map(app => app.id).sort();
        expect(ids).toEqual(['colors', 'letters', 'notepad']);
    });

    // Safety policy: a real-world kiosk should never show the whole app surface
    // just because config failed to load. Colors is the deliberate fallback.
    it('falls back to colors-only when config load fails', async () => {
        mockConfigLoadError = new Error('Failed to load config');
        await Apps.refreshConfig();

        expect(Apps.list().map(a => a.id)).toEqual(['colors']);
    });

    it('returns null from Apps.get for apps that exist but are disabled', async () => {
        mockConfig = { apps: { enabled: ['colors'] } };
        await Apps.refreshConfig();

        expect(Apps.get('colors')).not.toBeNull();
        expect(Apps.get('letters')).toBeNull();
    });

    // Race: between when DesktopScreen first calls list() and when the config
    // load actually resolves, list() must return *something* sensible. The
    // current contract is "all apps until config arrives, then filtered."
    it('handles slow config load: shows all apps before, filtered after', async () => {
        let resolveConfig;
        const configPromise = new Promise((resolve) => { resolveConfig = resolve; });

        const { RuntimeConfig } = await import('../../core/config.js');
        RuntimeConfig.load.mockImplementationOnce(async () => {
            await configPromise;
            return { apps: { enabled: ['colors'] } };
        });

        const refreshPromise = Apps.refreshConfig();

        // Before config resolves, list() returns the full registry.
        expect(Apps.list().length).toBeGreaterThan(1);

        resolveConfig();
        await refreshPromise;
        await flushAsync();

        // After config resolves, list() is filtered.
        const after = Apps.list();
        expect(after.length).toBe(1);
        expect(after[0].id).toBe('colors');
    });
});
