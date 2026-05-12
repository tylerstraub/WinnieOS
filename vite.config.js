import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

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

// Public config payload — the same shape Express's /winnieos-config.json
// route returns. Used by the dev middleware below and emitted to dist/ at
// build time so static hosts (e.g. GitHub Pages) can serve it as a file.
// On the Express kiosk this static file is shadowed by the dynamic route
// because server.js registers app.get('/winnieos-config.json', ...) before
// express.static(distPath), so config/local.json overrides still win there.
const publicConfig = { display: config.display, apps: config.apps };

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
          res.end(JSON.stringify(publicConfig));
        });
      },
      closeBundle() {
        writeFileSync(
          join(__dirname, 'dist', 'winnieos-config.json'),
          JSON.stringify(publicConfig, null, 2) + '\n'
        );
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
  base: process.env.VITE_BASE || '/',
};

