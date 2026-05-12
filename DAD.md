# Dad Guide: Extending WinnieOS

WinnieOS is a local, offline-first "virtual computer" for one young learner — built to mature alongside her. The UI is intentionally simple: **startup → desktop → app**, with a **global Home button** that always returns to the desktop.

This guide is the practical reference for adding new "apps" and working safely within the architecture. Keep in mind the project's instructional bent: keyboard interaction is a primary surface, touch is supported as a comfort accommodation for the small device, and apps should have real concepts underneath the play.

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

## Two app shapes

There are two conventions in the repo. Pick the one that fits the app's complexity:

- **Inline apps** — small UI, no game loop. The whole app lives in `src/js/apps/<id>/app.js` (Colors, Notepad, Bubbles, etc.). Use this for the majority of apps.
- **Thin-adapter apps** — anything with a real game loop, canvas rendering, or substantial mechanics. `src/js/apps/<id>/app.js` is a small shell that sets up the DOM and imports a factory from `src/js/games/<id>/game.js`. The factory returns `{ start, dispose }` and owns its own RAF loop, timers, and cleanup. See `src/js/apps/letters/app.js` + `src/js/games/letters/game.js`, and Slalom for the canonical examples.

Start inline; promote to thin-adapter when the app outgrows it.

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
  iconEmoji: '🎈',         // OR an image — see step 3 for iconSrc
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

Vite auto-discovers the module via `import.meta.glob('./*/app.js', { eager: true })`.

### 2) Enable the app in config

Auto-discovery loads the module, but the desktop only shows apps whose id is in `config/default.json` → `apps.enabled`:

```json
{
  "apps": {
    "enabled": ["notepad", "letters", "colors", "slalom", "balloons"]
  }
}
```

If the config never loads (e.g. server isn't ready yet), the desktop conservatively falls back to showing only `colors`, so an app missing from `apps.enabled` is the #1 reason a new app silently doesn't appear. On the kiosk, `config/local.json` can override this without rebuilding — see the Configuration section in `README.md`.

### 3) (Optional) Add an icon image

- Put the file in: `public/assets/images/apps/balloons.png`
- Reference it via `import.meta.env.BASE_URL` so it resolves correctly on both the kiosk (`/`) and GitHub Pages (`/WinnieOS/`):

```javascript
iconSrc: import.meta.env.BASE_URL + 'assets/images/apps/balloons.png'
```

A root-anchored `'/assets/...'` string will work on the kiosk but 404 on Pages.

## Styling an app

- Prefer using design tokens from `src/css/tokens.css`
- If you need app-specific styles, create:
  - `src/css/components/apps-balloons.css`
  - Add `@import 'components/apps-balloons.css';` to `src/css/components.css`

## Navigation from inside an app

Apps are "full screen" and should not implement their own header/back button.

- Go home: `nav.goHome()`

## Using utilities in apps

### Storage Utility

```javascript
import { Storage } from '../../utils/storage.js';

// Save data
Storage.set('myapp.preference', { value: 123 });

// Retrieve data
const data = Storage.get('myapp.preference');
```

### Background Utility

```javascript
import { Background } from '../../utils/background.js';

// Apply and save a color
Background.apply('#ff0000');
Background.save('#ff0000');

// Get saved color
const saved = Background.getSaved();
```

### Audio Utility

```javascript
import { Audio } from '../../utils/audio.js';

// Prepare audio graph early (in mount)
Audio.ensure();

// Unlock on first user gesture (call before playing sounds)
Audio.unlock();

// Common cues
Audio.launch(0.8);        // App launch
Audio.tick();             // Subtle tap
Audio.pop(0.6);           // Emoji/reveal
Audio.type(0.3, 'alpha'); // Typing sound — flavors: 'alpha' | 'space' | 'enter'
Audio.poof(0.7);          // Clear/close
Audio.buzz(0.5);          // Error state
Audio.star(0.8);          // Pickup / reward jingle
Audio.ready(0.7);         // Get-ready cue (used at app start)
```

See `src/js/utils/audio.js` for the full surface — there's more (e.g. `reward`, `plink`, `bounce`, `colorDrag*`, `drumroll`, `setMasterLevel`) for richer apps.

## Build + deploy (important)

The kiosk serves `dist/` from the committed build, so any change you want on the laptop needs the rebuilt `dist/` committed alongside the source change.

- Dev: `npm run dev`
- Tests: `npm test`
- Build: `npm run build` (then **commit `dist/`**)

GitHub Pages builds its own `dist/` from CI when a push to `master` touches a build-affecting path (`src/`, `public/`, `vite.config.js`, etc. — see `.github/workflows/pages.yml`), so the Pages preview will reflect your change whether or not you committed `dist/`. Doc-only commits (README/DAD/CLAUDE) intentionally don't trigger a redeploy; use the workflow's manual run if you ever need one. The kiosk follows its own pull-and-rebuild loop and is unaffected by this.

## Debugging tips

- View scaling metrics: `WinnieOS.Viewport.getMetrics()` in the browser console.
- New app not on the desktop? First check `config/default.json` → `apps.enabled` includes the new id (see step 2 above). Auto-discovery without enablement is the most common cause.
- Stuck on the gradient background with no boot animation? The JS bundle likely failed to load — check the browser console.


