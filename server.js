const express = require('express');
const path = require('path');
const fs = require('fs');
const winston = require('winston');

// Ensure config directory exists
const configDir = path.join(__dirname, 'config');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Fallback defaults (only used if config/default.json is missing or invalid)
// These should match config/default.json - if you update defaults, update both places
const fallbackDefaults = {
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

// Load default config (source of truth: config/default.json)
const defaultConfigPath = path.join(__dirname, 'config', 'default.json');
let defaultConfig;
try {
  if (fs.existsSync(defaultConfigPath)) {
    defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
  } else {
    // File doesn't exist, create it from fallback defaults
    console.log('Default config not found, creating from fallback defaults...');
    defaultConfig = fallbackDefaults;
    fs.writeFileSync(defaultConfigPath, JSON.stringify(fallbackDefaults, null, 2), 'utf8');
  }
} catch (err) {
  // File exists but is invalid JSON, recreate from fallback defaults
  console.error('Error loading default config, recreating from fallback defaults:', err.message);
  defaultConfig = fallbackDefaults;
  fs.writeFileSync(defaultConfigPath, JSON.stringify(fallbackDefaults, null, 2), 'utf8');
}

// Load local config (optional overrides)
let localConfig = {};
const localConfigPath = path.join(__dirname, 'config', 'local.json');
if (fs.existsSync(localConfigPath)) {
  try {
    localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
  } catch (err) {
    console.error('Error loading local config, using defaults:', err.message);
  }
}

const config = {
  server: { ...defaultConfig.server, ...(localConfig.server || {}) },
  logging: { ...defaultConfig.logging, ...(localConfig.logging || {}) },
  display: { ...defaultConfig.display, ...(localConfig.display || {}) },
  apps: { ...defaultConfig.apps, ...(localConfig.apps || {}) }
};

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

// Public runtime config for the frontend (safe subset only)
app.get('/winnieos-config.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(JSON.stringify({
    display: config.display,
    apps: config.apps
  }));
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
