const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const winston = require('winston');
const { loadConfig } = require('./lib/config-loader');

// Load configuration
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

// Configure logger (same setup as server.js)
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

logger.info('=== WinnieOS Service Startup ===');

// Get project root directory
const projectRoot = __dirname;

/**
 * Execute git pull (fail gracefully)
 */
function performGitPull() {
  // Check if git pull is disabled in config
  if (config.startup && config.startup.gitPull === false) {
    logger.info('Git pull disabled in config. Skipping.');
    return;
  }
  
  logger.info('Performing git pull...');
  try {
    // Check if we're in a git repository
    try {
      execSync('git rev-parse --git-dir', { cwd: projectRoot, stdio: 'ignore' });
    } catch {
      logger.warn('Not a git repository. Skipping git pull.');
      return;
    }

    // Check if remote is configured
    try {
      execSync('git remote get-url origin', { cwd: projectRoot, stdio: 'ignore' });
    } catch {
      logger.warn('Git remote "origin" not configured. Skipping git pull.');
      return;
    }

    // Get current branch
    let branch;
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { 
        cwd: projectRoot, 
        encoding: 'utf8' 
      }).trim();
    } catch {
      logger.warn('Could not determine current branch. Skipping git pull.');
      return;
    }

    // Perform git pull
    execSync('git fetch --all', { cwd: projectRoot, stdio: 'inherit' });
    execSync(`git reset --hard origin/${branch}`, { cwd: projectRoot, stdio: 'inherit' });
    logger.info(`Repository updated (branch: ${branch})`);
  } catch (error) {
    logger.warn(`Git pull failed: ${error.message}. Continuing with existing code.`);
  }
}

/**
 * Check if package.json has changed (simple timestamp check)
 */
function shouldRunNpmInstall() {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageLockPath = path.join(projectRoot, 'package-lock.json');
  const nodeModulesPath = path.join(projectRoot, 'node_modules');

  if (!fs.existsSync(nodeModulesPath)) {
    return true; // node_modules missing
  }

  if (!fs.existsSync(packageJsonPath)) {
    return false; // package.json missing, can't install
  }

  // Check if package.json or package-lock.json is newer than node_modules
  const packageJsonTime = fs.statSync(packageJsonPath).mtime;
  const packageLockTime = fs.existsSync(packageLockPath) 
    ? fs.statSync(packageLockPath).mtime 
    : packageJsonTime;
  const nodeModulesTime = fs.statSync(nodeModulesPath).mtime;

  return packageJsonTime > nodeModulesTime || packageLockTime > nodeModulesTime;
}

/**
 * Run npm install (fail gracefully)
 */
function performNpmInstall() {
  if (shouldRunNpmInstall()) {
    logger.info('Running npm install...');
    try {
      execSync('npm install', { cwd: projectRoot, stdio: 'inherit' });
      logger.info('Dependencies installed/updated');
    } catch (error) {
      logger.error(`npm install failed: ${error.message}. Continuing (may fail later if deps missing).`);
    }
  } else {
    logger.info('Dependencies up to date (skipping npm install)');
  }
}

/**
 * Get current git commit hash
 */
function getCurrentCommitHash() {
  try {
    return execSync('git rev-parse HEAD', { 
      cwd: projectRoot, 
      encoding: 'utf8' 
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Get last built commit hash from file
 */
function getLastBuildHash() {
  const hashFile = path.join(logsDir, 'last-build-hash.txt');
  if (fs.existsSync(hashFile)) {
    try {
      return fs.readFileSync(hashFile, 'utf8').trim();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Save current commit hash after successful build
 */
function saveBuildHash(hash) {
  const hashFile = path.join(logsDir, 'last-build-hash.txt');
  try {
    fs.writeFileSync(hashFile, hash, 'utf8');
  } catch (error) {
    logger.warn(`Failed to save build hash: ${error.message}`);
  }
}

/**
 * Check if build is needed
 */
function isBuildNeeded() {
  const distPath = path.join(projectRoot, 'dist');
  const indexPath = path.join(distPath, 'index.html');

  // Check if dist directory or index.html is missing
  if (!fs.existsSync(distPath) || !fs.existsSync(indexPath)) {
    logger.info('Build needed: dist/ directory or index.html missing');
    return true;
  }

  // Check if buildOnMissing is enabled (default: true)
  if (config.startup && config.startup.buildOnMissing === false) {
    // If buildOnMissing is false and dist exists, don't build
    return false;
  }

  // Check if buildOnChanges is enabled (default: true)
  if (!config.startup || config.startup.buildOnChanges !== false) {
    const currentHash = getCurrentCommitHash();
    const lastHash = getLastBuildHash();

    if (!currentHash) {
      logger.warn('Could not determine git commit hash. Assuming build needed.');
      return true;
    }

    if (lastHash !== currentHash) {
      logger.info(`Build needed: commit hash changed (${lastHash || 'none'} -> ${currentHash})`);
      return true;
    }
  }

  return false;
}

/**
 * Perform build (fail gracefully)
 */
function performBuild() {
  logger.info('Building production bundle...');
  try {
    execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });
    
    // Save build hash on success
    const currentHash = getCurrentCommitHash();
    if (currentHash) {
      saveBuildHash(currentHash);
    }
    
    logger.info('Production bundle built successfully');
    return true;
  } catch (error) {
    logger.error(`Build failed: ${error.message}`);
    
    // Check if dist exists (might be stale but usable)
    const distPath = path.join(projectRoot, 'dist');
    const indexPath = path.join(distPath, 'index.html');
    
    if (fs.existsSync(distPath) && fs.existsSync(indexPath)) {
      logger.warn('Build failed but dist/ exists. Continuing with existing build (may be stale).');
      return true; // Can continue
    } else {
      logger.error('Build failed and dist/ is missing. Service cannot start.');
      return false; // Cannot continue
    }
  }
}

// Main startup sequence
logger.info('Starting service startup sequence...');

// Step 1: Git pull (do this first, as it may change code)
performGitPull();

// Step 2: npm install
performNpmInstall();

// Step 3: Check if build is needed (after git pull, as code may have changed)
const buildNeeded = isBuildNeeded();

// Step 4: Build if needed
if (buildNeeded) {
  const buildSuccess = performBuild();
  if (!buildSuccess) {
    logger.error('Service startup failed: build required but failed, and dist/ is missing.');
    process.exit(1);
  }
} else {
  logger.info('Build not needed (dist/ exists and commit hash unchanged)');
}

// Step 5: Verify dist exists before starting server
const distPath = path.join(projectRoot, 'dist');
const indexPath = path.join(distPath, 'index.html');

if (!fs.existsSync(distPath) || !fs.existsSync(indexPath)) {
  logger.error('ERROR: dist directory or index.html missing after startup sequence.');
  logger.error('Service cannot start without a valid build.');
  process.exit(1);
}

// Step 6: Start Express server
logger.info('Starting Express server...');
try {
  // Require server.js - it executes immediately on load, setting up Express
  // and starting the HTTP server. This is the intended behavior.
  require('./server.js');
  logger.info('Express server started successfully');
} catch (error) {
  logger.error(`Failed to start Express server: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
}

