# Agent Context: WinnieOS

This document provides essential context for AI agents working on the WinnieOS project. For detailed information, refer to README.md.

## Project Overview

WinnieOS is a kid-friendly computing environment: a local web application that runs in Chromium kiosk mode on Windows 11, optimized for an 8" laptop (1280x800, 16:10). It's designed to introduce toddlers to basic computing concepts.

**Key Principle**: The entire application runs locally and offline after initial setup. Updates are pulled from GitHub on startup via git pull.

## Architecture Summary

- **Web Server**: Express.js serving static files from `public/` directory
- **Process Management**: Windows Service (node-windows) for persistent background operation
- **Configuration**: JSON-based config system with defaults + local overrides
- **Logging**: Winston file-based logging to `logs/winnieos.log`
- **Browser**: Chromium/Chrome launched in kiosk mode via PowerShell

## Critical File Locations

- `server.js` - Express web server (production, simple static file server)
- `server-dev.js` - Development server with hot reload (browser-sync)
- `public/` - Web application files (HTML, CSS, JS) - this is where the UI lives
- `config/default.json` - Default configuration (committed)
- `config/local.json` - Local overrides (gitignored, not synced)
- `scripts/` - PowerShell and Node.js scripts for setup/management
- `logs/winnieos.log` - Application logs (gitignored)

## Development vs Production

### Development Workflow (Developer's Machine)

- Run `npm run dev` for development server with hot reload (browser-sync)
- Or run `npm start` for production-like server (no hot reload)
- No Windows Service needed
- Access at `http://localhost:3000`
- Make changes, test, commit, push

### Production Workflow (Target Laptop)

- Windows Service runs persistently in background
- `scripts/start.ps1` runs on system startup (via Task Scheduler)
- Startup sequence: git pull (force) → npm install → ensure service running → launch browser
- Remote restart: `scripts/restart.ps1` (stops browser/service, then runs start.ps1)

## Important Design Decisions

1. **Force git pull**: Production always overwrites local changes with upstream (except gitignored files)
2. **Local config persists**: `config/local.json` is gitignored, survives updates
3. **Browser state persists**: localStorage/IndexedDB not affected by code updates
4. **No admin mode needed**: Kiosk mode can be exited with Alt+F4 (toddlers unlikely to discover)
5. **Simple server**: Express static file server only - no complex backend needed

## Configuration System

- Configuration merges: `local.json` overrides `default.json`
- Default port: 3000
- Configurable via `config/local.json`:
  - Server port/host
  - Logging level
  - Chromium executable path (auto-detected if not set)

## Key Scripts

- `scripts/setup.ps1` - Initial setup (checks prereqs, installs deps, creates config, optional service install)
- `scripts/start.ps1` - Production startup (git pull, npm install, start service, launch browser)
- `scripts/restart.ps1` - Remote restart (stop browser/service, delegate to start.ps1)
- `scripts/install-service.ps1` - Windows Service installer wrapper (requires admin)
- `scripts/install-service.js` - Node.js service installer (uses node-windows)

## Git Workflow

- **Default branch**: `main` (script auto-detects current branch)
- **Update mechanism**: `git fetch --all && git reset --hard origin/<branch>`
- **What survives updates**: 
  - `config/local.json` (gitignored)
  - `node_modules/` (reinstalled on startup)
  - Browser storage (localStorage/IndexedDB)

## Common Tasks for Agents

### Adding New Features

1. Edit files in `public/` directory
2. Test locally with `npm run dev` (hot reload) or `npm start` (production-like)
3. Verify changes work
4. Commit and push

### Changing Server Configuration

- Edit `config/default.json` for defaults (affects all installations)
- Document changes in README.md

### Adding npm Dependencies

1. `npm install <package>`
2. Test locally
3. Commit `package.json` and `package-lock.json`
4. Production will auto-install on next startup via `npm install` in start.ps1

### Debugging Production Issues

1. Check logs: `logs/winnieos.log`
2. Verify service status: `Get-Service "WinnieOS Server"`
3. Check git status: ensure remote is configured
4. Test server manually: `npm start` (production server) or `npm run dev` (dev server)

### Testing Scripts

- PowerShell scripts can be tested for syntax: `$null = [System.Management.Automation.PSParser]::Tokenize(...)`
- Node.js scripts: `node -c <script.js>`
- Service installation requires Administrator privileges (not testable on dev machine without admin)

## Things to Remember

1. **Keep server.js simple** - It's just a static file server, don't add complexity
2. **Public directory is the app** - All web app code goes in `public/`
3. **Config is merged** - Local overrides default, both are JSON
4. **Production uses force pull** - Local code changes are overwritten on startup
5. **Service runs as background process** - Don't expect console output, check logs instead
6. **Chromium path auto-detection** - Script tries common paths if not configured
7. **Git branch detection** - Scripts detect current branch, don't hardcode "main"

## Testing Approach

- **Development**: Use `npm run dev` for hot reload, or `npm start` for production-like server, browser at localhost:3000
- **Scripts**: Syntax validation, dry-run where possible
- **Service**: Requires admin, test on production laptop only
- **Git operations**: Handle gracefully when not in git repo or remote not configured

## When Starting Fresh Context

1. Read this file (AGENTS.md) for quick context
2. Check README.md for detailed information
3. Review recent git commits/logs for what's been worked on
4. Check `logs/winnieos.log` if debugging issues
5. Verify project structure matches expected layout

## Target Device Context

- 8" laptop, 1280x800 resolution (16:10 aspect ratio)
- Windows 11
- Touch + Keyboard input
- Chromium-based browser in kiosk mode
- Optimize UI for this specific resolution

