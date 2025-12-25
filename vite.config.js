import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Load configuration using shared config loader
// Uses same loader as server.js for consistency
const { loadConfig } = require('./lib/config-loader');
const config = loadConfig(__dirname, {
  createDefaultIfMissing: true,
  verbose: false // Vite handles its own logging
});

export default {
  root: '.',
  publicDir: 'public',
  plugins: [
    {
      name: 'winnieos-config-endpoint',
      configureServer(server) {
        server.middlewares.use('/winnieos-config.json', (req, res) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ display: config.display, apps: config.apps }));
        });
      }
    }
  ],
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

