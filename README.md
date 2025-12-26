# WinnieOS Development Reference Guide

## Overview

WinnieOS is a kid-friendly computing environment designed to introduce toddlers to basic computing concepts. It runs as a local web application optimized for an 8" laptop (1280x800, 16:10 ratio) running Windows 11, launched in Chromium kiosk mode.

**Extending WinnieOS (adding apps):** start with `DAD.md`.

### Key Characteristics

- **Fully Local**: All code runs locally, no internet required after initial setup
- **Offline-First**: Entire application works without network connectivity
- **Git-Synced Updates**: Updates are pulled from GitHub repository on startup
- **Kiosk Mode**: Full-screen Chromium browser with minimal UI distractions
- **Touch-Friendly**: Optimized for touch interactions while encouraging keyboard use
- **Development-Friendly**: Simple development workflow separate from production deployment
- **Scalable Architecture**: Modular structure ready to grow from a simple startup/desktop into a full "pretend OS"

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
- **Physics**: Matter.js (2D physics engine for games)

### Project Structure

```
WinnieOS/
├── index.html             # Vite entry point (root)
├── DAD.md                 # "Dad guide" for extending WinnieOS (apps, patterns)
├── src/                   # Source files (Vite convention)
│   ├── main.js           # Application entry point (imports CSS + JS)
│   ├── css/              # Modular stylesheets
│   │   ├── tokens.css    # Design tokens (CSS custom properties)
│   │   ├── base.css      # Reset, normalize, canvas, kiosk protections
│   │   ├── layout.css    # Layout utilities and helpers
│   │   ├── components.css # Component styles
│   │   └── components/   # Individual component CSS files (shell/desktop/apps/etc)
│   └── js/               # Modular JavaScript (ES modules)
│       ├── core/         # Core systems (foundation)
│       │   ├── display.js # Reference resolution owner
│       │   ├── viewport.js # Viewport scaling system
│       │   ├── kiosk.js   # Kiosk mode protections
│       │   └── index.js   # Core initialization
│       ├── shell/        # Always-mounted shell (Home button + content host)
│       ├── nav/          # Navigation state machine (startup/desktop/app)
│       ├── screens/      # Startup/Desktop/AppHost screens
│       ├── apps/         # Apps plug-ins: src/js/apps/<appId>/app.js
│       ├── games/        # Game modules: src/js/games/<gameId>/game.js
│       ├── components/   # Reusable UI components
│       └── utils/        # Utility functions (Storage, Background, Audio)
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
├── lib/                  # Shared library modules
│   ├── config-loader.js  # Configuration loader (used by server.js and vite.config.js)
│   └── __tests__/        # Library tests
├── scripts/
│   ├── install-service.js # Node.js script for Windows Service install/uninstall
│   ├── install-service.ps1 # PowerShell wrapper for service installation
│   ├── setup.ps1          # Initial setup script
│   ├── restart-service.ps1 # Service restart script
│   ├── launch-dev-kiosk.ps1 # Development kiosk launcher
│   ├── stop-dev.ps1 # Stop development server and browser
│   └── debug-startup.ps1 # Debug script for startup issues
├── logs/                 # Application logs (gitignored)
│   └── winnieos.log
├── server.js             # Express web server (serves dist/)
├── vite.config.js        # Vite configuration (uses shared config loader)
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
- Scale: `#winnieos-canvas[data-scale]` or CSS `--viewport-scale`
- Metrics: `WinnieOS.Viewport.getMetrics()` (reference, viewport, scale, offsets)

**Display Module (Reference Resolution Owner)**
- `WinnieOS.Display` owns the reference resolution and persists it via `WinnieOS.Utils.Storage`
- It writes the reference into CSS variables:
  - `--ref-width`, `--ref-height`, `--ref-aspect-ratio`
- It emits a `winnieos:displaychange` event so systems can react (Viewport listens to this)
- To change reference resolution programmatically:
  - `WinnieOS.Display.setReferenceSize({ width, height })` - saves to storage
  - `WinnieOS.Display.setReferenceSize({ width, height, persist: false })` - temporary/dev testing
  - `WinnieOS.Display.resetReferenceSize()` - return to defaults

## Baseline Invariants (Keep Us Scalable)

These are the “guardrails” that keep WinnieOS easy to reason about as it grows from a simple startup/desktop into a full pretend OS.

- **Single coordinate system**: All UI is designed in exactly one reference resolution at a time (default 1280×800).
- **Canvas size never follows the device**: `#winnieos-canvas` always uses the active reference width/height in px.
- **One scaling rule**: The only “responsiveness” is the uniform transform scale from `WinnieOS.Viewport` (letterbox/pillarbox as needed).
- **No `vw/vh` inside the canvas**: Inside `#winnieos-canvas`, use px + tokens (`var(--spacing-lg)`, etc.).
- **Reference resolution changes are centralized**: Only `WinnieOS.Display` owns/persists the reference size and broadcasts `winnieos:displaychange`.
- **Core systems are idempotent**: Calling `init()` multiple times should be safe (important during Vite HMR and for tests).

### Quick sanity checks (when you add new UI)

- Resize the browser window in dev: the canvas should stay centered and scaled, with no layout “reflow” logic.
- Temporarily test another reference resolution:
  - `WinnieOS.Display.setReferenceSize({ width: 1024, height: 768, persist: false })`
  - Confirm `#winnieos-canvas[data-scale]` updates and everything still fits.

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
    Display: { ... },      // Reference resolution owner
    Viewport: { ... },      // Viewport scaling
    Kiosk: { ... },         // Kiosk protections
    Config: { ... },         // Runtime config loader
    Navigation: { ... },    // Navigation state (startup/desktop/app)
    Shell: { ... },         // Always-mounted UI shell (Home + screen host)
    Screens: { ... },       // Screen registry (Startup/Desktop/AppHost)
    Apps: { ... },          // App registry (auto-discovered, filtered by config)
    Components: { ... },    // Reusable UI components
    Utils: {                // Utility functions
        Storage: { ... },    // LocalStorage wrapper for persistence
        Background: { ... }, // Background color management
        Audio: { ... }       // Web Audio API sound system (UI feedback, navigation, games)
    }
}
```

**Core Systems (`js/core/`):**
- `display.js` - Reference resolution owner (virtual computer resolution), persists via Storage utility and broadcasts changes
- `viewport.js` - Scales/centers the reference canvas into the real device viewport (letterbox/pillarbox)
- `kiosk.js` - Kiosk mode protections (blocks navigation, prevents interactions)
- `config.js` - Runtime config loader (fetches `/winnieos-config.json` for frontend)
- `index.js` - Core initialization (runs on DOM ready)

**UI Foundation (startup → desktop → apps):**
- `js/nav/navigation.js` - Navigation state machine (`startup | desktop | app`)
- `js/shell/` - Always-mounted shell (Home button + content host)
- `js/screens/` - Screen implementations (Startup/Desktop/AppHost)
- `js/apps/` - Apps plug-ins, auto-discovered by Vite (`apps/<appId>/app.js`)

**Utilities (`js/utils/`):**
- `index.js` - Utility namespace
- `storage.js` - General-purpose localStorage wrapper (`WinnieOS.Utils.Storage`)
- `background.js` - Background color management (`WinnieOS.Utils.Background`)
- `audio.js` - Web Audio API sound system (`WinnieOS.Utils.Audio`) - UI feedback, navigation cues, game sounds

**Games (`js/games/`):**
- Game modules follow a `createGame({ root, config }) -> { start(), dispose() }` pattern
- Games are full-screen, always start fresh when re-entered
- Example: `letters` - 2D physics pachinko-style letter matching game (uses Matter.js and Audio utility)

**Loading Order (in `src/main.js`):**
1. Core modules (`display.js`, `viewport.js`, `kiosk.js`)
2. Core initialization (`core/index.js`)
3. Utilities (`utils/index.js`) - Storage, Background, Audio
4. Components (`components/index.js`)
5. UI foundation (`apps/`, `nav/`, `screens/`, `shell/`)

**Module System:**
- All JavaScript uses ES modules (`import`/`export`)
- Modules are imported in `src/main.js` entry point
- `window.WinnieOS` namespace is preserved for compatibility

### Key Components

#### Web Server

- **`server.js`**: Express static file server (serves `dist/`, uses shared config loader)
- **Vite Dev Server**: `npm run dev` - HMR, watches `src/`, serves from source

#### Configuration System

- **`config/default.json`**: Default settings (committed to repo, source of truth)
- **`config/local.json`**: Local overrides (gitignored, not synced, optional)
- **`lib/config-loader.js`**: Shared loader (used by `server.js` and `vite.config.js`)
- Deep merging: `local.json` overrides `default.json` (nested objects merged)
- Configurable: server port/host, logging level, Chromium path, display reference, apps enabled
- Runtime config: `/winnieos-config.json` (frontend-safe subset)

#### Windows Service

- Service name: "WinnieOS Server" (runs `service-startup.js`, managed via `scripts/install-service.js`)
- Service automatically starts on system boot (SYSTEM account)
- Service handles: git pull, npm install, conditional build, server startup
- No Task Scheduler needed - service manages everything

#### PowerShell Scripts

- **`setup.ps1`**: Initial setup (deps, config, optional service install)
- **`install-service.ps1`**: Service installer wrapper (requires admin)
- **`restart-service.ps1`**: Service restart script (simple restart, no updates)
- **`debug-startup.ps1`**: Debug script for service startup issues

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
5. Commit changes (including `dist/` if build changed):
   ```powershell
   git add .
   git commit -m "Description of changes"
   git push
   ```
   
   **Note**: Always commit the `dist/` directory with your changes. Production expects it to exist, though `start.ps1` rebuilds it on every startup by default (use `-SkipBuild` to skip rebuilding).

### Testing on Production Laptop

The production laptop will automatically pull updates on startup via the Windows Service (runs on system boot).

## Adding New Features

### Adding a New App (recommended extension path)

See `DAD.md` for the full guide. Short version:

1. Create: `src/js/apps/<appId>/app.js`
2. Export a default app definition with `id`, `title`, and `mount({ root, nav })`
3. (Optional) Add `iconEmoji` (e.g., `iconEmoji: '📝'`) or `iconSrc` (path to image in `public/assets/images/apps/...`)
4. (Optional) Add app ID to `config/default.json` → `apps.enabled` array (if omitted, app is auto-enabled)
5. Build and commit `dist/` for production updates

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

Screens are mounted inside the Shell (`src/js/shell/`) and switched by `WinnieOS.Navigation`.

1. Create a screen module in `src/js/screens/`
2. Register it in `src/js/screens/index.js`
3. If you add a new navigation state (rare), update `src/js/nav/navigation.js` and Shell mounting logic

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

### Using Utilities

#### Storage Utility

WinnieOS provides a general-purpose storage utility for persisting data locally:

**Import:**
```javascript
import { Storage } from '../utils/storage.js';
// Or access via namespace: window.WinnieOS.Utils.Storage
```

**Usage:**
```javascript
// Store data (automatically JSON stringified)
Storage.set('my.key', { data: 'value' });

// Retrieve data (with optional default value)
const value = Storage.get('my.key'); // Returns stored value or null

// Check if key exists
if (Storage.has('my.key')) { /* ... */ }

// Remove a key
Storage.remove('my.key');

// Get all WinnieOS storage keys (without prefix)
const keys = Storage.keys();

// Clear all WinnieOS storage
Storage.clear();
```

**Features:**
- Automatic key prefixing (`winnieos.` prefix)
- JSON serialization
- Graceful error handling
- Namespaced keys

#### Background Utility

Manages global background color preferences:

**Import:**
```javascript
import { Background } from '../utils/background.js';
// Or access via namespace: window.WinnieOS.Utils.Background
```

**Usage:**
```javascript
// Apply a color (with auto-generated gradient)
Background.apply('#667eea');

// Save preference
Background.save('#667eea');

// Get saved color
const saved = Background.getSaved(); // Returns hex string or null

// Load and apply saved color (called automatically on startup)
Background.load();
```

**Features:**
- Applies color to body and canvas with natural gradient
- Persists preferences via Storage utility
- Auto-loads on application startup

#### Audio Utility

Synthetic sound generation using Web Audio API. Used throughout WinnieOS for UI feedback, navigation cues, and game sounds.

**Import:**
```javascript
import { Audio } from '../utils/audio.js';
// Or access via namespace: window.WinnieOS.Utils.Audio
```

**Basic Usage:**
```javascript
// Prepare audio graph (call early, e.g., in mount)
Audio.ensure();

// Unlock audio context (call on first user gesture)
Audio.unlock();

// Play sound cues
Audio.launch(0.8);           // App launch / letter launch
Audio.tick();                // Subtle tap/click
Audio.pop(0.6);              // Emoji insert / reveal
Audio.plink(0.4);            // Color swatch selection
Audio.type(0.3, 'alpha');    // Typing sound (strength, flavor)
Audio.poof(0.7);             // Clear/close action
Audio.buzz(0.5);             // Error/placeholder state

// Continuous drag tone (Colors app)
Audio.colorDragStart();
Audio.colorDragUpdate({ hue: 180, t: 0.5, speed: 0.3 });
Audio.colorDragStop();

// Master volume control (preserves dynamics)
Audio.setMasterLevel(0.8);   // 0..1 range
```

**Features:**
- Master mix bus with global level control
- Unlock-on-first-gesture pattern (browser autoplay policy)
- Rate limiting to prevent overstimulation
- Safe peak limiting (transparent brickwall)
- Physics-reactive sounds for games (velocity-driven)

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

**Step 3: Service is Ready**

The Windows Service is now installed and configured. It will automatically start on system boot and handle all startup operations.

### Startup Sequence

On system boot:

1. Windows Service starts automatically (SYSTEM account)
2. Service runs `service-startup.js` which:
   - Performs git pull (force, overwrites local changes)
   - Runs `npm install` if package.json changed
   - Checks if build is needed (git commit hash changed or dist/ missing)
   - Builds `dist/` if needed
   - Starts Express server
3. Server is available at `http://localhost:3000`
4. Edge Kiosk mode (configured separately) launches browser automatically when kiosk user logs in

### Remote Restart

To remotely restart the service (via SSH):

```powershell
cd C:\path\to\WinnieOS
.\scripts\restart-service.ps1
```

This will:
1. Stop the Windows Service
2. Start the Windows Service (which will perform git pull, build if needed, and start server)

### Updating the Application

1. Make changes in your development environment
2. Commit and push to GitHub
3. On target laptop, either:
   - Reboot the laptop (automatic update on startup via service)
   - SSH in and run `.\scripts\restart-service.ps1` (restarts service, which pulls updates)

Updates are pulled from the `origin/<current-branch>` branch. The service automatically detects code changes via git commit hash and rebuilds if needed.

## Configuration

### Server Configuration

Edit `config/local.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "display": {
    "reference": {
      "width": 1280,
      "height": 800
    }
  },
  "logging": {
    "level": "info"
  },
  "chromium": {
    "path": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  },
  "apps": {
    "enabled": [
      "notepad",
      "letters",
      "colors"
    ]
  }
}
```

- **port**: Server port (default: 3000)
- **host**: Server hostname (default: localhost)
- **display.reference.width/height**: Default "virtual computer" reference resolution (used only if the user has not persisted a reference size via Storage utility)
- **logging.level**: Log level (info, warn, error, debug)
- **chromium.path**: Path to Chromium/Chrome executable
- **apps.enabled**: Array of app IDs to enable on desktop

The `chromium.path` configuration is no longer used by the service (browser launch is handled by Edge Kiosk mode). It may still be referenced in development scripts.

**Apps filtering behavior:**
- If `apps.enabled` is specified in config: only those apps are shown
- If `apps.enabled` is missing but config is available: all discovered apps are enabled (backward compatible)
- If config is unavailable (server not ready): defaults to `['colors']` only (safe fallback)

### Windows Service Management

Install service (requires Administrator):
```powershell
.\scripts\install-service.ps1 install
```
The installation script will automatically build `dist/` if it doesn't exist (service requires it).

Uninstall service (requires Administrator):
```powershell
.\scripts\install-service.ps1 uninstall
```
The uninstall script will stop the service before removing it.

Or use npm scripts:
```powershell
npm run install-service
npm run uninstall-service
```

## Scripts Reference

### PowerShell Scripts

#### `scripts/setup.ps1`

Initial setup script. Checks prerequisites, installs dependencies, creates local config, optionally installs service.

**What it does:**
- Checks prerequisites (Node.js, npm, Git)
- Installs npm dependencies
- Creates `config/local.json` from template
- Optionally installs Windows Service (requires admin, builds `dist/` if needed)

**Usage:**
```powershell
.\scripts\setup.ps1
.\scripts\setup.ps1 -SkipServiceInstall  # Skip service installation
```

#### `scripts/restart-service.ps1`

Simple service restart script. Stops and starts the Windows Service. The service will automatically perform git pull, build (if needed), and start the server.

**Usage:**
```powershell
.\scripts\restart-service.ps1
.\scripts\restart-service.ps1 -NoElevate  # Don't auto-elevate (will fail if admin needed)
```

#### `scripts/debug-startup.ps1`

Debug script for diagnosing service startup issues. Checks service status, logs, build status, and configuration.

**Usage:**
```powershell
.\scripts\debug-startup.ps1
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
- Check service logs in Windows Event Viewer or `logs/winnieos.log`
- Verify `server.js` exists and is accessible
- Verify `dist/` directory exists (service requires it)
- Run service installation as Administrator (install script will build `dist/` if missing)

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
- Manual pull: `git fetch --all && git reset --hard origin/<branch>` (replace `<branch>` with your branch name)
- Service status: Check with `Get-Service -Name "WinnieOS Server"`
- Service logs: Check `logs\winnieos.log` for startup sequence details
- Build detection: Service checks git commit hash - if changed or dist/ missing, it builds automatically
- If service won't start: Check logs for errors, verify git/node are in PATH for SYSTEM account
- Manual restart: Use `.\scripts\restart-service.ps1` to restart the service

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
- **Shared libraries**: `lib/` directory (e.g., `config-loader.js`)
- **Configuration**: `config/` directory
- **Scripts**: `scripts/` directory
- **Logs**: `logs/` directory (gitignored)

### Configuration Management

- **Default settings**: `config/default.json` (committed, source of truth)
- **Local overrides**: `config/local.json` (gitignored, optional)
- **Shared loader**: `lib/config-loader.js` handles loading and merging (used by server and Vite)
- Never commit `config/local.json`
- Always provide defaults in `config/default.json`
- Config loader auto-creates `default.json` from fallback defaults if missing
- Config loader uses deep merging to properly combine nested objects

### Git Workflow

- Force pull on production (overwrites local changes)
- Local config (`config/local.json`) is preserved (gitignored)
- Application state (via `WinnieOS.Utils.Storage` / localStorage/IndexedDB) is preserved (browser storage)

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
