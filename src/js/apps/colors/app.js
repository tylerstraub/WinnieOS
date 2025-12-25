/**
 * Colors App
 * 
 * Simplified RGB color picker for changing WinnieOS background color.
 * Large touch-friendly interface with smooth animations.
 */

import { Background } from '../../utils/background.js';
import { Audio } from '../../utils/audio.js';

export default {
    id: 'colors',
    title: 'Colors',
    iconEmoji: '🌈',
    sortOrder: 30,

    mount: function({ root }) {
        if (!root) return;

        // Prepare audio graph early; unlock happens on first user gesture.
        try { Audio.ensure(); } catch (_) { /* ignore */ }

        // Clear any existing content
        root.className = 'wos-colors-app';
        root.innerHTML = '';

        // Centered container (keeps a nice bounded card, not full-bleed)
        const container = document.createElement('div');
        container.className = 'wos-colors-container';

        // Create color picker area (fills the bounded card)
        const pickerArea = document.createElement('div');
        pickerArea.className = 'wos-colors-picker';
        pickerArea.setAttribute('role', 'application');
        pickerArea.setAttribute('aria-label', 'Color picker');

        // Create canvas for color picker (HSV color space: Hue/Saturation, Value fixed)
        const canvas = document.createElement('canvas');
        canvas.className = 'wos-colors-canvas';

        // Tuning: keep the center light, but never close to pure white.
        // We do this by clamping saturation away from 0 and value slightly below 1.
        const SATURATION_MIN = 0.35;  // Increased from 0.22 - ensures more color even at center
        const VALUE_FIXED = 0.95;     // Decreased from 0.98 - slightly less bright

        // Track last hue so “near center” interactions feel stable (angle is noisy at dx≈0,dy≈0)
        let lastHue = 0;

        const clamp01 = (n) => Math.max(0, Math.min(1, n));

        // HSV to RGB conversion helper
        const hsvToRgb = (h, s, v) => {
            h = h % 360;
            if (h < 0) h += 360;
            const c = v * s;
            const x = c * (1 - Math.abs((h / 60) % 2 - 1));
            const m = v - c;
            
            let r = 0, g = 0, b = 0;
            if (h < 60) {
                r = c; g = x; b = 0;
            } else if (h < 120) {
                r = x; g = c; b = 0;
            } else if (h < 180) {
                r = 0; g = c; b = x;
            } else if (h < 240) {
                r = 0; g = x; b = c;
            } else if (h < 300) {
                r = x; g = 0; b = c;
            } else {
                r = c; g = 0; b = x;
            }
            
            return {
                r: Math.round((r + m) * 255),
                g: Math.round((g + m) * 255),
                b: Math.round((b + m) * 255)
            };
        };

        // RGB to HSV conversion helper (for restoring indicator position)
        const rgbToHsv = (r, g, b) => {
            r = r / 255;
            g = g / 255;
            b = b / 255;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;

            let h = 0;
            if (delta !== 0) {
                if (max === r) {
                    h = ((g - b) / delta) % 6;
                } else if (max === g) {
                    h = (b - r) / delta + 2;
                } else {
                    h = (r - g) / delta + 4;
                }
            }
            h = Math.round(h * 60);
            if (h < 0) h += 360;

            const s = max === 0 ? 0 : delta / max;
            const v = max;

            return { h, s, v };
        };

        const getGeometry = () => {
            const rect = pickerArea.getBoundingClientRect();
            const width = Math.max(1, rect.width);
            const height = Math.max(1, rect.height);
            const cx = width / 2;
            const cy = height / 2;
            const radius = Math.min(cx, cy);
            return { rect, width, height, cx, cy, radius };
        };

        const mapDistanceToSaturation = (t) => SATURATION_MIN + (1 - SATURATION_MIN) * clamp01(t);
        const mapSaturationToDistanceT = (s) => clamp01((s - SATURATION_MIN) / (1 - SATURATION_MIN));

        const pointToWheel = (clientX, clientY) => {
            const { rect, width, height, cx, cy, radius } = getGeometry();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            const dx = x - cx;
            const dy = y - cy;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Clamp to the circle boundary for indicator positioning and stable mapping.
            const distClamped = Math.min(radius, distance);
            const angle = Math.atan2(dy, dx);
            const hue = (distance < 1 ? lastHue : (angle * 180 / Math.PI + 360) % 360);
            const t = radius <= 0 ? 0 : distClamped / radius;

            return { width, height, cx, cy, radius, dx, dy, distance, distClamped, angle, hue, t };
        };

        const colorFromWheel = ({ hue, t }) => {
            const saturation = mapDistanceToSaturation(t);
            const rgb = hsvToRgb(hue, saturation, VALUE_FIXED);
            return Background.rgbToHex(rgb.r, rgb.g, rgb.b);
        };

        // Create selection indicator
        const indicator = document.createElement('div');
        indicator.className = 'wos-colors-indicator';
        indicator.setAttribute('aria-hidden', 'true');

        const setIndicatorFromWheel = ({ cx, cy, radius, angle, distClamped, width, height }) => {
            // Convert clamped polar coordinates back to a point inside the circle
            const px = cx + Math.cos(angle) * distClamped;
            const py = cy + Math.sin(angle) * distClamped;
            indicator.style.left = `${(px / width) * 100}%`;
            indicator.style.top = `${(py / height) * 100}%`;
        };

        const updateIndicatorFromSavedColor = () => {
            const savedColor = Background.getSaved();
            const { width, height, cx, cy, radius } = getGeometry();

            if (!savedColor || radius <= 0) {
                // Default to center (still not near-white due to SATURATION_MIN + VALUE_FIXED)
                indicator.style.left = '50%';
                indicator.style.top = '50%';
                return;
            }

            const rgb = Background.hexToRgb(savedColor);
            const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

            // Best-effort restore: match our clamped saturation range.
            lastHue = hsv.h;
            const t = mapSaturationToDistanceT(hsv.s);
            const angle = (hsv.h * Math.PI) / 180;
            const dist = t * radius;

            const px = cx + Math.cos(angle) * dist;
            const py = cy + Math.sin(angle) * dist;
            indicator.style.left = `${(px / width) * 100}%`;
            indicator.style.top = `${(py / height) * 100}%`;
        };

        // Function to resize and redraw canvas based on container size
        const resizeCanvas = () => {
            const rect = pickerArea.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const cssWidth = Math.max(1, Math.floor(rect.width));
            const cssHeight = Math.max(1, Math.floor(rect.height));

            // Set canvas internal resolution (accounting for device pixel ratio)
            const pixelWidth = Math.max(1, Math.floor(cssWidth * dpr));
            const pixelHeight = Math.max(1, Math.floor(cssHeight * dpr));
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Draw a *circular* color wheel:
            // - Hue = angle
            // - Saturation = radius (clamped away from 0 so you can’t approach white)
            // - Value = fixed slightly < 1 to keep it natural
            // - Outside the wheel: transparent (so it doesn’t look like a square picker)
            const imageData = ctx.createImageData(pixelWidth, pixelHeight);
            const data = imageData.data;

            const centerX = pixelWidth / 2;
            const centerY = pixelHeight / 2;
            const maxRadius = Math.min(centerX, centerY);

            for (let y = 0; y < pixelHeight; y++) {
                for (let x = 0; x < pixelWidth; x++) {
                    const dx = x - centerX;
                    const dy = y - centerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    const index = (y * pixelWidth + x) * 4;

                    // Transparent outside the wheel
                    if (distance > maxRadius) {
                        data[index + 3] = 0;
                        continue;
                    }

                    const angle = Math.atan2(dy, dx);
                    const hue = (angle * 180 / Math.PI + 360) % 360;
                    const t = maxRadius <= 0 ? 0 : distance / maxRadius;
                    const saturation = mapDistanceToSaturation(t);

                    const rgb = hsvToRgb(hue, saturation, VALUE_FIXED);
                    data[index] = rgb.r;
                    data[index + 1] = rgb.g;
                    data[index + 2] = rgb.b;
                    data[index + 3] = 255;
                }
            }

            ctx.putImageData(imageData, 0, 0);
        };

        // Initial mount
        pickerArea.appendChild(canvas);

        pickerArea.appendChild(indicator);
        container.appendChild(pickerArea);
        root.appendChild(container);

        // Layout + initial draw (defer to next frame so geometry is correct)
        requestAnimationFrame(() => {
            resizeCanvas();
            updateIndicatorFromSavedColor();
        });

        const resizeObserver = new ResizeObserver(() => {
            resizeCanvas();
            updateIndicatorFromSavedColor();
        });
        resizeObserver.observe(pickerArea);

        // Interaction (Pointer Events + pointer capture = consistent drag across mouse/touch)
        let activePointerId = null;
        let lastMove = null; // { x, y, ts }
        const nowMs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

        const updateDragSound = (wheel, clientX, clientY) => {
            try {
                if (!wheel) return;
                const now = nowMs();
                let speed01 = 0.35;
                if (lastMove && Number.isFinite(lastMove.ts)) {
                    const dt = Math.max(1, now - lastMove.ts);
                    const dx = (clientX - lastMove.x);
                    const dy = (clientY - lastMove.y);
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const pxPerMs = dist / dt;
                    // Typical comfy drag ~0.3..1.5 px/ms; clamp to 0..1
                    speed01 = Math.max(0, Math.min(1, pxPerMs / 1.6));
                }
                lastMove = { x: clientX, y: clientY, ts: now };

                if (Audio && typeof Audio.colorDragUpdate === 'function') {
                    Audio.colorDragUpdate({ hue: wheel.hue, t: wheel.t, speed: speed01 });
                }
            } catch (_) { /* ignore */ }
        };

        const applySelection = (clientX, clientY) => {
            const wheel = pointToWheel(clientX, clientY);
            lastHue = wheel.hue;

            // Indicator uses the clamped circle geometry (matches visual wheel)
            setIndicatorFromWheel(wheel);

            const color = colorFromWheel(wheel);

            indicator.classList.add('wos-colors-indicator-active');
            setTimeout(() => {
                indicator.classList.remove('wos-colors-indicator-active');
            }, 180);

            Background.apply(color);
            Background.save(color);

            // Continuous "drag" tone follows hue + saturation while the pointer is down.
            if (activePointerId !== null && Audio) {
                updateDragSound(wheel, clientX, clientY);
            }
        };

        const onPointerDown = (e) => {
            // Only primary pointer; keep it simple for toddlers (no multi-touch)
            if (activePointerId !== null) return;
            activePointerId = e.pointerId;
            try { pickerArea.setPointerCapture(activePointerId); } catch (_) { /* ignore */ }
            e.preventDefault();

            const ensureUnlocked = () => {
                try {
                    if (Audio && typeof Audio.isUnlocked === 'function' && Audio.isUnlocked()) return Promise.resolve(true);
                    if (Audio && typeof Audio.unlock === 'function') return Audio.unlock().then(() => true).catch(() => false);
                } catch (_) { /* ignore */ }
                return Promise.resolve(false);
            };

            ensureUnlocked().then((ok) => {
                if (!ok) return;
                try {
                    if (Audio && typeof Audio.colorDragStart === 'function') Audio.colorDragStart();
                } catch (_) { /* ignore */ }
                // Ensure we emit at least one update after unlock so the tone matches the initial position.
                try {
                    const wheel = pointToWheel(e.clientX, e.clientY);
                    updateDragSound(wheel, e.clientX, e.clientY);
                } catch (_) { /* ignore */ }
            });
            lastMove = null;

            applySelection(e.clientX, e.clientY);
        };

        const onPointerMove = (e) => {
            if (activePointerId === null || e.pointerId !== activePointerId) return;
            e.preventDefault();
            applySelection(e.clientX, e.clientY);
        };

        const endPointer = (e) => {
            if (activePointerId === null || e.pointerId !== activePointerId) return;
            e.preventDefault();
            try { pickerArea.releasePointerCapture(activePointerId); } catch (_) { /* ignore */ }
            activePointerId = null;
            lastMove = null;
            try {
                if (Audio && typeof Audio.colorDragStop === 'function') Audio.colorDragStop();
            } catch (_) { /* ignore */ }
        };

        pickerArea.addEventListener('pointerdown', onPointerDown);
        pickerArea.addEventListener('pointermove', onPointerMove);
        pickerArea.addEventListener('pointerup', endPointer);
        pickerArea.addEventListener('pointercancel', endPointer);

        // Return cleanup function
        return function cleanup() {
            try { resizeObserver.disconnect(); } catch (_) { /* ignore */ }
            pickerArea.removeEventListener('pointerdown', onPointerDown);
            pickerArea.removeEventListener('pointermove', onPointerMove);
            pickerArea.removeEventListener('pointerup', endPointer);
            pickerArea.removeEventListener('pointercancel', endPointer);
            try {
                if (Audio && typeof Audio.colorDragStop === 'function') Audio.colorDragStop();
            } catch (_) { /* ignore */ }
        };
    },

    unmount: function() {
        // No-op - cleanup handled by mount return function
    }
};
