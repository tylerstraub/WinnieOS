/**
 * Configuration Loader
 * 
 * Single source of truth for loading and merging configuration files.
 * Supports both CommonJS (require) and ES modules (import).
 * 
 * Loads config/default.json (required) and merges with config/local.json (optional).
 * Uses deep merging so nested objects are properly combined.
 */

const fs = require('fs');
const path = require('path');

/**
 * Deep merge two objects, with source overriding target
 * Arrays are replaced (not merged) to match expected behavior
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] === null || source[key] === undefined) {
      continue; // Skip null/undefined values
    }
    
    if (Array.isArray(source[key])) {
      // Arrays are replaced, not merged
      result[key] = source[key];
    } else if (
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      // Recursively merge nested objects
      result[key] = deepMerge(target[key], source[key]);
    } else {
      // Primitive values or new keys
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * Load and parse a JSON file safely
 * @param {string} filePath - Path to JSON file
 * @returns {object|null} - Parsed JSON object or null if file doesn't exist or is invalid
 */
function loadJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse ${filePath}: ${err.message}`);
  }
}

/**
 * Fallback defaults used only if config/default.json is missing
 * These should match config/default.json exactly
 */
const FALLBACK_DEFAULTS = {
  server: {
    port: 3000,
    host: "localhost"
  },
  display: {
    reference: {
      width: 1280,
      height: 800
    }
  },
  logging: {
    level: "info",
    filename: "logs/winnieos.log"
  },
  apps: {
    enabled: [
      "colors"
    ]
  }
};

/**
 * Load configuration from files
 * 
 * @param {string} configDir - Directory containing config files (default: process.cwd() + '/config')
 * @param {object} options - Options
 * @param {boolean} options.createDefaultIfMissing - Create default.json if missing (default: true)
 * @param {boolean} options.verbose - Log loading details (default: false)
 * @returns {object} - Merged configuration object
 */
function loadConfig(configDir = null, options = {}) {
  const {
    createDefaultIfMissing = true,
    verbose = false
  } = options;
  
  // Determine config directory
  // If configDir is provided, it's the project root - join with 'config'
  // If not provided, use process.cwd() + 'config'
  const actualConfigDir = configDir 
    ? path.join(configDir, 'config')
    : path.join(process.cwd(), 'config');
  
  // Ensure config directory exists
  if (!fs.existsSync(actualConfigDir)) {
    fs.mkdirSync(actualConfigDir, { recursive: true });
    if (verbose) {
      console.log(`Created config directory: ${actualConfigDir}`);
    }
  }
  
  const defaultConfigPath = path.join(actualConfigDir, 'default.json');
  const localConfigPath = path.join(actualConfigDir, 'local.json');
  
  // Load default config
  let defaultConfig;
  try {
    const loaded = loadJsonFile(defaultConfigPath);
    if (loaded) {
      defaultConfig = loaded;
      if (verbose) {
        console.log(`Loaded default config from: ${defaultConfigPath}`);
      }
    } else {
      // File doesn't exist
      if (createDefaultIfMissing) {
        if (verbose) {
          console.log(`Default config not found, creating from fallback defaults...`);
        }
        defaultConfig = FALLBACK_DEFAULTS;
        fs.writeFileSync(
          defaultConfigPath,
          JSON.stringify(FALLBACK_DEFAULTS, null, 2),
          'utf8'
        );
        if (verbose) {
          console.log(`Created default config at: ${defaultConfigPath}`);
        }
      } else {
        throw new Error(`Default config file not found at ${defaultConfigPath}`);
      }
    }
  } catch (err) {
    // File exists but is invalid JSON
    if (createDefaultIfMissing) {
      console.error(`Error loading default config, recreating: ${err.message}`);
      defaultConfig = FALLBACK_DEFAULTS;
      fs.writeFileSync(
        defaultConfigPath,
        JSON.stringify(FALLBACK_DEFAULTS, null, 2),
        'utf8'
      );
      if (verbose) {
        console.log(`Recreated default config at: ${defaultConfigPath}`);
      }
    } else {
      throw err;
    }
  }
  
  // Load local config (optional)
  let localConfig = {};
  try {
    const loaded = loadJsonFile(localConfigPath);
    if (loaded) {
      localConfig = loaded;
      if (verbose) {
        console.log(`Loaded local config from: ${localConfigPath}`);
      }
    } else {
      if (verbose) {
        console.log(`Local config not found (optional), using defaults only`);
      }
    }
  } catch (err) {
    // Invalid JSON in local config - log but don't fail
    console.error(`Error loading local config, using defaults only: ${err.message}`);
  }
  
  // Deep merge: local overrides default
  const mergedConfig = deepMerge(defaultConfig, localConfig);
  
  if (verbose) {
    console.log('Configuration loaded:');
    console.log('  Default config:', JSON.stringify(defaultConfig, null, 2));
    if (Object.keys(localConfig).length > 0) {
      console.log('  Local overrides:', JSON.stringify(localConfig, null, 2));
    } else {
      console.log('  Local overrides: none (using defaults only)');
    }
    console.log('  Final merged config:', JSON.stringify(mergedConfig, null, 2));
  }
  
  return mergedConfig;
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadConfig, deepMerge, FALLBACK_DEFAULTS };
}

