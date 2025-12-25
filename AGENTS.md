# Agent Context: WinnieOS

This document provides essential context for AI agents working on the WinnieOS project. For detailed information, refer to README.md.

## Project Overview

WinnieOS is a kid-friendly computing environment: a local web application that runs in Chromium kiosk mode on Windows 11, optimized for an 8" laptop (1280x800, 16:10). It's designed to introduce toddlers to basic computing concepts and will eventually grow into a full "pretend OS" experience.

**Key Principle**: The entire application runs locally and offline after initial setup. Updates are pulled from GitHub on startup via git pull.

## Architecture Summary

- **Web Server**: Express.js serving static files from `dist/` directory (Vite build output)
- **Build Tool**: Vite (development server with HMR, production builds)
- **Testing**: Vitest (unit testing framework)
- **Process Management**: Windows Service (node-windows) for persistent background operation
- **Configuration**: JSON-based config system with defaults + local overrides
- **Logging**: Winston file-based logging to `logs/winnieos.log`
- **Browser**: Chromium/Chrome launched in kiosk mode via PowerShell
- **Frontend**: Modular CSS and JavaScript (ES modules) architecture, scalable from simple welcome screen to full OS

## Critical File Locations

### Server & Infrastructure
- `server.js` - Express web server (production, serves `dist/`)
- `vite.config.js` - Vite configuration (dev server, build settings)
- `vitest.config.js` - Vitest test configuration
- `config/default.json` - Default configuration (committed)
- `config/local.json` - Local overrides (gitignored, not synced)
- `scripts/` - PowerShell and Node.js scripts for setup/management
- `logs/winnieos.log` - Application logs (gitignored)

### Frontend Architecture

**Entry Point:**
- `index.html` - Vite entry point (root), references `src/main.js`
- `src/main.js` - Application entry point, imports all CSS and JS modules

**CSS (Modular Stylesheets):**
- `src/css/tokens.css` - Design tokens (CSS custom properties)
- `src/css/base.css` - Reset, normalize, canvas styling, kiosk protections
- `src/css/layout.css` - Layout utilities (spacing, typography, display)
- `src/css/components.css` - Component styles and imports
- `src/css/components/` - Individual component CSS files (as features are added)

**JavaScript (ES Modules):**
- `src/js/core/display.js` - Reference resolution owner
- `src/js/core/viewport.js` - Viewport scaling (fills directly at 1280x800, scales on other resolutions)
- `src/js/core/kiosk.js` - Kiosk mode protections
- `src/js/core/index.js` - Core initialization
- `src/js/components/index.js` - Component registry namespace
- `src/js/components/` - Individual component modules (as features are added)
- `src/js/utils/index.js` - Utility functions namespace
- `src/js/utils/` - Utility modules (as needed)

**Build Output:**
- `dist/` - Production build output (committed, served by Express)
- `dist/index.html` - Built HTML with bundled assets
- `dist/assets/` - Bundled CSS/JS and static assets

**Static Assets:**
- `public/assets/images/` - Image files (copied to dist/ by Vite)
- `public/assets/fonts/` - Font files (copied to dist/ by Vite)

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

All styling values are defined as CSS custom properties in `src/css/tokens.css`:
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

- Run `npm run dev` for Vite development server with HMR (Hot Module Replacement)
- Run `npm run build` to build production bundle to `dist/`
- Run `npm start` for production server (serves `dist/`, no hot reload)
- Run `npm test` to run Vitest test suite
- No Windows Service needed
- Access at `http://localhost:3000`
- Make changes in `src/`, test, build, commit (including `dist/`), push

### Production Workflow (Target Laptop)

- Windows Service runs persistently in background
- `scripts/start.ps1` runs on system startup (via Task Scheduler)
- Startup sequence: git pull (force) → npm install → ensure service running → launch browser
- Service serves pre-built `dist/` directory (no build step needed in production)
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
1. Create CSS file: `src/css/components/my-component.css`
2. Import in `src/css/components.css`: `@import 'components/my-component.css';`
3. Create JS file: `src/js/components/MyComponent.js` (ES module with `export`)
4. Register in `WinnieOS.Components` namespace (attach to `window.WinnieOS`)
5. Import in `src/main.js` if needed (component registry is already imported)

**Adding a Screen/Page:**
1. Create CSS file in `src/css/components/` for screen-specific styles
2. Create JS file in `src/js/components/` for screen logic (ES module)
3. Add routing logic (future: routing system)

**Adding a Utility:**
1. Create utility file: `src/js/utils/my-utility.js` (ES module with `export`)
2. Add to `WinnieOS.Utils` namespace (attach to `window.WinnieOS`)
3. Import in `src/main.js` if needed (utility registry is already imported)

### Changing Server Configuration

- Edit `config/default.json` for defaults (affects all installations)
- Document changes in README.md

### Adding npm Dependencies

1. `npm install <package>`
2. Test locally (`npm run dev`, `npm test`)
3. Build and test production (`npm run build`, `npm start`)
4. Commit `package.json`, `package-lock.json`, and `dist/` (if build changed)
5. Production will auto-install on next startup via `npm install` in start.ps1

### Debugging Production Issues

1. Check logs: `logs/winnieos.log`
2. Verify service status: `Get-Service "WinnieOS Server"`
3. Check git status: ensure remote is configured
4. Ensure `dist/` exists and is up to date (should be committed)
5. Test server manually: `npm start` (production server, serves `dist/`) or `npm run dev` (Vite dev server)
6. Rebuild if needed: `npm run build` to regenerate `dist/`

### Testing Scripts

- PowerShell scripts can be tested for syntax: `$null = [System.Management.Automation.PSParser]::Tokenize(...)`
- Node.js scripts: `node -c <script.js>`
- Service installation requires Administrator privileges (not testable on dev machine without admin)

## Things to Remember

1. **Keep server.js simple** - It's just a static file server serving `dist/`, don't add complexity
2. **Source files in src/** - All web app source code goes in `src/` (CSS, JS ES modules)
3. **Build output in dist/** - Production build goes to `dist/` (committed to git)
4. **Static assets in public/** - Images/fonts go in `public/assets/` (copied to dist/ by Vite)
5. **ES modules** - All JavaScript uses `import`/`export`, not IIFE
6. **Preserve namespace** - Attach to `window.WinnieOS` for compatibility
7. **Config is merged** - Local overrides default, both are JSON
8. **Production uses force pull** - Local code changes are overwritten on startup
9. **Service runs as background process** - Don't expect console output, check logs instead
10. **Chromium path auto-detection** - Script tries common paths if not configured
11. **Git branch detection** - Scripts detect current branch, don't hardcode "main"
12. **Reference resolution** - Everything designed at 1280x800px, scales automatically
13. **Design tokens** - Always use CSS custom properties, never hardcode values
14. **Modular structure** - One component = one CSS file + one JS file
15. **px units only** - Use px units for sizing (no vw/vh inside canvas)

## CSS Architecture Guidelines

- **Design tokens first**: Always use CSS custom properties from `src/css/tokens.css`
- **Modular files**: One component = one CSS file in `src/css/components/`
- **Loading order**: Imported in `src/main.js` as tokens → base → layout → components
- **px units**: All sizing in px (designed for 1280x800)
- **No viewport units**: Don't use vw/vh inside canvas
- **Utility classes**: Use layout utilities for common patterns

## JavaScript Architecture Guidelines

- **ES modules**: Use `import`/`export` syntax
- **Namespace**: All code under `WinnieOS` namespace (attach to `window.WinnieOS`)
- **Modular files**: One feature = one file
- **Loading order**: Imported in `src/main.js` as core → utils → components
- **Documentation**: Document public APIs
- **No globals**: Don't pollute global scope outside namespace

## Testing Approach

- **Development**: Use `npm run dev` for Vite HMR, or `npm start` for production server (serves `dist/`), browser at localhost:3000
- **Unit tests**: Use `npm test` (Vitest) for JavaScript module tests
- **Build**: Always test production build with `npm run build` before committing
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
   - `src/css/` - Modular CSS files
   - `src/js/core/` - Core systems (ES modules)
   - `src/js/components/` - Component modules (ES modules)
   - `src/js/utils/` - Utility functions (ES modules)
   - `dist/` - Production build output (committed)
   - `public/assets/` - Static assets (images, fonts)

## Target Device Context

- 8" laptop, 1280x800 resolution (16:10 aspect ratio)
- Windows 11
- Touch + Keyboard input
- Chromium-based browser in kiosk mode
- Optimize UI for this specific resolution (reference point)
- Scales to other resolutions automatically

## Scalability Considerations

The architecture is designed to scale from a simple welcome screen to a full "pretend OS":

- **Vite build system**: Fast development, optimized production builds
- **ES modules**: Modern JavaScript module system, tree-shaking support
- **Modular CSS**: Easy to add component styles
- **Modular JS**: Easy to add components and utilities
- **Component system**: Foundation ready for component library
- **Design tokens**: Consistent styling across all features
- **Namespace structure**: Prevents conflicts as codebase grows
- **Testing**: Vitest foundation for unit tests

**Don't over-engineer**: Keep it simple until complexity is needed, then add structure incrementally.
