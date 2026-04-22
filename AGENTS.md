# Agent Context: WinnieOS

This document provides essential context for AI agents working on the WinnieOS project. For a high-level overview, see `README.md`. For extending WinnieOS with new apps, see `DAD.md`.

## Project Overview

WinnieOS is a kid-friendly computing environment: a local web application that runs in Chromium kiosk mode, optimized for an 8" laptop (1280×800, 16:10). It is designed to introduce a toddler to basic computing concepts and will grow into a full "pretend OS" experience.

**Key principle:** The entire application runs locally. Updates reach the kiosk device through a systemd-timer-driven git pull on the target (this lives outside the repo).

## Architecture Summary

- **Web server**: Express.js serving static files from `dist/` (Vite build output)
- **Build tool**: Vite (dev server with HMR, production builds)
- **Testing**: Vitest
- **Configuration**: JSON-based (defaults + optional local overrides)
- **Logging**: Winston file-based logging to `logs/winnieos.log`
- **Browser**: Chromium in `--kiosk` mode on the target device
- **Frontend**: Modular CSS + vanilla ES modules, startup → desktop → apps

## Critical File Locations

### Server & Infrastructure
- `server.js` — Express web server (serves `dist/`, exposes `/healthz`, `/winnieos-config.json`, `/winnieos-debug.json`)
- `vite.config.js` — Vite configuration (dev server, build settings)
- `vitest.config.js` — Vitest test configuration
- `lib/config-loader.js` — Shared configuration loader (used by `server.js` and `vite.config.js`)
- `config/default.json` — Default configuration (committed, source of truth)
- `config/local.json` — Local overrides (gitignored, optional)
- `deploy/winnieos-server.service` — Reference systemd unit for the kiosk device
- `logs/winnieos.log` — Application logs (gitignored)

### Frontend

**Entry point:**
- `index.html` — Vite entry point
- `src/main.js` — imports all CSS and JS modules in dependency order

**CSS (modular):**
- `src/css/tokens.css` — design tokens (CSS custom properties)
- `src/css/base.css` — reset, canvas styling, kiosk protections
- `src/css/layout.css` — layout utilities
- `src/css/components.css` — component imports
- `src/css/components/` — individual component stylesheets

**JavaScript (ES modules):**
- `src/js/core/display.js` — reference resolution owner
- `src/js/core/viewport.js` — scales/centers the canvas
- `src/js/core/kiosk.js` — kiosk protections
- `src/js/core/config.js` — runtime config loader (fetches `/winnieos-config.json`)
- `src/js/core/index.js` — core initialization
- `src/js/nav/navigation.js` — startup/desktop/app state machine
- `src/js/shell/` — always-mounted Home button + content host
- `src/js/screens/` — Startup / Desktop / AppHost
- `src/js/apps/` — app plug-ins (auto-discovered by Vite, filtered by config)
- `src/js/games/` — game modules (full-screen interactive experiences)
- `src/js/utils/storage.js` — localStorage wrapper
- `src/js/utils/background.js` — background color management
- `src/js/utils/audio.js` — Web Audio API sound system
- `src/js/utils/health-poll.js` — polls `/healthz`, reloads on new deploys

**Build output:**
- `dist/` — production build (committed, served by Express)
- `public/assets/` — static assets copied into `dist/` by Vite

## Frontend Foundation Principles

### Reference Resolution System

**Critical:** 1280×800 (16:10) is the absolute reference point.

- `#winnieos-canvas` is ALWAYS the reference resolution in px (default 1280×800). It never follows the real device viewport.
- All UI elements use px units.
- The canvas is scaled/centered via `transform: scale()` and pixel offsets — letterbox/pillarbox as needed.
- At exact reference resolution: scale = 1.0, offsets = 0.

**DO NOT** use vw/vh inside the canvas, change canvas size based on the viewport, or hand-roll scaling in CSS.

**DO** use px units, CSS custom properties (design tokens), and design everything at 1280×800. JavaScript handles scaling.

### Design Tokens

All styling values are CSS custom properties in `src/css/tokens.css`:
- Typography: `--font-size-xs` through `--font-size-6xl`
- Spacing: `--spacing-xs` through `--spacing-5xl`
- Colors: `--color-primary`, `--color-secondary`, `--color-text`
- Touch targets: `--touch-target-min`, `--touch-target-comfortable`

Always use design tokens, never hardcode values.

### JavaScript Namespace

All JavaScript is organized under `window.WinnieOS`:

```javascript
window.WinnieOS = {
    Display: { ... },
    Viewport: { ... },
    Kiosk: { ... },
    Config: { ... },
    Navigation: { ... },
    Shell: { ... },
    Screens: { ... },
    Apps: { ... },
    Components: { ... },
    Utils: {
        Storage: { ... },
        Background: { ... },
        Audio: { ... }
    }
}
```

## Development vs Production

### Development (developer's machine)

- `npm run dev` — Vite dev server with HMR
- `npm run build` — production bundle to `dist/`
- `npm start` — production server (serves `dist/`)
- `npm test` — Vitest suite
- Access at `http://localhost:3000`
- Edit `src/`, test, build, commit (**including `dist/`**), push

### Production (kiosk device)

- A systemd service runs `node server.js` as the `winnieos` user out of `/home/winnieos/app` (reference unit at `deploy/winnieos-server.service`).
- A polling timer on the device fetches `origin/main`, `git reset --hard`, runs `npm ci` + `npm run build` if the lockfile changed, and restarts the service.
- Already-loaded Chromium pages detect the new build via `/healthz` (returns `{ version: <git SHA> }`) and reload themselves — no need to kill the browser.
- All of this update machinery lives on the target device, not in this repo.

## Configuration System

- **Shared loader:** `lib/config-loader.js` handles all config loading (used by both `server.js` and `vite.config.js`)
- **Merging:** `local.json` overrides `default.json` via deep merge (arrays are replaced, not merged)
- **`default.json`** is required and auto-created from fallback defaults if missing
- **`local.json`** is optional and gitignored
- **Runtime config** is exposed at `/winnieos-config.json` (safe subset)
- **Debug endpoint** at `/winnieos-debug.json` (localhost-only) for diagnosing config/dist mismatches

Keys:
- `server.port` / `server.host`
- `logging.level` / `logging.filename`
- `display.reference.width` / `display.reference.height`
- `apps.enabled` — array of app IDs to show on the desktop (missing or unavailable → defaults to `['colors']` as a safe fallback)

## Common Tasks for Agents

### Adding an App (preferred extension path)
1. Create `src/js/apps/<appId>/app.js`
2. Export a default app definition with `id`, `title`, and `mount({ root, nav })`
3. (Optional) Add `iconEmoji` or `iconSrc` (path into `public/assets/images/apps/`)
4. Add the app ID to `config/default.json` → `apps.enabled` (or rely on auto-enable)
5. Build and commit `dist/`

### Adding a Component
1. `src/css/components/my-component.css`
2. Import it from `src/css/components.css`
3. `src/js/components/MyComponent.js` — ES module, attach to `window.WinnieOS.Components`
4. Import in `src/main.js` if the component registry doesn't pick it up

### Adding a Screen
1. Create a screen module in `src/js/screens/`
2. Register it in `src/js/screens/index.js`
3. Screens are switched by `WinnieOS.Navigation` and mounted by `WinnieOS.Shell`

### Adding a Utility
1. `src/js/utils/my-utility.js` — ES module
2. Attach to `window.WinnieOS.Utils`
3. Import from `src/js/utils/index.js`

### Adding an npm dependency
1. `npm install <package>`
2. Test locally (`npm run dev`, `npm test`), then build (`npm run build`)
3. Commit `package.json`, `package-lock.json`, and `dist/`

### Debugging Production Issues
1. Check `logs/winnieos.log` (or `journalctl -u winnieos-server.service` on the target)
2. Verify `dist/` exists and is up-to-date
3. Hit `/winnieos-debug.json` from the device for config/dist introspection
4. `npm run build` locally to regenerate `dist/` if needed

## Things to Remember

1. **Keep `server.js` simple** — it is a static file server plus a couple of JSON endpoints; don't add complexity.
2. **Source files in `src/`** — CSS, JS ES modules.
3. **Build output in `dist/`** — committed to git.
4. **Static assets in `public/`** — Vite copies them into `dist/`.
5. **ES modules** — all JavaScript uses `import`/`export`.
6. **Preserve the namespace** — attach to `window.WinnieOS`.
7. **Config is merged** — local overrides default via deep merge (`lib/config-loader.js`).
8. **Reference resolution** — everything designed at 1280×800px, scales automatically.
9. **Design tokens** — always use CSS custom properties.
10. **Modular structure** — one component = one CSS file + one JS file.
11. **px units only** — no vw/vh inside the canvas.

## Testing Approach

- **Development:** `npm run dev` for HMR; `npm start` for production-like.
- **Unit tests:** `npm test` (Vitest).
- **Build:** always test the production build with `npm run build` before committing.
- **Viewport scaling:** verify at 1280×800 (reference) and at a couple of other sizes.

## Current Apps

Apps are auto-discovered from `src/js/apps/<appId>/app.js`. Enabled by default:
- `notepad` — rich text editor with color picker and emoji palette
- `letters` — 2D physics pachinko-style letter matching (Matter.js)
- `colors` — radial color picker for the background
- `slalom` — "Jet", toddler-friendly space slalom (Canvas 2D, day/night progression)
- `floorzero` — WinnieRPG alpha, iframe-hosted

Stubs exist for `animals`, `blocks`, `bubbles`, `dance`, `garden`, `memory`, `music`, `numbers`, `paint`, `piano`, `shapes`, `story` — enable via `config/default.json` → `apps.enabled`.
