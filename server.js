const express = require('express');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const winston = require('winston');
const { loadConfig } = require('./lib/config-loader');

// Load configuration (default.json + local.json merged)
// Verbose logging only in development (set NODE_ENV=development for detailed logs)
const isDevelopment = process.env.NODE_ENV === 'development';
const config = loadConfig(__dirname, {
  createDefaultIfMissing: true,
  verbose: isDevelopment
});

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configure logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, config.logging.filename),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Create Express app
const app = express();

// Log all requests (must be before static/fallback routes)
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Serve static files from dist directory (Vite build output)
const distPath = path.join(__dirname, 'dist');

// Check if dist directory exists
if (!fs.existsSync(distPath)) {
  logger.error(`ERROR: dist directory does not exist at ${distPath}`);
  logger.error('Please run: npm run build');
  process.exit(1);
}

// Build version: git SHA captured once at startup. Used by /healthz so
// already-loaded clients can detect a new deploy and reload themselves
// (avoids needing the deploy script to kill Chromium on every update).
const VERSION = (() => {
  try {
    return execSync('git rev-parse HEAD', { cwd: __dirname, encoding: 'utf8' }).trim();
  } catch (_) {
    return 'unknown';
  }
})();

app.get('/healthz', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ version: VERSION });
});

// Public runtime config for the frontend (safe subset only)
app.get('/winnieos-config.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    display: config.display,
    apps: config.apps
  });
});

// Debug endpoint (safe for local/offline use) to diagnose "wrong dist" / "wrong config" issues in production.
// This helps confirm which config the running server loaded and which dist asset it is serving.
app.get('/winnieos-debug.json', (req, res) => {
  const remote = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '';
  const isLocal =
    remote === '127.0.0.1' ||
    remote === '::1' ||
    remote === '::ffff:127.0.0.1';
  if (!isLocal) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const assetsDir = path.join(distPath, 'assets');
  let assetFiles = [];
  let assetReadError = null;
  try {
    if (fs.existsSync(assetsDir)) {
      assetFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js') || f.endsWith('.css'));
    }
  } catch (err) {
    // The whole point of /winnieos-debug.json is diagnosing "wrong dist" issues, so
    // a failure to list dist/assets is exactly the kind of thing the caller needs to see.
    assetReadError = err && err.message ? err.message : String(err);
    logger.warn(`Failed to read dist/assets for /winnieos-debug.json: ${assetReadError}`);
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    server: {
      pid: process.pid,
      node: process.version,
      cwd: process.cwd(),
      dirname: __dirname,
      distPath
    },
    config: {
      server: config.server,
      display: config.display,
      apps: config.apps
    },
    dist: {
      assets: assetFiles,
      assetReadError
    }
  });
});

app.use(express.static(distPath));

// Fallback to index.html for SPA routing (if needed in future)
app.use((req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    logger.error(`ERROR: index.html does not exist at ${indexPath}`);
    res.status(500).send('Server error: dist directory is missing required files. Please run: npm run build');
    return;
  }
  res.sendFile(indexPath);
});

// Start server
// If host is localhost, bind to all interfaces (both IPv4 and IPv6) to ensure Chrome can connect
const listenHost = config.server.host === 'localhost' ? undefined : config.server.host;
const server = app.listen(config.server.port, listenHost, () => {
  logger.info(`WinnieOS Server started on http://${config.server.host}:${config.server.port}`);
  logger.info(`Serving files from: ${distPath}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
