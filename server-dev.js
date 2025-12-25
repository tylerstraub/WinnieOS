const express = require('express');
const path = require('path');
const fs = require('fs');
const winston = require('winston');
const browserSync = require('browser-sync').create();

// Load configuration
const defaultConfig = require('./config/default.json');
let localConfig = {};
const localConfigPath = path.join(__dirname, 'config', 'local.json');
if (fs.existsSync(localConfigPath)) {
  try {
    localConfig = require(localConfigPath);
  } catch (err) {
    console.error('Error loading local config, using defaults:', err.message);
  }
}

const config = {
  server: { ...defaultConfig.server, ...(localConfig.server || {}) },
  logging: { ...defaultConfig.logging, ...(localConfig.logging || {}) }
};

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configure logger (simpler format for dev)
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Create Express app
const app = express();

// Serve static files from public directory
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Log all requests (simpler for dev)
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Start Express server
const expressPort = config.server.port;
const server = app.listen(expressPort, config.server.host, () => {
  logger.info(`Express server running on http://${config.server.host}:${expressPort}`);
  
  // Start BrowserSync proxy after Express is ready
  browserSync.init({
    proxy: `http://${config.server.host}:${expressPort}`,
    port: expressPort + 1, // BrowserSync runs on next port (3001)
    open: false, // Don't auto-open browser (dev preference)
    notify: false, // Disable the "Connected to BrowserSync" notification
    ui: false, // Disable BrowserSync UI
    files: [
      // Watch all files in public directory
      path.join(publicPath, '**/*.html'),
      path.join(publicPath, '**/*.css'),
      path.join(publicPath, '**/*.js'),
      path.join(publicPath, '**/*.json'),
      // Watch images and other assets (but reload on change, not inject)
      path.join(publicPath, '**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,eot}')
    ],
    watchOptions: {
      ignored: 'node_modules'
    },
    logLevel: 'silent', // Reduce BrowserSync noise in console
    reloadOnRestart: true
  }, (err, bs) => {
    if (err) {
      logger.error('BrowserSync error:', err);
      return;
    }
    logger.info(`BrowserSync proxy running on http://localhost:${bs.options.get('port')}`);
    logger.info(`Open http://localhost:${bs.options.get('port')} in your browser`);
    logger.info('Watching for file changes in public/ directory...');
  });
});

// Graceful shutdown
function shutdown() {
  logger.info('Shutting down...');
  browserSync.exit();
  server.close(() => {
    logger.info('Development server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

