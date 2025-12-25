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

## Architecture

### Technology Stack

- **Runtime**: Node.js (v24.6.0+)
- **Web Server**: Express.js (static file server)
- **Service Manager**: node-windows (Windows Service integration)
- **Logging**: Winston (file-based logging)
- **Browser**: Chromium/Chrome in kiosk mode

### Project Structure

```
WinnieOS/
├── public/                 # Web application files (HTML, CSS, JS)
│   ├── index.html         # Main entry point
│   └── assets/            # Static assets (images, fonts, etc.)
├── config/
│   ├── default.json       # Default configuration (committed)
│   ├── local.json.example # Template for local config (committed)
│   └── local.json         # Local overrides (gitignored)
├── scripts/
│   ├── install-service.js # Node.js script for Windows Service install/uninstall
│   ├── install-service.ps1 # PowerShell wrapper for service installation
│   ├── setup.ps1          # Initial setup script
│   ├── start.ps1          # Startup script (git pull, start service, launch browser)
│   ├── restart.ps1        # Remote restart script
│   ├── setup-task-scheduler.ps1 # Task Scheduler setup script
│   └── debug-startup.ps1  # Debug script for startup issues
├── logs/                  # Application logs (gitignored)
│   └── winnieos.log
├── server.js              # Express web server (production)
├── server-dev.js          # Development server with hot reload (browser-sync)
├── package.json           # Node.js dependencies and scripts
├── README.md              # Detailed development reference guide
├── AGENTS.md              # Context for AI agents
└── .gitignore            # Git ignore rules
```

### Key Components

#### Web Server

- **`server.js`**: Production Express.js static file server
  - Serves files from `public/` directory
  - Configurable port (default: 3000)
  - File-based logging via Winston
  - Graceful shutdown handling
  - Used by Windows Service in production

- **`server-dev.js`**: Development server with hot reload
  - Uses browser-sync for automatic browser reloading
  - CSS changes inject instantly (no page reload)
  - HTML/JS changes trigger automatic reload
  - Watches `public/` directory for file changes
  - Used via `npm run dev` for local development

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

3. (Optional) Edit `config/local.json` to customize:
   - Server port (default: 3000)
   - Logging level (default: info)
   - Chromium path (if not using auto-detection)

### Development Mode

**On your development machine:**

1. Start the development server with hot reload:
   ```powershell
   npm run dev
   ```
   This uses `server-dev.js` with browser-sync for automatic browser reloading.

2. Access the application:
   - Open browser to `http://localhost:3000`
   - Make changes to files in `public/`
   - Browser automatically reloads on file changes (CSS changes inject instantly)

3. For production-like server (without hot reload):
   ```powershell
   npm start
   ```
   or
   ```powershell
   node server.js
   ```

4. View logs:
   ```powershell
   Get-Content logs\winnieos.log -Tail 50 -Wait
   ```

**No Windows Service needed for development** - just run the server directly.

### Making Changes

1. Edit files in `public/` directory (HTML, CSS, JavaScript)
2. Test locally with `npm run dev` (automatic hot reload) or `npm start` (production-like)
3. Commit changes:
   ```powershell
   git add .
   git commit -m "Description of changes"
   git push
   ```

### Testing on Production Laptop

The production laptop will automatically pull updates on startup via `start.ps1`.

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

- `npm start` - Start the production server (`server.js`)
- `npm run dev` - Start the development server with hot reload (`server-dev.js`)
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

- **Web app files**: `public/` directory
- **Server code**: `server.js` (keep it simple, this is just a static file server)
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

- Use standard JavaScript (ES6+)
- Keep code simple and readable
- Comment complex logic
- Follow existing patterns

## Future Considerations

- Service Worker for offline caching (if needed)
- Auto-update mechanism improvements
- Parent/admin mode (currently relies on Alt+F4 in kiosk mode)
- Application state persistence strategy

## License

ISC

