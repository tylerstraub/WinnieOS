# CLAUDE.md

This file provides context for Claude Code sessions working on WinnieOS.

## What is WinnieOS?

A local "pretend OS" built for one young learner — Winnie — and designed to grow with her. It runs as a local web app on an 8" Linux laptop (1280×800) in Chromium kiosk mode, and is also published to GitHub Pages from the same source. The instructional bent is keyboard-first; touch is supported as a comfort accommodation for the small device.

## Quick Start (macOS/Development)

```bash
nvm use 22        # or: nvm use (reads .nvmrc)
npm install
npm run dev       # Vite dev server with HMR
npm test          # Vitest test suite
npm run build     # Production build to dist/
npm start         # Production server (serves dist/)
```

## Architecture at a Glance

```
src/
├── css/           # Modular stylesheets (tokens → base → layout → components)
├── js/
│   ├── core/      # Display, Viewport, Kiosk, Config
│   ├── shell/     # Always-mounted Home button + content host
│   ├── nav/       # Navigation state machine (startup → desktop → app)
│   ├── screens/   # Startup, Desktop, AppHost
│   ├── apps/      # Plugin apps (auto-discovered, filtered by apps.enabled)
│   ├── games/     # Factory modules for richer apps (thin-adapter pattern)
│   └── utils/     # Storage, Background, Audio, health-poll
```

**Navigation flow:** Startup animation → Desktop grid → App (Home button returns to Desktop).

## Critical Constraint: Reference Resolution

All UI is designed at **1280×800 px** and scales uniformly via CSS transform. This is non-negotiable.

- Use `px` units for all sizing (never `vw`/`vh` inside the canvas).
- Use design tokens from `src/css/tokens.css`.
- The `WinnieOS.Viewport` system handles scaling automatically.

## Runtime Namespace

All JavaScript modules attach themselves to a shared `window.WinnieOS`:

```
window.WinnieOS = {
    Display, Viewport, Kiosk, Config,    // core
    Navigation,                          // state machine
    Shell, Screens, Apps, Components,    // UI surface
    Utils: { Storage, Background, Audio }
}
```

Modules self-register at the bottom of their file (`window.WinnieOS.Foo = Foo`). Useful for debugging from the browser console (`WinnieOS.Viewport.getMetrics()`, `WinnieOS.Apps.list()`).

## Adding an App (short form)

Create `src/js/apps/{appId}/app.js`:

```javascript
export default {
  id: 'myapp',
  title: 'My App',
  iconEmoji: '🎯',
  mount({ root, nav }) {
    root.innerHTML = '<div>Hello!</div>';
    return () => { /* cleanup */ };
  }
};
```

**Then add the id to `config/default.json` → `apps.enabled`** — auto-discovery loads the module, but the desktop only shows enabled apps. Missing this step is the #1 reason a new app silently doesn't appear.

Apps are auto-discovered by Vite. See `DAD.md` for the full guide, including the thin-adapter pattern for richer apps that have a real game loop.

## Key Files for Context

| Need to understand... | Read... |
|-----------------------|---------|
| App extension patterns | `DAD.md` |
| Config system | `lib/config-loader.js`, `config/default.json` |
| Core initialization | `src/js/core/index.js` |
| How apps are discovered | `src/js/apps/index.js` |
| Pages vs kiosk build | `vite.config.js`, `.github/workflows/pages.yml` |

## Conventions

- **Commit `dist/`** — the kiosk serves the committed build.
- **Don't fight the core** — Display, Viewport, Kiosk are foundational.
- **Keep it simple** — WinnieOS values clarity over cleverness; complexity is the enemy.
- **Base-aware paths** — any same-origin fetch or asset URL should resolve through `import.meta.env.BASE_URL` so it works on both the kiosk (`/`) and Pages (`/WinnieOS/`).

---

*This CLAUDE.md is intentionally minimal. It provides grounding context and points to code where Claude can discover more. Future sessions should maintain this convention rather than expanding this file with exhaustive documentation.*
