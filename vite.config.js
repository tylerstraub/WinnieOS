import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load configuration for port
let config = { server: { port: 3000, host: 'localhost' } };
try {
  const defaultConfig = JSON.parse(readFileSync(resolve(__dirname, 'config/default.json'), 'utf-8'));
  let localConfig = {};
  try {
    const localConfigPath = resolve(__dirname, 'config/local.json');
    localConfig = JSON.parse(readFileSync(localConfigPath, 'utf-8'));
  } catch {
    // Local config doesn't exist, use defaults
  }
  config = {
    server: { ...defaultConfig.server, ...(localConfig.server || {}) }
  };
} catch {
  // Use defaults if config files don't exist
}

export default {
  root: '.',
  publicDir: 'public',
  server: {
    port: config.server.port,
    host: config.server.host === 'localhost' ? true : config.server.host,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
  },
  base: '/',
};

