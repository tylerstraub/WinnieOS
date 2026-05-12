# WinnieOS

A small, custom computing environment for one young learner — Winnie. It runs as a local web app on her own 8" laptop in Chromium kiosk mode, and is designed to grow alongside her: starting simple now, gaining depth as her capabilities deepen.

**Try it:** [tylerstraub.github.io/WinnieOS](https://tylerstraub.github.io/WinnieOS/) — the same source builds to GitHub Pages for preview in any modern browser.

**For developers:** to add an app, start with [`DAD.md`](./DAD.md). For grounding context (when working with AI agents in this repo), see [`CLAUDE.md`](./CLAUDE.md).

## What it's for

WinnieOS isn't trying to be entertainment, and it isn't a generic kids' learning app. It's a real, deliberately-scoped computer — boot screen, desktop, apps — that introduces foundational computing concepts (keyboard input, navigation, persistence, app structure, cause and effect) through play that has substance underneath it. The project's long horizon is more interesting than any single app: as Winnie's abilities expand, WinnieOS expands with her. What feels like a colorful playground now is intended to mature into a real workspace later.

## Design principles

- **Teach real computing.** Keyboard input is a primary instructional surface, not an afterthought. Touch is supported because the device is small and comfortable to poke at — but apps are built so that growing into a real keyboard is the natural progression.
- **Grow with the user.** Apps and mechanics begin simple and deepen over time. The OS is not a fixed product; it's a long-running project that mirrors Winnie's developing skills.
- **Play with substance.** Apps are colorful and rewarding, but each one has a real concept underneath — letters, color, spatial reasoning, persistence, app structure.
- **Fully local, fully offline.** No network required after build. Nothing phones home.
- **One reference resolution.** Everything is designed at 1280×800 and scaled uniformly via a single CSS transform. No responsive reflow — layout is deterministic.
- **Don't fight the core.** Display, Viewport, and Kiosk modules are foundational. New work plugs into them rather than working around them.

## Architecture at a glance

- **Runtime:** Node.js + Express static server serving a Vite-built frontend (`dist/`)
- **Frontend:** vanilla ES modules, modular CSS, scaled by a single CSS transform
- **State:** a small navigation state machine — `startup → desktop → app` — with a globally-mounted Home button as the universal return gesture
- **Apps:** auto-discovered plug-ins under `src/js/apps/` — drop one in, it appears on the desktop
- **Deployment targets:** the kiosk laptop (Linux + systemd + Chromium) is primary; GitHub Pages is a public preview built from the same source

## Project structure

```
WinnieOS/
├── index.html                      # Vite entry point
├── src/                            # Frontend source (ES modules, modular CSS)
│   ├── main.js
│   ├── css/                        # tokens / base / layout / components
│   └── js/
│       ├── core/                   # display, viewport, kiosk, config
│       ├── shell/                  # always-mounted Home button + content host
│       ├── nav/                    # startup | desktop | app state machine
│       ├── screens/
│       ├── apps/                   # auto-discovered app plug-ins
│       ├── games/
│       └── utils/                  # storage, background, audio, health-poll
├── dist/                           # committed production build (served by Express)
├── public/assets/                  # static assets (images, fonts)
├── config/
│   ├── default.json
│   └── local.json.example
├── lib/config-loader.js            # shared config loader
├── deploy/
│   └── winnieos-server.service     # reference systemd unit
├── .github/workflows/pages.yml     # GitHub Pages build + deploy
├── server.js                       # Express static server
├── vite.config.js
├── vitest.config.js
├── package.json
├── DAD.md                          # practical guide to adding apps
└── CLAUDE.md                       # grounding context for AI-agent sessions
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

`config/default.json` is the source of truth. `config/local.json` (gitignored) overrides it via deep merge — the same shared loader is used by both `server.js` and `vite.config.js`. The frontend fetches a safe subset at `/winnieos-config.json`.

Keys:
- `server.port` / `server.host`
- `display.reference.width` / `display.reference.height` (default 1280×800)
- `logging.level` / `logging.filename`
- `apps.enabled` — array of app IDs shown on the desktop

## Deployment

### Kiosk (primary)

systemd-managed. The reference unit at `deploy/winnieos-server.service` runs `node server.js` as the `winnieos` user out of `/home/winnieos/app`. Chromium launches in `--kiosk` mode (configured by the display environment) and points at `http://localhost:3000`.

Updates are pulled by a timer on the device (outside this repo): it fetches `origin/master`, `git reset --hard`s, runs `npm ci` and `npm run build` if anything changed, then restarts the service. Already-loaded pages detect the new build via the `/healthz` SHA poll (`src/js/utils/health-poll.js`) and reload themselves, so Chromium stays running across deploys with no visible flash.

### GitHub Pages (preview)

The same source builds for static hosting via `.github/workflows/pages.yml` on every push to `master`. The two builds differ only in their Vite `base` — kiosk uses `/`, Pages uses `/WinnieOS/` — and the Express runtime endpoints are mirrored as static files where applicable: `/winnieos-config.json` is emitted at build time so Pages serves the same shape, and `/healthz` simply doesn't exist on Pages (the client poll abandons silently by design).

The kiosk's dynamic Express routes still shadow the static config file by registration order, so `config/local.json` overrides on the laptop are unaffected by the Pages build.

## Endpoints (Express only)

- `/` — the app
- `/healthz` — `{ version: <git SHA> }`, used by the client poll to detect deploys
- `/winnieos-config.json` — frontend-safe config subset (also emitted as a static file in `dist/` for the Pages build)
- `/winnieos-debug.json` — localhost-only, diagnostics for config/dist mismatches

## Logging

Logs go to `logs/winnieos.log` (JSON, rotated at 5 MB, 5 backups). On the kiosk:

```bash
journalctl -u winnieos-server.service -f   # service-level
tail -f /home/winnieos/app/logs/winnieos.log
```

## Target device

- 8" laptop, 1280×800 (16:10)
- Linux + Chromium in kiosk mode
- Keyboard and touch input — keyboard is the primary instructional surface; touch is a comfort accommodation for the small form factor
