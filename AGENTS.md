# Agent Context: WinnieOS

This document provides essential context for AI agents working on the WinnieOS project. For detailed information, refer to README.md.

## Project Overview

WinnieOS is a kid-friendly computing environment: a local web application that runs in Chromium kiosk mode on Windows 11, optimized for an 8" laptop (1280x800, 16:10). It's designed to introduce toddlers to basic computing concepts and will eventually grow into a full "pretend OS" experience.

**Key Principle**: The entire application runs locally and offline after initial setup. Updates are pulled from GitHub on startup via git pull.

## Architecture Summary

- **Web Server**: Express.js serving static files from `public/` directory
- **Process Management**: Windows Service (node-windows) for persistent background operation
- **Configuration**: JSON-based config system with defaults + local overrides
- **Logging**: Winston file-based logging to `logs/winnieos.log`
- **Browser**: Chromium/Chrome launched in kiosk mode via PowerShell
- **Frontend**: Modular CSS and JavaScript architecture, scalable from simple welcome screen to full OS

## Critical File Locations

### Server & Infrastructure
- `server.js` - Express web server (production, simple static file server)
- `server-dev.js` - Development server with hot reload (browser-sync)
- `config/default.json` - Default configuration (committed)
- `config/local.json` - Local overrides (gitignored, not synced)
- `scripts/` - PowerShell and Node.js scripts for setup/management
- `logs/winnieos.log` - Application logs (gitignored)

### Frontend Architecture

**Entry Point:**
- `public/index.html` - Main HTML file, loads all CSS and JS modules

**CSS (Modular Stylesheets):**
- `public/css/tokens.css` - Design tokens (CSS custom properties)
- `public/css/base.css` - Reset, normalize, canvas styling, kiosk protections
- `public/css/layout.css` - Layout utilities (spacing, typography, display)
- `public/css/components.css` - Component styles and imports
- `public/css/components/` - Individual component CSS files (as features are added)

**JavaScript (Modular Modules):**
- `public/js/core/viewport.js` - Simple viewport scaling (fills directly at 1280x800, scales on other resolutions)
- `public/js/core/kiosk.js` - Kiosk mode protections
- `public/js/core/index.js` - Core initialization
- `public/js/components/index.js` - Component registry namespace
- `public/js/components/` - Individual component modules (as features are added)
- `public/js/utils/index.js` - Utility functions namespace
- `public/js/utils/` - Utility modules (as needed)

**Assets:**
- `public/assets/images/` - Image files
- `public/assets/fonts/` - Font files

## Frontend Foundation Principles

### Reference Resolution System

**Critical**: 1280x800 (16:10 aspect ratio) is the absolute reference point.

- Canvas (`#winnieos-canvas`) is ALWAYS 1280x800px (never changes)
- All UI elements use px units (designed for 1280x800)
- At exact reference resolution (1280x800): canvas fills viewport directly using `position: fixed` with `100%` width/height
- On other resolutions: canvas scales proportionally using CSS `transform: scale()` maintaining aspect ratio

**DO NOT:**
- Use viewport units (vw/vh) inside canvas
- Change canvas size based on viewport
- Manually calculate scaling in CSS

**DO:**
- Use px units for all sizing
- Use CSS custom properties (design tokens)
- Design everything at 1280x800
- Let JavaScript handle scaling automatically

### Design Tokens

All styling values are defined as CSS custom properties in `css/tokens.css`:
- Typography: `--font-size-xs` through `--font-size-6xl`
- Spacing: `--spacing-xs` through `--spacing-5xl`
- Colors: `--color-primary`, `--color-secondary`, `--color-text`
- Touch targets: `--touch-target-min`, `--touch-target-comfortable`

Always use design tokens, never hardcode values.

### JavaScript Namespace

All JavaScript organized under `WinnieOS` namespace:
```javascript
window.WinnieOS = {
    Viewport: { ... },      // Viewport scaling
    Kiosk: { ... },         // Kiosk protections
    Components: { ... },    // Component registry
    Utils: { ... }          // Utility functions
}
```

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
6. **Modular architecture**: CSS and JS split into modules for scalability
7. **Reference resolution**: Everything designed at 1280x800, scales automatically

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

**Adding a Component:**
1. Create CSS file: `public/css/components/my-component.css`
2. Import in `components.css`: `@import 'components/my-component.css';`
3. Create JS file: `public/js/components/MyComponent.js`
4. Register in `WinnieOS.Components` namespace
5. Add script tag to `index.html`

**Adding a Screen/Page:**
1. Create CSS file in `css/components/` for screen-specific styles
2. Create JS file in `js/components/` for screen logic
3. Add routing logic (future: routing system)

**Adding a Utility:**
1. Create utility file: `js/utils/my-utility.js`
2. Add to `WinnieOS.Utils` namespace
3. Import in `index.html`

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
8. **Reference resolution** - Everything designed at 1280x800px, scales automatically
9. **Design tokens** - Always use CSS custom properties, never hardcode values
10. **Modular structure** - One component = one CSS file + one JS file
11. **Namespace** - All JS under `WinnieOS` namespace
12. **px units only** - Use px units for sizing (no vw/vh inside canvas)

## CSS Architecture Guidelines

- **Design tokens first**: Always use CSS custom properties from `tokens.css`
- **Modular files**: One component = one CSS file in `css/components/`
- **Loading order**: tokens → base → layout → components
- **px units**: All sizing in px (designed for 1280x800)
- **No viewport units**: Don't use vw/vh inside canvas
- **Utility classes**: Use layout utilities for common patterns

## JavaScript Architecture Guidelines

- **Namespace**: All code under `WinnieOS` namespace
- **IIFE pattern**: Wrap modules in `(function() { 'use strict'; ... })()`
- **Modular files**: One feature = one file
- **Loading order**: core → utils → components
- **Documentation**: Document public APIs
- **No globals**: Don't pollute global scope outside namespace

## Testing Approach

- **Development**: Use `npm run dev` for hot reload, or `npm start` for production-like server, browser at localhost:3000
- **Scripts**: Syntax validation, dry-run where possible
- **Service**: Requires admin, test on production laptop only
- **Git operations**: Handle gracefully when not in git repo or remote not configured
- **Viewport scaling**: Test at 1280x800 (reference) and other resolutions
- **Design tokens**: Verify CSS custom properties are accessible

## When Starting Fresh Context

1. Check README.md for detailed information
2. Review recent git commits/logs for what's been worked on
3. Check `logs/winnieos.log` if debugging issues
4. Verify project structure matches expected layout:
   - `public/css/` - Modular CSS files
   - `public/js/core/` - Core systems
   - `public/js/components/` - Component modules
   - `public/js/utils/` - Utility functions

## Target Device Context

- 8" laptop, 1280x800 resolution (16:10 aspect ratio)
- Windows 11
- Touch + Keyboard input
- Chromium-based browser in kiosk mode
- Optimize UI for this specific resolution (reference point)
- Scales to other resolutions automatically

## Scalability Considerations

The architecture is designed to scale from a simple welcome screen to a full "pretend OS":

- **Modular CSS**: Easy to add component styles
- **Modular JS**: Easy to add components and utilities
- **Component system**: Foundation ready for component library
- **Design tokens**: Consistent styling across all features
- **Namespace structure**: Prevents conflicts as codebase grows

**Don't over-engineer**: Keep it simple until complexity is needed, then add structure incrementally.
