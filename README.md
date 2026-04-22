# WinnieOS

A kid-friendly "pretend OS" — a local web app for an 8" laptop (1280×800) running Chromium in kiosk mode. Built to introduce a toddler to basic computing concepts through colorful, touch-friendly apps.

**Extending WinnieOS (adding apps):** start with `DAD.md`.

## Overview

- **Fully local**: no network required after the initial clone/build
- **Runtime**: Node.js + Express static server serving a Vite-built frontend (`dist/`)
- **Frontend**: vanilla ES modules, modular CSS, designed at 1280×800 and scaled via a single CSS transform
- **Deployment target**: Linux (systemd) + Chromium kiosk

## Project Structure

```
WinnieOS/
├── index.html             # Vite entry point
├── src/                   # Frontend source (ES modules, modular CSS)
│   ├── main.js
│   ├── css/               # tokens / base / layout / components
│   └── js/
│       ├── core/          # display, viewport, kiosk, config
│       ├── shell/         # always-mounted Home button + content host
│       ├── nav/           # startup | desktop | app state machine
│       ├── screens/
│       ├── apps/          # auto-discovered app plug-ins
│       ├── games/
│       └── utils/         # storage, background, audio, health-poll
├── dist/                  # committed production build (served by Express)
├── public/assets/         # static assets (images, fonts)
├── config/
│   ├── default.json
│   └── local.json.example
├── lib/config-loader.js   # shared config loader
├── deploy/
│   └── winnieos-server.service  # reference systemd unit
├── server.js              # Express static server
├── vite.config.js
├── vitest.config.js
├── package.json
├── DAD.md                 # practical guide to adding apps
└── AGENTS.md              # context for AI agents
```

## Development

```bash
nvm use           # reads .nvmrc (Node 22)
npm install
npm run dev       # Vite dev server with HMR at http://localhost:3000
npm test          # Vitest
npm run build     # production build to dist/
npm start         # production server (serves dist/)
```

Commit `dist/` with your changes — production serves the committed build.

## Configuration

`config/default.json` is the source of truth. `config/local.json` (gitignored) overrides it via deep merge. The frontend fetches a safe subset at `/winnieos-config.json`.

Keys:
- `server.port` / `server.host`
- `display.reference.width` / `display.reference.height` (default 1280×800)
- `logging.level` / `logging.filename`
- `apps.enabled` — array of app IDs shown on the desktop

## Deployment

Deployment is systemd-based. A reference unit lives at `deploy/winnieos-server.service` — it runs `node server.js` as the `winnieos` user out of `/home/winnieos/app`. Chromium launches in `--kiosk` mode (configured by the display environment, e.g. sway) and points at `http://localhost:3000`.

Updates are pulled by a timer on the target device (outside this repo): it fetches `origin/main`, `git reset --hard`, runs `npm ci` and `npm run build` if needed, and restarts the service. Already-loaded pages detect the new build via the `/healthz` version poll (see `src/js/utils/health-poll.js`) and reload themselves, so Chromium stays running across deploys.

## Endpoints

- `/` — the app
- `/healthz` — `{ version: <git SHA> }`, used by the client-side poll to detect new deploys
- `/winnieos-config.json` — frontend-safe config subset
- `/winnieos-debug.json` — localhost-only, diagnostics for config/dist mismatches

## Logging

Logs go to `logs/winnieos.log` (JSON, rotated at 5 MB, 5 backups). On the kiosk, tail via:

```bash
journalctl -u winnieos-server.service -f   # service-level
tail -f /home/winnieos/app/logs/winnieos.log
```

## Target Device

- 8" laptop, 1280×800 (16:10)
- Linux + Chromium in kiosk mode
- Touch + keyboard input
