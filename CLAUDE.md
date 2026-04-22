# CLAUDE.md

This file provides context for Claude Code sessions working on WinnieOS.

## What is WinnieOS?

A kid-friendly "pretend OS" for a toddler - a local web app designed for an 8" Linux laptop (1280x800) in Chromium kiosk mode. Built to introduce basic computing concepts through colorful, touch-friendly apps.

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
│   ├── apps/      # Plugin apps (auto-discovered)
│   └── utils/     # Storage, Background, Audio
```

**Navigation flow:** Startup animation → Desktop grid → App (Home button returns to Desktop)

## Critical Constraint: Reference Resolution

All UI is designed at **1280x800 px** and scales uniformly via CSS transform. This is non-negotiable.

- Use `px` units for all sizing (never `vw`/`vh` inside the canvas)
- Use design tokens from `src/css/tokens.css`
- The `WinnieOS.Viewport` system handles scaling automatically

## Adding an App

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

Apps are auto-discovered by Vite. See `DAD.md` for the practical guide.

## Key Files for Context

| Need to understand... | Read... |
|-----------------------|---------|
| App extension patterns | `DAD.md` |
| Full architecture details | `AGENTS.md` |
| Config system | `lib/config-loader.js`, `config/default.json` |
| Core initialization | `src/js/core/index.js` |
| How apps are discovered | `src/js/apps/index.js` |

## Conventions

- **Commit `dist/`** - Production serves the committed build
- **Don't fight the core** - Display, Viewport, Kiosk are foundational
- **Keep it simple** - This is for a toddler; complexity is the enemy

---

*This CLAUDE.md is intentionally minimal. It provides grounding context and points to code where Claude can discover more. Future sessions should maintain this convention rather than expanding this file with exhaustive documentation.*
