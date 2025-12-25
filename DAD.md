# Dad Guide: Extending WinnieOS

WinnieOS is a local, offline-first “virtual computer” designed for a toddler. The UI is intentionally simple: **startup → desktop → app**, with a **global Home button** that always returns to the desktop.

This guide is the practical reference for adding new “apps” and working safely within the architecture.

## Mental model (the layers)

- **Core (do not fight this)**
  - `WinnieOS.Display`: owns the reference resolution (default 1280×800)
  - `WinnieOS.Viewport`: scales/centers `#winnieos-canvas` into the real screen
  - `WinnieOS.Kiosk`: blocks browser navigation shortcuts, etc.
- **Shell (always mounted)**
  - `WinnieOS.Shell`: renders the top-left **Home** button and mounts screens into the content area
- **Navigation (simple state machine)**
  - `WinnieOS.Navigation`: `startup | desktop | app`
- **Screens**
  - Startup screen, desktop screen, and app host screen
- **Apps (plug-ins)**
  - Dad adds apps; desktop auto-discovers them and shows big tiles

## Non-negotiable UI rules (keeps scaling sane)

- **Design at 1280×800** using **px + tokens** (no `vw/vh` inside the canvas)
- Everything lives inside `#winnieos-canvas`
- The app “responds” only via the single uniform `transform: scale(...)` applied by `Viewport`

## Where things live

- **Entry**: `src/main.js`
- **Core**: `src/js/core/*`
- **Shell**: `src/js/shell/*`
- **Navigation**: `src/js/nav/navigation.js`
- **Screens**: `src/js/screens/*`
- **Apps**: `src/js/apps/<appId>/app.js`
- **Design tokens**: `src/css/tokens.css`
- **Component CSS modules**: `src/css/components/*.css` (imported by `src/css/components.css`)
- **Static assets**: `public/assets/...` (copied into `dist/assets/...`)

## Add a new app (the main workflow)

### 1) Create the app module

Create a folder and file:

- `src/js/apps/balloons/app.js`

Export a single app definition:

```javascript
export default {
  id: 'balloons',
  title: 'Balloons',
  iconEmoji: '🎈',         // OR: iconSrc: '/assets/images/apps/balloons.png'
  sortOrder: 40,           // optional

  mount: function ({ root, nav }) {
    // root is the full-screen mount point for your app
    root.className = 'wos-app-placeholder';
    root.innerHTML = `
      <div class="wos-app-placeholder-title">Balloons</div>
      <div class="wos-app-placeholder-text">Pop pop!</div>
    `;

    // Optional: return a cleanup function
    return function cleanup () {
      // remove listeners, timers, etc.
    };
  },

  unmount: function () {
    // Optional: additional cleanup (also called when the app exits)
  }
};
```

That’s it—WinnieOS auto-discovers apps via Vite and adds them to the desktop.

### 2) (Optional) Add an icon image

- Put the file in: `public/assets/images/apps/balloons.png`
- Reference it via: `iconSrc: '/assets/images/apps/balloons.png'`

## Styling an app

- Prefer using design tokens from `src/css/tokens.css`
- If you need app-specific styles, create:
  - `src/css/components/apps-balloons.css`
  - Add `@import 'components/apps-balloons.css';` to `src/css/components.css`

## Navigation from inside an app

Apps are “full screen” and should not implement their own header/back button.

- Go home: `nav.goHome()`

## Build + deploy (important)

Production serves `dist/` and expects it to be committed.

- Dev: `npm run dev`
- Tests: `npm test`
- Build: `npm run build` (then **commit `dist/`**)

## Debugging tips

- View scaling metrics:
  - `WinnieOS.Viewport.getMetrics()` in the browser console
- If you see “Loading…” forever:
  - JS bundle likely failed to load, or the server is serving a stale `dist/`


