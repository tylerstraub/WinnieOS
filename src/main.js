/**
 * WinnieOS Main Entry Point
 * 
 * Vite entry point - imports all CSS and JS modules
 * Order matters: CSS first, then JS modules in dependency order
 */

// CSS: Foundation and Design System (order matters)
import './css/tokens.css';
import './css/base.css';
import './css/layout.css';
import './css/components.css';

// JavaScript: Core Systems (order matters - Display → Viewport → Kiosk → init)
import './js/core/display.js';
import './js/core/viewport.js';
import './js/core/kiosk.js';
import './js/core/index.js';

// JavaScript: Utilities (load before components)
import './js/utils/index.js';

// JavaScript: Components (load after utilities)
import './js/components/index.js';

// JavaScript: WinnieOS UI Foundation (Shell + Navigation + Screens + Apps)
import './js/apps/index.js';
import './js/nav/navigation.js';
import './js/screens/index.js';
import './js/shell/index.js';

