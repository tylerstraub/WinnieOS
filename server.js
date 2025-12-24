const express = require('express');
const path = require('path');
const fs = require('fs');
const winston = require('winston');

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

// Serve static files from public directory
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Log all requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Start server
const server = app.listen(config.server.port, config.server.host, () => {
  logger.info(`WinnieOS Server started on http://${config.server.host}:${config.server.port}`);
  logger.info(`Serving files from: ${publicPath}`);
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
