import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock RuntimeConfig before importing Apps
let mockConfig = null;
let mockConfigLoadError = null;

vi.mock('../../core/config.js', () => ({
    RuntimeConfig: {
        load: vi.fn(async () => {
            if (mockConfigLoadError) {
                throw mockConfigLoadError;
            }
            return mockConfig;
        })
    }
}));

async function flushAsync() {
    // Let pending microtasks and any short timers run.
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
}

describe('Apps registry filtering by config', () => {
    let Apps;

    beforeEach(async () => {
        vi.resetModules();
        mockConfig = null;
        mockConfigLoadError = null;
        
        // Reset the Apps module by re-importing
        const appsModule = await import('../index.js');
        Apps = appsModule.Apps;
        
        // Reset the enabledAppIds cache by calling refreshConfig
        if (Apps.refreshConfig) {
            await Apps.refreshConfig();
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should return all apps when config is not loaded yet (backward compatible)', async () => {
        // Simulate config not loaded (null)
        mockConfig = null;
        
        // Reset cache to simulate fresh load
        if (Apps.refreshConfig) {
            await Apps.refreshConfig();
        }
        
        // When config is null, should return all apps (backward compatible)
        const allApps = Apps.list();
        expect(allApps.length).toBeGreaterThan(0);
    });

    it('should filter apps based on config.apps.enabled array', async () => {
        // Mock config with only 'colors' enabled
        mockConfig = {
            apps: {
                enabled: ['colors']
            }
        };
        
        // Load config
        if (Apps.refreshConfig) {
            await Apps.refreshConfig();
        }
        
        const filteredApps = Apps.list();
        
        // Should only return 'colors' app
        expect(filteredApps.length).toBe(1);
        expect(filteredApps[0].id).toBe('colors');
    });

    it('should filter apps when multiple apps are enabled', async () => {
        // Mock config with multiple apps enabled
        mockConfig = {
            apps: {
                enabled: ['colors', 'animals', 'blocks']
            }
        };
        
        // Load config
        if (Apps.refreshConfig) {
            await Apps.refreshConfig();
        }
        
        const filteredApps = Apps.list();
        
        // Should return exactly the enabled apps
        expect(filteredApps.length).toBe(3);
        const appIds = filteredApps.map(app => app.id).sort();
        expect(appIds).toEqual(['animals', 'blocks', 'colors']);
    });

    it('should return empty array when config.apps.enabled is empty', async () => {
        // Mock config with empty enabled array
        mockConfig = {
            apps: {
                enabled: []
            }
        };
        
        // Load config
        if (Apps.refreshConfig) {
            await Apps.refreshConfig();
        }
        
        const filteredApps = Apps.list();
        
        // Should return empty array
        expect(filteredApps.length).toBe(0);
    });

    it('should return all apps when config.apps.enabled is missing (backward compatible)', async () => {
        // Mock config without apps.enabled
        mockConfig = {
            display: { reference: { width: 1280, height: 800 } }
        };
        
        // Load config
        if (Apps.refreshConfig) {
            await Apps.refreshConfig();
        }
        
        const allApps = Apps.list();
        
        // Should return all apps (backward compatible)
        expect(allApps.length).toBeGreaterThan(0);
    });

    it('should return all apps when config.apps.enabled is not an array (backward compatible)', async () => {
        // Mock config with invalid apps.enabled (not an array)
        mockConfig = {
            apps: {
                enabled: 'colors' // Should be array, but is string
            }
        };
        
        // Load config
        if (Apps.refreshConfig) {
            await Apps.refreshConfig();
        }
        
        const allApps = Apps.list();
        
        // Should return all apps (backward compatible)
        expect(allApps.length).toBeGreaterThan(0);
    });

    it('should return all apps when config load fails (backward compatible)', async () => {
        // Mock config load error
        mockConfigLoadError = new Error('Failed to load config');
        
        // Load config (should handle error gracefully)
        if (Apps.refreshConfig) {
            await Apps.refreshConfig();
        }
        
        const allApps = Apps.list();
        
        // Should return all apps (backward compatible)
        expect(allApps.length).toBeGreaterThan(0);
    });

    it('should filter apps correctly via Apps.get() when config is loaded', async () => {
        // Mock config with only 'colors' enabled
        mockConfig = {
            apps: {
                enabled: ['colors']
            }
        };
        
        // Load config
        if (Apps.refreshConfig) {
            await Apps.refreshConfig();
        }
        
        // Enabled app should be returned
        const colorsApp = Apps.get('colors');
        expect(colorsApp).not.toBeNull();
        expect(colorsApp.id).toBe('colors');
        
        // Disabled app should return null
        const animalsApp = Apps.get('animals');
        expect(animalsApp).toBeNull();
    });

    it('should handle race condition: wait for config before filtering', async () => {
        // Simulate slow config load
        let resolveConfig;
        const configPromise = new Promise((resolve) => {
            resolveConfig = resolve;
        });
        
        const { RuntimeConfig } = await import('../../core/config.js');
        RuntimeConfig.load.mockImplementationOnce(async () => {
            await configPromise;
            return { apps: { enabled: ['colors'] } };
        });
        
        // Reset cache
        if (Apps.refreshConfig) {
            const refreshPromise = Apps.refreshConfig();
            
            // Before config resolves, list() should return all apps
            const beforeConfig = Apps.list();
            expect(beforeConfig.length).toBeGreaterThan(1);
            
            // Resolve config
            resolveConfig();
            await refreshPromise;
            await flushAsync();
            
            // After config resolves, list() should return filtered apps
            const afterConfig = Apps.list();
            expect(afterConfig.length).toBe(1);
            expect(afterConfig[0].id).toBe('colors');
        }
    });
});

