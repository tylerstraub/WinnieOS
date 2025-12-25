const path = require('path');
const fs = require('fs');
const browserSync = require('browser-sync').create();

// Load configuration for port
const defaultConfig = require('./config/default.json');
let localConfig = {};
const localConfigPath = path.join(__dirname, 'config', 'local.json');
if (fs.existsSync(localConfigPath)) {
  try {
    localConfig = require(localConfigPath);
  } catch (err) {
    // Ignore local config errors in dev mode
  }
}

const config = {
  server: { ...defaultConfig.server, ...(localConfig.server || {}) }
};

// Public directory path
const publicPath = path.join(__dirname, 'public');
const devPort = config.server.port;

// Start BrowserSync as a static file server with hot reload
browserSync.init({
  server: {
    baseDir: publicPath,
    index: 'index.html'
  },
  port: devPort,
  open: false, // Don't auto-open browser (dev preference)
  notify: true, // Enable notification to confirm connection
  ui: false, // Disable BrowserSync UI
  files: [
    // Watch all files in public directory
    path.join(publicPath, '**/*')
  ],
  watchOptions: {
    ignored: [
      'node_modules',
      '.git'
    ]
  },
  injectChanges: true, // Inject CSS changes without full reload
  reloadDelay: 100,
  logLevel: 'info',
  logPrefix: 'BS',
  logConnections: true, // Enable to see connections
  reloadOnRestart: true,
  reloadDebounce: 300
}, (err, bs) => {
  if (err) {
    console.error('BrowserSync error:', err);
    process.exit(1);
  }
  console.log(`\n✅ Development server running on http://localhost:${bs.options.get('port')}`);
  console.log(`📁 Serving files from: ${publicPath}`);
  console.log(`👀 Watching for file changes...\n`);
});

// Graceful shutdown
function shutdown() {
  console.log('\nShutting down development server...');
  browserSync.exit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

