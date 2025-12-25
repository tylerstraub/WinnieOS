import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Load the config loader module
const { loadConfig, deepMerge, FALLBACK_DEFAULTS } = require('../config-loader.js');

describe('config-loader', () => {
  let testConfigDir;
  let originalConsoleLog;
  let originalConsoleError;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Create a temporary directory for each test (this will be the project root)
    testConfigDir = fs.mkdtempSync(join(os.tmpdir(), 'winnieos-config-test-'));
    // Create config subdirectory
    const configSubDir = join(testConfigDir, 'config');
    fs.mkdirSync(configSubDir, { recursive: true });
    
    // Mock console.log and console.error to capture verbose output
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    consoleLogSpy = vi.fn();
    consoleErrorSpy = vi.fn();
    console.log = consoleLogSpy;
    console.error = consoleErrorSpy;
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    
    // Clean up temporary directory
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('deepMerge', () => {
    it('should merge simple objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      const result = deepMerge(target, source);
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should deep merge nested objects', () => {
      const target = {
        server: { port: 3000, host: 'localhost' },
        display: { reference: { width: 1280, height: 800 } }
      };
      const source = {
        server: { port: 8080 },
        display: { reference: { width: 1920 } }
      };
      const result = deepMerge(target, source);
      expect(result).toEqual({
        server: { port: 8080, host: 'localhost' },
        display: { reference: { width: 1920, height: 800 } }
      });
    });

    it('should replace arrays, not merge them', () => {
      const target = { apps: { enabled: ['colors', 'animals'] } };
      const source = { apps: { enabled: ['blocks'] } };
      const result = deepMerge(target, source);
      expect(result).toEqual({ apps: { enabled: ['blocks'] } });
    });

    it('should add new keys from source', () => {
      const target = { a: 1 };
      const source = { b: 2, c: { nested: 'value' } };
      const result = deepMerge(target, source);
      expect(result).toEqual({ a: 1, b: 2, c: { nested: 'value' } });
    });

    it('should skip null and undefined values', () => {
      const target = { a: 1, b: 2 };
      const source = { a: null, b: undefined, c: 3 };
      const result = deepMerge(target, source);
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should handle empty objects', () => {
      const target = { a: 1 };
      const source = {};
      const result = deepMerge(target, source);
      expect(result).toEqual({ a: 1 });
    });

    it('should handle deeply nested structures', () => {
      const target = {
        level1: {
          level2: {
            level3: { value: 'original' },
            other: 'preserved'
          }
        }
      };
      const source = {
        level1: {
          level2: {
            level3: { value: 'overridden' }
          }
        }
      };
      const result = deepMerge(target, source);
      expect(result).toEqual({
        level1: {
          level2: {
            level3: { value: 'overridden' },
            other: 'preserved'
          }
        }
      });
    });
  });

  describe('loadConfig', () => {
    it('should load default config when it exists', () => {
      const defaultConfig = {
        server: { port: 3000, host: 'localhost' },
        display: { reference: { width: 1280, height: 800 } },
        logging: { level: 'info', filename: 'logs/winnieos.log' },
        apps: { enabled: ['colors'] }
      };
      
      fs.writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(defaultConfig),
        'utf8'
      );

      const config = loadConfig(testConfigDir, { verbose: false });
      expect(config).toEqual(defaultConfig);
    });

    it('should create default config from fallback when missing', () => {
      // Remove config directory to test creation
      fs.rmSync(join(testConfigDir, 'config'), { recursive: true, force: true });
      
      const config = loadConfig(testConfigDir, {
        createDefaultIfMissing: true,
        verbose: false
      });

      expect(config).toEqual(FALLBACK_DEFAULTS);
      
      // Verify file was created
      const createdFile = join(testConfigDir, 'config', 'default.json');
      expect(fs.existsSync(createdFile)).toBe(true);
      const fileContent = JSON.parse(fs.readFileSync(createdFile, 'utf8'));
      expect(fileContent).toEqual(FALLBACK_DEFAULTS);
    });

    it('should throw error when default config missing and createDefaultIfMissing is false', () => {
      expect(() => {
        loadConfig(testConfigDir, {
          createDefaultIfMissing: false,
          verbose: false
        });
      }).toThrow('Default config file not found');
    });

    it('should recreate default config when corrupted', () => {
      // Write invalid JSON
      fs.writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        '{ invalid json }',
        'utf8'
      );

      const config = loadConfig(testConfigDir, {
        createDefaultIfMissing: true,
        verbose: false
      });

      expect(config).toEqual(FALLBACK_DEFAULTS);
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Verify file was recreated with valid JSON
      const recreatedFile = join(testConfigDir, 'config', 'default.json');
      const fileContent = JSON.parse(fs.readFileSync(recreatedFile, 'utf8'));
      expect(fileContent).toEqual(FALLBACK_DEFAULTS);
    });

    it('should merge local config with default config', () => {
      const defaultConfig = {
        server: { port: 3000, host: 'localhost' },
        display: { reference: { width: 1280, height: 800 } },
        apps: { enabled: ['colors'] }
      };
      const localConfig = {
        server: { port: 8080 },
        apps: { enabled: ['animals', 'blocks'] }
      };

      fs.writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(defaultConfig),
        'utf8'
      );
      fs.writeFileSync(
        join(testConfigDir, 'config', 'local.json'),
        JSON.stringify(localConfig),
        'utf8'
      );

      const config = loadConfig(testConfigDir, { verbose: false });
      
      expect(config.server.port).toBe(8080);
      expect(config.server.host).toBe('localhost'); // Preserved from default
      expect(config.display.reference.width).toBe(1280); // Preserved from default
      expect(config.apps.enabled).toEqual(['animals', 'blocks']); // Replaced from local
    });

    it('should use defaults only when local config is missing', () => {
      const defaultConfig = {
        server: { port: 3000, host: 'localhost' },
        display: { reference: { width: 1280, height: 800 } },
        logging: { level: 'info', filename: 'logs/winnieos.log' },
        apps: { enabled: ['colors'] }
      };

      fs.writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(defaultConfig),
        'utf8'
      );

      const config = loadConfig(testConfigDir, { verbose: false });
      expect(config).toEqual(defaultConfig);
    });

    it('should use defaults only when local config is corrupted', () => {
      const defaultConfig = {
        server: { port: 3000, host: 'localhost' },
        display: { reference: { width: 1280, height: 800 } },
        logging: { level: 'info', filename: 'logs/winnieos.log' },
        apps: { enabled: ['colors'] }
      };

      fs.writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(defaultConfig),
        'utf8'
      );
      fs.writeFileSync(
        join(testConfigDir, 'config', 'local.json'),
        '{ invalid json }',
        'utf8'
      );

      const config = loadConfig(testConfigDir, { verbose: false });
      
      // Should use defaults only
      expect(config).toEqual(defaultConfig);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should deep merge nested objects correctly', () => {
      const defaultConfig = {
        display: {
          reference: { width: 1280, height: 800 },
          other: 'preserved'
        }
      };
      const localConfig = {
        display: {
          reference: { width: 1920 }
        }
      };

      fs.writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(defaultConfig),
        'utf8'
      );
      fs.writeFileSync(
        join(testConfigDir, 'config', 'local.json'),
        JSON.stringify(localConfig),
        'utf8'
      );

      const config = loadConfig(testConfigDir, { verbose: false });
      
      expect(config.display.reference.width).toBe(1920); // Overridden
      expect(config.display.reference.height).toBe(800); // Preserved
      expect(config.display.other).toBe('preserved'); // Preserved
    });

    it('should create config directory if it does not exist', () => {
      const nonExistentProjectRoot = join(testConfigDir, 'nonexistent');
      const expectedConfigDir = join(nonExistentProjectRoot, 'config');
      
      loadConfig(nonExistentProjectRoot, {
        createDefaultIfMissing: true,
        verbose: false
      });

      expect(fs.existsSync(expectedConfigDir)).toBe(true);
      expect(fs.existsSync(join(expectedConfigDir, 'default.json'))).toBe(true);
    });

    it('should log verbose output when verbose is true', () => {
      const defaultConfig = { 
        server: { port: 3000, host: 'localhost' },
        display: { reference: { width: 1280, height: 800 } },
        logging: { level: 'info', filename: 'logs/winnieos.log' },
        apps: { enabled: ['colors'] }
      };
      fs.writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(defaultConfig),
        'utf8'
      );

      loadConfig(testConfigDir, { verbose: true });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.map(call => call.join(' ')).join(' ');
      expect(logCalls).toContain('Loaded default config');
      expect(logCalls).toContain('Configuration loaded');
    });

    it('should not log verbose output when verbose is false', () => {
      const defaultConfig = { server: { port: 3000 } };
      fs.writeFileSync(
        join(testConfigDir, 'default.json'),
        JSON.stringify(defaultConfig),
        'utf8'
      );

      loadConfig(testConfigDir, { verbose: false });

      // Should not have verbose logs, but errors might still be logged
      const logCalls = consoleLogSpy.mock.calls.map(call => call.join(' ')).join(' ');
      expect(logCalls).not.toContain('Loaded default config');
      expect(logCalls).not.toContain('Configuration loaded');
    });

    it('should handle local config with partial overrides', () => {
      const defaultConfig = {
        server: { port: 3000, host: 'localhost' },
        logging: { level: 'info', filename: 'logs/app.log' },
        apps: { enabled: ['colors'] }
      };
      const localConfig = {
        server: { port: 8080 },
        logging: { level: 'debug' }
      };

      fs.writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(defaultConfig),
        'utf8'
      );
      fs.writeFileSync(
        join(testConfigDir, 'config', 'local.json'),
        JSON.stringify(localConfig),
        'utf8'
      );

      const config = loadConfig(testConfigDir, { verbose: false });
      
      expect(config.server.port).toBe(8080); // Overridden
      expect(config.server.host).toBe('localhost'); // Preserved
      expect(config.logging.level).toBe('debug'); // Overridden
      expect(config.logging.filename).toBe('logs/app.log'); // Preserved
      expect(config.apps.enabled).toEqual(['colors']); // Preserved
    });

    it('should handle empty local config', () => {
      const defaultConfig = { 
        server: { port: 3000, host: 'localhost' },
        display: { reference: { width: 1280, height: 800 } },
        logging: { level: 'info', filename: 'logs/winnieos.log' },
        apps: { enabled: ['colors'] }
      };
      fs.writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(defaultConfig),
        'utf8'
      );
      fs.writeFileSync(
        join(testConfigDir, 'config', 'local.json'),
        '{}',
        'utf8'
      );

      const config = loadConfig(testConfigDir, { verbose: false });
      expect(config).toEqual(defaultConfig);
    });

    it('should use process.cwd() when configDir is not provided', () => {
      const originalCwd = process.cwd();
      const tempDir = fs.mkdtempSync(join(os.tmpdir(), 'winnieos-cwd-test-'));
      
      try {
        process.chdir(tempDir);
        const configDir = join(tempDir, 'config');
        fs.mkdirSync(configDir, { recursive: true });
        
        const defaultConfig = { server: { port: 3000 } };
        fs.writeFileSync(
          join(configDir, 'default.json'),
          JSON.stringify(defaultConfig),
          'utf8'
        );

        const config = loadConfig(null, { verbose: false });
        expect(config).toEqual(defaultConfig);
      } finally {
        process.chdir(originalCwd);
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('FALLBACK_DEFAULTS', () => {
    it('should have correct structure', () => {
      expect(FALLBACK_DEFAULTS).toHaveProperty('server');
      expect(FALLBACK_DEFAULTS).toHaveProperty('display');
      expect(FALLBACK_DEFAULTS).toHaveProperty('logging');
      expect(FALLBACK_DEFAULTS).toHaveProperty('apps');
      
      expect(FALLBACK_DEFAULTS.server).toHaveProperty('port');
      expect(FALLBACK_DEFAULTS.server).toHaveProperty('host');
      expect(FALLBACK_DEFAULTS.display.reference).toHaveProperty('width');
      expect(FALLBACK_DEFAULTS.display.reference).toHaveProperty('height');
      expect(FALLBACK_DEFAULTS.logging).toHaveProperty('level');
      expect(FALLBACK_DEFAULTS.logging).toHaveProperty('filename');
      expect(FALLBACK_DEFAULTS.apps).toHaveProperty('enabled');
      expect(Array.isArray(FALLBACK_DEFAULTS.apps.enabled)).toBe(true);
    });

    it('should match expected default values', () => {
      expect(FALLBACK_DEFAULTS.server.port).toBe(3000);
      expect(FALLBACK_DEFAULTS.server.host).toBe('localhost');
      expect(FALLBACK_DEFAULTS.display.reference.width).toBe(1280);
      expect(FALLBACK_DEFAULTS.display.reference.height).toBe(800);
      expect(FALLBACK_DEFAULTS.logging.level).toBe('info');
      expect(FALLBACK_DEFAULTS.logging.filename).toBe('logs/winnieos.log');
      expect(FALLBACK_DEFAULTS.apps.enabled).toEqual(['colors']);
    });
  });
});

