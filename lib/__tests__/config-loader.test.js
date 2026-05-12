import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const { loadConfig, deepMerge, FALLBACK_DEFAULTS } = require('../config-loader.js');

describe('config-loader', () => {
    let testConfigDir;
    let consoleErrorSpy;
    let originalConsoleError;

    beforeEach(() => {
        testConfigDir = fs.mkdtempSync(join(os.tmpdir(), 'winnieos-config-test-'));
        fs.mkdirSync(join(testConfigDir, 'config'), { recursive: true });

        originalConsoleError = console.error;
        consoleErrorSpy = vi.fn();
        console.error = consoleErrorSpy;
    });

    afterEach(() => {
        console.error = originalConsoleError;
        if (fs.existsSync(testConfigDir)) {
            fs.rmSync(testConfigDir, { recursive: true, force: true });
        }
    });

    function writeConfig(name, contents) {
        fs.writeFileSync(
            join(testConfigDir, 'config', name),
            typeof contents === 'string' ? contents : JSON.stringify(contents),
            'utf8'
        );
    }

    describe('deepMerge', () => {
        // The single most important deepMerge policy: arrays REPLACE rather than
        // concatenate. apps.enabled relies on this — a local override should
        // replace the default list, not append to it.
        it('replaces arrays rather than merging them', () => {
            const target = { apps: { enabled: ['colors', 'letters'] } };
            const source = { apps: { enabled: ['notepad'] } };
            expect(deepMerge(target, source)).toEqual({ apps: { enabled: ['notepad'] } });
        });

        // Null/undefined in source are skipped, not used to delete target keys.
        // This means `{ "logging": null }` in local.json won't blow away logging.
        it('skips null and undefined values from source', () => {
            const result = deepMerge({ a: 1, b: 2 }, { a: null, b: undefined, c: 3 });
            expect(result).toEqual({ a: 1, b: 2, c: 3 });
        });

        // The contract that the whole system relies on for local.json overrides.
        it('deep-merges nested objects so partial overrides preserve siblings', () => {
            const target = { display: { reference: { width: 1280, height: 800 }, other: 'kept' } };
            const source = { display: { reference: { width: 1920 } } };
            expect(deepMerge(target, source)).toEqual({
                display: { reference: { width: 1920, height: 800 }, other: 'kept' }
            });
        });
    });

    describe('loadConfig', () => {
        it('deep-merges local.json over default.json', () => {
            writeConfig('default.json', {
                server: { port: 3000, host: 'localhost' },
                apps: { enabled: ['colors'] }
            });
            writeConfig('local.json', {
                server: { port: 8080 },
                apps: { enabled: ['letters', 'notepad'] }
            });

            const config = loadConfig(testConfigDir, { verbose: false });
            expect(config.server.port).toBe(8080);              // overridden
            expect(config.server.host).toBe('localhost');        // preserved from default
            expect(config.apps.enabled).toEqual(['letters', 'notepad']); // array replaced
        });

        // Recovery behavior: a corrupted default.json shouldn't leave the kiosk
        // stuck — fall back to FALLBACK_DEFAULTS and recreate the file.
        it('recovers when default.json is corrupted', () => {
            writeConfig('default.json', '{ invalid json }');

            const config = loadConfig(testConfigDir, {
                createDefaultIfMissing: true,
                verbose: false
            });

            expect(config).toEqual(FALLBACK_DEFAULTS);
            expect(consoleErrorSpy).toHaveBeenCalled();
            // File should be rewritten with valid JSON.
            const recreated = JSON.parse(
                fs.readFileSync(join(testConfigDir, 'config', 'default.json'), 'utf8')
            );
            expect(recreated).toEqual(FALLBACK_DEFAULTS);
        });

        // Recovery behavior: a corrupted local.json should NOT take the whole
        // kiosk down — just ignore it and use the default.
        it('falls back to default when local.json is corrupted', () => {
            const defaultConfig = {
                server: { port: 3000, host: 'localhost' },
                apps: { enabled: ['colors'] }
            };
            writeConfig('default.json', defaultConfig);
            writeConfig('local.json', '{ invalid json }');

            const config = loadConfig(testConfigDir, { verbose: false });
            expect(config).toEqual(defaultConfig);
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        // Bootstrap behavior on a fresh install (or after `git clean`): a missing
        // default.json should be created from FALLBACK_DEFAULTS, not crash.
        it('creates default.json from FALLBACK_DEFAULTS when missing', () => {
            fs.rmSync(join(testConfigDir, 'config'), { recursive: true, force: true });

            const config = loadConfig(testConfigDir, {
                createDefaultIfMissing: true,
                verbose: false
            });

            expect(config).toEqual(FALLBACK_DEFAULTS);
            expect(fs.existsSync(join(testConfigDir, 'config', 'default.json'))).toBe(true);
        });

        it('throws when default.json is missing and createDefaultIfMissing is false', () => {
            expect(() =>
                loadConfig(testConfigDir, { createDefaultIfMissing: false, verbose: false })
            ).toThrow('Default config file not found');
        });
    });
});
