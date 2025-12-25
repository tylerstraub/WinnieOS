# WinnieOS Development Reference Guide

## Overview

WinnieOS is a kid-friendly computing environment designed to introduce toddlers to basic computing concepts. It runs as a local web application optimized for an 8" laptop (1280x800, 16:10 ratio) running Windows 11, launched in Chromium kiosk mode.

### Key Characteristics

- **Fully Local**: All code runs locally, no internet required after initial setup
- **Offline-First**: Entire application works without network connectivity
- **Git-Synced Updates**: Updates are pulled from GitHub repository on startup
- **Kiosk Mode**: Full-screen Chromium browser with minimal UI distractions
- **Touch-Friendly**: Optimized for touch interactions while encouraging keyboard use
- **Development-Friendly**: Simple development workflow separate from production deployment
- **Scalable Architecture**: Modular structure ready to grow from simple welcome screen to full "pretend OS"

## Architecture

### Technology Stack

- **Runtime**: Node.js (v24.6.0+)
- **Web Server**: Express.js (static file server, serves Vite build output)
- **Build Tool**: Vite (development server with HMR, production builds)
- **Testing**: Vitest (unit testing framework)
- **Service Manager**: node-windows (Windows Service integration)
- **Logging**: Winston (file-based logging)
- **Browser**: Chromium/Chrome in kiosk mode
- **Frontend**: Vanilla JavaScript (ES modules), modular CSS (no frameworks)

### Project Structure

```
WinnieOS/
├── index.html             # Vite entry point (root)
├── src/                   # Source files (Vite convention)
│   ├── main.js           # Application entry point (imports CSS + JS)
│   ├── css/              # Modular stylesheets
│   │   ├── tokens.css    # Design tokens (CSS custom properties)
│   │   ├── base.css      # Reset, normalize, canvas, kiosk protections
│   │   ├── layout.css    # Layout utilities and helpers
│   │   ├── components.css # Component styles
│   │   └── components/   # Individual component CSS files (future)
│   └── js/               # Modular JavaScript (ES modules)
│       ├── core/         # Core systems (foundation)
│       │   ├── display.js # Reference resolution owner
│       │   ├── viewport.js # Viewport scaling system
│       │   ├── kiosk.js   # Kiosk mode protections
│       │   └── index.js   # Core initialization
│       ├── components/   # Component modules (future)
│       │   └── index.js   # Component registry
│       └── utils/        # Utility functions (future)
│           └── index.js   # Utility namespace
├── public/               # Static assets (copied to dist/ by Vite)
│   └── assets/           # Static assets
│       ├── images/       # Image files
│       └── fonts/        # Font files
├── dist/                 # Build output (committed, served by Express)
│   ├── index.html        # Built HTML
│   └── assets/           # Bundled CSS/JS and static assets
├── config/
│   ├── default.json      # Default configuration (committed)
│   ├── local.json.example # Template for local config (committed)
│   └── local.json        # Local overrides (gitignored)
├── scripts/
│   ├── install-service.js # Node.js script for Windows Service install/uninstall
│   ├── install-service.ps1 # PowerShell wrapper for service installation
│   ├── setup.ps1          # Initial setup script
│   ├── start.ps1          # Startup script (git pull, start service, launch browser)
│   ├── restart.ps1       # Remote restart script
│   ├── setup-task-scheduler.ps1 # Task Scheduler setup script
│   ├── launch-dev-kiosk.ps1 # Development kiosk launcher
│   └── debug-startup.ps1 # Debug script for startup issues
├── logs/                 # Application logs (gitignored)
│   └── winnieos.log
├── server.js             # Express web server (serves dist/)
├── vite.config.js        # Vite configuration
├── vitest.config.js      # Vitest test configuration
├── package.json          # Node.js dependencies and scripts
├── README.md             # This file
├── AGENTS.md             # Context for AI agents
└── .gitignore           # Git ignore rules
```

### Frontend Architecture

#### Design Foundation

**Reference Resolution: 1280x800 (16:10 aspect ratio)**
- All UI elements are designed and sized for this resolution
- Default reference resolution is 1280x800, but the reference may be changed via `WinnieOS.Display`
- The app is rendered by applying a single uniform transform scale (no responsive reflow)
- Canvas is centered with letterboxing/pillarboxing on non-16:10 viewports

**Viewport Scaling Convention (Canonical)**
- Canvas internal coordinate system is always **REF_WIDTH×REF_HEIGHT** (the active reference resolution)
- Scale is computed as: \( scale = \min(\frac{vw}{REF\_WIDTH}, \frac{vh}{REF\_HEIGHT}) \)
- The scaled canvas is centered by setting pixel `left/top` offsets
- When viewport matches the active reference size: **scale = 1** and offsets are **0**, so it “locks” perfectly without special-casing

**Debugging**
- Current scale is exposed as `#winnieos-canvas[data-scale]`
- The same value is also available as CSS variable `--viewport-scale` on `:root`

**Display Module (Reference Resolution Owner)**
- `WinnieOS.Display` owns the reference resolution and persists it in `localStorage`
- It writes the reference into CSS variables:
  - `--ref-width`, `--ref-height`, `--ref-aspect-ratio`
- It emits a `winnieos:displaychange` event so systems can react (Viewport listens to this)
- Future “change WinnieOS resolution” UI should call:
  - `WinnieOS.Display.setReferenceSize({ width, height })`
  - For temporary/dev testing without saving: `WinnieOS.Display.setReferenceSize({ width, height, persist: false })`
  - To return to defaults: `WinnieOS.Display.resetReferenceSize()`

**Design Tokens (CSS Custom Properties)**
- Typography scale: `--font-size-xs` through `--font-size-6xl`
- Spacing scale: `--spacing-xs` through `--spacing-5xl`
- Colors: `--color-primary`, `--color-secondary`, `--color-text`
- Touch targets: `--touch-target-min`, `--touch-target-comfortable`
- All values in px, designed for 1280x800 reference
- See `src/css/tokens.css` for complete list

**Unit System**
- Use px units for all sizing (designed at 1280x800)
- Never use viewport units (vw/vh) inside canvas
- Scaling handled automatically via CSS transform
- Design tokens ensure consistency

#### CSS Architecture

**File Organization:**
- `css/tokens.css` - Design tokens (CSS custom properties only)
- `css/base.css` - Reset, normalize, canvas styling, kiosk protections
- `css/layout.css` - Layout utilities (spacing, typography, display)
- `css/components.css` - Component styles and imports
- `css/components/` - Individual component CSS files (as features are added)

**Loading Order (in `src/main.js`):**
1. `tokens.css` - Design tokens must load first
2. `base.css` - Base styles depend on tokens
3. `layout.css` - Utilities depend on tokens
4. `components.css` - Components depend on tokens and base

**CSS Principles:**
- Always use design tokens (`var(--spacing-lg)`)
- Use px units only (designed for 1280x800)
- One component = one CSS file
- Use utility classes for common patterns

#### JavaScript Architecture

**Namespace Structure:**
All JavaScript organized under `WinnieOS` namespace:
```javascript
window.WinnieOS = {
    Viewport: { ... },      // Viewport scaling
    Kiosk: { ... },         // Kiosk protections
    Components: { ... },    // Component registry
    Utils: { ... }          // Utility functions
}
```

**Core Systems (`js/core/`):**
- `display.js` - Reference resolution owner (virtual computer resolution), persists and broadcasts changes
- `viewport.js` - Scales/centers the reference canvas into the real device viewport (letterbox/pillarbox)
- `kiosk.js` - Kiosk mode protections (blocks navigation, prevents interactions)
- `index.js` - Core initialization (runs on DOM ready)

**Components (`js/components/`):**
- `index.js` - Component registry namespace
- Future: Individual component modules (Button.js, Card.js, etc.)

**Utilities (`js/utils/`):**
- `index.js` - Utility namespace
- Future: Shared helper functions (DOM helpers, event helpers, etc.)

**Loading Order (in `src/main.js`):**
1. Core modules (`display.js`, `viewport.js`, `kiosk.js`) - ES module imports
2. Core initialization (`core/index.js`)
3. Utilities (`utils/index.js`)
4. Components (`components/index.js`)

**Module System:**
- All JavaScript uses ES modules (`import`/`export`)
- Modules are imported in `src/main.js` entry point
- `window.WinnieOS` namespace is preserved for compatibility

### Key Components

#### Web Server

- **`server.js`**: Production Express.js static file server
  - Serves files from `dist/` directory (Vite build output)
  - Configurable port (default: 3000)
  - File-based logging via Winston
  - Graceful shutdown handling
  - Used by Windows Service in production

- **Vite Dev Server**: Development server with hot module replacement (HMR)
  - Started via `npm run dev`
  - Automatic browser reloading on file changes
  - CSS changes inject instantly (no page reload)
  - Fast ES module loading and HMR
  - Watches `src/` directory for file changes
  - Serves from `src/` in development, builds to `dist/` for production

#### Configuration System

- **`config/default.json`**: Default settings (committed to repo)
- **`config/local.json`**: Local overrides (gitignored, not synced)
- Configuration is merged: local overrides default values
- Server port, host, logging level, and Chromium path can be configured

#### Windows Service

- Service name: "WinnieOS Server"
- Runs `server.js` as a Windows Service
- Auto-starts with Windows (if configured)
- Managed via `scripts/install-service.js`

#### PowerShell Scripts

- **`setup.ps1`**: Initial project setup (dependencies, config, optional service install)
- **`start.ps1`**: Startup sequence (git pull, npm install, start service, launch browser)
- **`restart.ps1`**: Remote restart (stop browser/service, then delegate to start.ps1)
- **`install-service.ps1`**: Service installation wrapper (requires admin)

## Development Workflow

### Prerequisites

**Required Software** (must be installed before running setup):

1. **Node.js** (v24.6.0 or later, LTS version recommended)
   - Download from: https://nodejs.org/
   - Install the LTS (Long Term Support) version
   - This also installs npm (Node Package Manager)
   - **Important**: Restart PowerShell/terminal after installation

2. **Git** (for version control and updates)
   - Download from: https://git-scm.com/
   - Or install via: `winget install Git.Git` (Windows 11)

3. **PowerShell** (comes with Windows)

4. **Chromium-based Browser** (Chrome, Edge, or Chromium)
   - Chrome: https://www.google.com/chrome/
   - Edge: Comes with Windows 11
   - Chromium: https://www.chromium.org/getting-involved/download-chromium

**Note**: The setup script will check for these prerequisites and provide guidance if any are missing.

### Initial Setup

**Step 1: Install Prerequisites**

Before cloning, ensure you have installed:
- Node.js (LTS version from https://nodejs.org/)
- Git (from https://git-scm.com/ or via `winget install Git.Git`)

**Step 2: Clone the Repository**

```powershell
git clone https://github.com/tylerstraub/WinnieOS.git
cd WinnieOS
```

**Step 3: Run Setup Script**

```powershell
.\scripts\setup.ps1
```

This will:
- ✅ Check prerequisites (Node.js, npm, Git)
- ✅ Install npm dependencies
- ✅ Create `config/local.json` from template
- ✅ Optionally install Windows Service (requires admin)

**Note**: If any prerequisites are missing, the setup script will provide clear instructions on what to install.

**Step 4: (Optional) Edit `config/local.json`** to customize:
- Server port (default: 3000)
- Logging level (default: info)
- Chromium path (if not using auto-detection)

### Development Mode

**On your development machine:**

1. Start the development server with hot reload:
   ```powershell
   npm run dev
   ```
   This starts Vite dev server with HMR (Hot Module Replacement) for instant updates.

2. Access the application:
   - Open browser to `http://localhost:3000`
   - Make changes to files in `src/`
   - Browser automatically reloads on file changes (CSS changes inject instantly)

3. Build for production:
   ```powershell
   npm run build
   ```
   This creates optimized production build in `dist/` directory.

4. Run production server (serves built files):
   ```powershell
   npm start
   ```
   or
   ```powershell
   node server.js
   ```

5. Run tests:
   ```powershell
   npm test
   ```
   or with UI:
   ```powershell
   npm run test:ui
   ```

6. View logs:
   ```powershell
   Get-Content logs\winnieos.log -Tail 50 -Wait
   ```

**No Windows Service needed for development** - just run the server directly.

### Making Changes

1. Edit files in `src/` directory (HTML, CSS, JavaScript)
2. Test locally with `npm run dev` (automatic hot reload with Vite)
3. Build and test production build:
   ```powershell
   npm run build
   npm start
   ```
4. Run tests:
   ```powershell
   npm test
   ```
5. Commit changes (including `dist/`):
   ```powershell
   git add .
   git commit -m "Description of changes"
   git push
   ```

### Testing on Production Laptop

The production laptop will automatically pull updates on startup via `start.ps1`.

## Adding New Features

### Adding a New Component

1. **Create CSS file**: `src/css/components/my-component.css`
   ```css
   .my-component {
       padding: var(--spacing-lg);
       font-size: var(--font-size-base);
   }
   ```

2. **Import in `src/css/components.css`**:
   ```css
   @import 'components/my-component.css';
   ```

3. **Create JS file**: `src/js/components/MyComponent.js`
   ```javascript
   export const MyComponent = {
       init: function() { ... }
   };

   // Attach to window namespace for compatibility
   if (typeof window !== 'undefined') {
       window.WinnieOS = window.WinnieOS || {};
       window.WinnieOS.Components = window.WinnieOS.Components || {};
       window.WinnieOS.Components.MyComponent = MyComponent;
   }
   ```

4. **Import in `src/main.js`** (if needed):
   ```javascript
   import './js/components/MyComponent.js';
   ```
   Note: Component registry (`components/index.js`) is already imported in `main.js`

### Adding a New Screen/Page

1. Create new HTML file or use JavaScript to render
2. Create CSS file in `css/components/` for screen-specific styles
3. Create JS file in `js/components/` for screen logic
4. Add routing logic (future: routing system)

### Adding a Utility Function

1. Create utility file: `src/js/utils/my-utility.js`
   ```javascript
   export const myUtility = {
       helper: function() { ... }
   };

   // Attach to window namespace for compatibility
   if (typeof window !== 'undefined') {
       window.WinnieOS = window.WinnieOS || {};
       window.WinnieOS.Utils = window.WinnieOS.Utils || {};
       window.WinnieOS.Utils.myUtility = myUtility;
   }
   ```

2. Import in `src/main.js` (if needed):
   ```javascript
   import './js/utils/my-utility.js';
   ```
   Note: Utility registry (`utils/index.js`) is already imported in `main.js`

## Production Deployment

### Initial Setup on Target Laptop

**Important: Install Prerequisites First**

Before proceeding, ensure Node.js and Git are installed (see Prerequisites section above).

**Step 1: Clone Repository**

```powershell
git clone https://github.com/tylerstraub/WinnieOS.git
cd WinnieOS
```

**Step 2: Run Setup**

Run setup as Administrator (right-click PowerShell, "Run as Administrator"):
```powershell
.\scripts\setup.ps1
```

This will:
- Check prerequisites
- Install npm dependencies
- Create local configuration
- Install Windows Service (if run as Administrator)

**Step 3: Configure Task Scheduler (Automatic Startup)**

Option A - Automated Setup (Recommended):
```powershell
# Run PowerShell as Administrator, then:
cd C:\Users\Winnie\WinnieOS
.\scripts\setup-task-scheduler.ps1
```

Option B - Manual Setup:
   - Open Task Scheduler
   - Create Basic Task
   - Name: "WinnieOS Startup"
   - Trigger: "When the computer starts"
   - Action: Start a program
   - Program: `powershell.exe`
   - Arguments: `-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "C:\Users\Winnie\WinnieOS\scripts\start.ps1"`
   - Start in: `C:\Users\Winnie\WinnieOS`
   - Check "Run with highest privileges"
   - Finish

### Startup Sequence

On system boot:

1. Task Scheduler runs `scripts\start.ps1`
2. Script performs git pull (force, overwrites local changes)
3. Script runs `npm install` to update dependencies
4. Script ensures Windows Service is running
5. Script waits for server to be ready (up to 30 seconds)
6. Script launches Chromium in kiosk mode pointing to `http://localhost:3000`

### Remote Restart

To remotely restart WinnieOS (via SSH):

```powershell
cd C:\path\to\WinnieOS
.\scripts\restart.ps1
```

This will:
1. Stop all Chromium/Chrome/Edge processes
2. Stop the Windows Service
3. Run `start.ps1` to pull updates and restart everything

### Updating the Application

1. Make changes in your development environment
2. Commit and push to GitHub
3. On target laptop, either:
   - Reboot the laptop (automatic update on startup)
   - SSH in and run `.\scripts\restart.ps1`

Updates are pulled from the `origin/main` branch (or current branch if different).

## Configuration

### Server Configuration

Edit `config/local.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "logging": {
    "level": "info"
  },
  "chromium": {
    "path": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  }
}
```

- **port**: Server port (default: 3000)
- **host**: Server hostname (default: localhost)
- **logging.level**: Log level (info, warn, error, debug)
- **chromium.path**: Path to Chromium/Chrome executable

If `chromium.path` is not specified, `start.ps1` will attempt to auto-detect common installation paths.

### Windows Service Management

Install service (requires Administrator):
```powershell
.\scripts\install-service.ps1 install
```

Uninstall service (requires Administrator):
```powershell
.\scripts\install-service.ps1 uninstall
```

Or use npm scripts:
```powershell
npm run install-service
npm run uninstall-service
```

## Scripts Reference

### PowerShell Scripts

#### `scripts/setup.ps1`

Initial setup script. Checks prerequisites, installs dependencies, creates local config, optionally installs service.

**Usage:**
```powershell
.\scripts\setup.ps1
.\scripts\setup.ps1 -SkipServiceInstall  # Skip service installation
```

#### `scripts/start.ps1`

Startup script for production. Pulls git updates, ensures service is running, launches browser.

**Usage:**
```powershell
.\scripts\start.ps1
.\scripts\start.ps1 -ChromiumPath "C:\Path\To\Chrome.exe"
.\scripts\start.ps1 -Url "http://localhost:3000"
```

#### `scripts/restart.ps1`

Remote restart script. Stops browser and service, then runs start.ps1.

**Usage:**
```powershell
.\scripts\restart.ps1
.\scripts\restart.ps1 -ChromiumPath "C:\Path\To\Chrome.exe"
```

#### `scripts/setup-task-scheduler.ps1`

Creates a Windows Task Scheduler task to run WinnieOS on system startup. Requires Administrator privileges.

**Usage:**
```powershell
.\scripts\setup-task-scheduler.ps1           # Create the task
.\scripts\setup-task-scheduler.ps1 -Remove   # Remove the task
```

#### `scripts/install-service.ps1`

Service installation wrapper. Requires Administrator privileges.

**Usage:**
```powershell
.\scripts\install-service.ps1 install
.\scripts\install-service.ps1 uninstall
```

### npm Scripts

- `npm start` - Start the production server (`server.js`, serves `dist/`)
- `npm run dev` - Start Vite development server with HMR
- `npm run build` - Build production bundle to `dist/`
- `npm run preview` - Preview production build locally
- `npm test` - Run Vitest test suite
- `npm run test:ui` - Run Vitest with UI
- `npm run install-service` - Install Windows Service
- `npm run uninstall-service` - Uninstall Windows Service

## Logging

Logs are written to `logs/winnieos.log` in JSON format. Logs include:
- Server startup/shutdown
- HTTP requests (method and path)
- Errors and warnings
- Timestamps for all entries

View logs:
```powershell
Get-Content logs\winnieos.log -Tail 50
Get-Content logs\winnieos.log -Tail 50 -Wait  # Follow logs
```

Log rotation: Winston automatically rotates logs when they reach 5MB, keeping 5 backup files.

## Troubleshooting

### Server won't start

- Check if port 3000 is already in use:
  ```powershell
  Get-NetTCPConnection -LocalPort 3000
  ```
- Check logs: `logs\winnieos.log`
- Verify Node.js is installed: `node --version`

### Service won't start

- Ensure service is installed: `Get-Service "WinnieOS Server"`
- Check service logs in Windows Event Viewer
- Verify `server.js` exists and is accessible
- Run service installation as Administrator

### Browser won't launch

- Verify Chromium path in `config/local.json`
- Check if path exists: `Test-Path "C:\Path\To\Chrome.exe"`
- Verify server is running before browser launches (check logs)

### Git pull fails on startup

- Ensure git remote is configured: `git remote -v`
- Check network connectivity (for initial clone)
- Verify branch name matches (script auto-detects current branch)

### Updates not applying

- Check git status: `git status`
- Verify remote is configured: `git remote get-url origin`
- Check current branch: `git branch`
- Manual pull: `git fetch --all && git reset --hard origin/main`

## Target Device Specifications

- **OS**: Windows 11
- **Display**: 8" laptop, 1280x800 resolution, 16:10 aspect ratio
- **Browser**: Chromium-based (Chrome, Edge, or Chromium)
- **Input**: Touch + Keyboard (touch-friendly UI, keyboard encouraged)

## Development Guidelines

### File Organization

- **Source files**: `src/` directory (CSS, JavaScript ES modules)
- **Static assets**: `public/assets/` directory (images, fonts - copied to dist/)
- **Build output**: `dist/` directory (committed, served by Express)
- **Server code**: `server.js` (keep it simple, serves `dist/`)
- **Configuration**: `config/` directory
- **Scripts**: `scripts/` directory
- **Logs**: `logs/` directory (gitignored)

### Configuration Management

- **Default settings**: `config/default.json` (committed)
- **Local overrides**: `config/local.json` (gitignored)
- Never commit `config/local.json`
- Always provide defaults in `config/default.json`

### Git Workflow

- Force pull on production (overwrites local changes)
- Local config (`config/local.json`) is preserved (gitignored)
- Application state (localStorage/IndexedDB) is preserved (browser storage)

### Code Style

- Use ES modules (`import`/`export`) for JavaScript
- Keep code simple and readable
- Comment complex logic
- Follow existing patterns
- Use design tokens for styling
- One component = one CSS file + one JS file
- Preserve `window.WinnieOS` namespace for compatibility

### Design Principles

- **Reference Resolution**: Everything designed at 1280x800px
- **Design Tokens**: Always use CSS custom properties
- **px Units**: Use px units only (no vw/vh inside canvas)
- **Modular**: One component = one CSS file + one JS file
- **Namespace**: All JS under `WinnieOS` namespace

## Future Considerations

- Service Worker for offline caching (if needed)
- Auto-update mechanism improvements
- Parent/admin mode (currently relies on Alt+F4 in kiosk mode)
- Application state persistence strategy
- Routing system for multi-screen navigation
- Component library expansion
- Theme system for multiple color themes

## License

ISC
