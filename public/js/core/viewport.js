/**
 * WinnieOS Viewport Scaling System
 * 
 * Fits the current reference-resolution canvas into the real device viewport.
 *
 * Canonical rule:
 * - The canvas keeps a stable internal coordinate system (reference resolution).
 * - We apply a uniform scale-to-fit transform (letterbox/pillarbox as needed).
 *
 * Reference resolution source of truth:
 * - Prefer WinnieOS.Display.getReferenceSize() if available.
 * - Fallback to CSS variables --ref-width / --ref-height.
 */

(function() {
    'use strict';

    const WinnieOS = window.WinnieOS = window.WinnieOS || {};

    WinnieOS.Viewport = (function() {
        let canvas = null;
        let rafId = null;

        function getCanvas() {
            if (!canvas) {
                canvas = document.getElementById('winnieos-canvas');
            }
            return canvas;
        }

        function getReferenceSize() {
            if (WinnieOS.Display && typeof WinnieOS.Display.getReferenceSize === 'function') {
                const ref = WinnieOS.Display.getReferenceSize();
                if (ref && Number.isFinite(ref.width) && Number.isFinite(ref.height) && ref.width > 0 && ref.height > 0) {
                    return { width: ref.width, height: ref.height };
                }
            }

            const cs = window.getComputedStyle(document.documentElement);
            const w = parseInt(cs.getPropertyValue('--ref-width'), 10);
            const h = parseInt(cs.getPropertyValue('--ref-height'), 10);
            if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
                return { width: w, height: h };
            }

            return { width: 1280, height: 800 };
        }

        function getViewportSize() {
            // Prefer VisualViewport when available (better behavior on mobile + zoom)
            const vv = window.visualViewport;
            if (vv && typeof vv.width === 'number' && typeof vv.height === 'number') {
                return {
                    width: vv.width,
                    height: vv.height,
                    offsetLeft: vv.offsetLeft || 0,
                    offsetTop: vv.offsetTop || 0
                };
            }

            return {
                width: window.innerWidth,
                height: window.innerHeight,
                offsetLeft: 0,
                offsetTop: 0
            };
        }

        function applyScale() {
            const canvasElement = getCanvas();
            if (!canvasElement) return;

            const ref = getReferenceSize();
            const REF_WIDTH = ref.width;
            const REF_HEIGHT = ref.height;

            const vp = getViewportSize();
            const vw = vp.width;
            const vh = vp.height;

            // Single rule everywhere: scale-to-fit while preserving aspect ratio.
            // The reference "locks" naturally at scale=1 when viewport exactly matches the current reference size.
            const scale = Math.min(vw / REF_WIDTH, vh / REF_HEIGHT);
            const scaledWidth = REF_WIDTH * scale;
            const scaledHeight = REF_HEIGHT * scale;

            const left = vp.offsetLeft + (vw - scaledWidth) / 2;
            const top = vp.offsetTop + (vh - scaledHeight) / 2;

            // Keep the internal coordinate system stable: always REF_WIDTH x REF_HEIGHT (the active reference size).
            canvasElement.style.position = 'fixed';
            canvasElement.style.width = REF_WIDTH + 'px';
            canvasElement.style.height = REF_HEIGHT + 'px';
            canvasElement.style.left = left + 'px';
            canvasElement.style.top = top + 'px';
            canvasElement.style.margin = '0';
            canvasElement.style.padding = '0';
            canvasElement.style.transformOrigin = 'top left';
            canvasElement.style.transform = `scale(${scale})`;

            // Expose scale for debugging / future utilities.
            canvasElement.dataset.scale = String(scale);
            document.documentElement.style.setProperty('--viewport-scale', String(scale));
        }

        function scheduleUpdate() {
            if (rafId) return;
            rafId = window.requestAnimationFrame(function() {
                rafId = null;
                applyScale();
            });
        }

        return {
            init: function() {
                if (!getCanvas()) return;

                scheduleUpdate();
                window.addEventListener('resize', scheduleUpdate);
                document.addEventListener('winnieos:displaychange', scheduleUpdate);

                // VisualViewport can change via pinch-zoom / virtual keyboard on some devices.
                if (window.visualViewport) {
                    window.visualViewport.addEventListener('resize', scheduleUpdate);
                    window.visualViewport.addEventListener('scroll', scheduleUpdate);
                }
            },
            
            getScale: function() {
                const el = getCanvas();
                return el ? parseFloat(el.dataset.scale || '1') : 1;
            },
            
            getReferenceSize: function() {
                return getReferenceSize();
            },

            refresh: function() {
                scheduleUpdate();
            }
        };
    })();
})();

