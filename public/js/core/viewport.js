/**
 * WinnieOS Viewport Scaling System
 * 
 * Simple scaling: Canvas is always 1280x800px, scaled to fit viewport.
 * At reference resolution (1280x800), canvas fills viewport directly.
 * On other resolutions, canvas scales proportionally maintaining aspect ratio.
 */

(function() {
    'use strict';

    const WinnieOS = window.WinnieOS = window.WinnieOS || {};

    WinnieOS.Viewport = (function() {
        const REF_WIDTH = 1280;
        const REF_HEIGHT = 800;
        
        let canvas = null;
        let rafId = null;

        function getCanvas() {
            if (!canvas) {
                canvas = document.getElementById('winnieos-canvas');
            }
            return canvas;
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

            const vp = getViewportSize();
            const vw = vp.width;
            const vh = vp.height;

            // Single rule everywhere: scale-to-fit while preserving aspect ratio.
            // Reference point "locks" naturally when vw=1280 and vh=800 => scale=1 and offsets=0.
            const scale = Math.min(vw / REF_WIDTH, vh / REF_HEIGHT);
            const scaledWidth = REF_WIDTH * scale;
            const scaledHeight = REF_HEIGHT * scale;

            const left = vp.offsetLeft + (vw - scaledWidth) / 2;
            const top = vp.offsetTop + (vh - scaledHeight) / 2;

            // Keep the internal coordinate system stable forever: always 1280x800.
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
                return { width: REF_WIDTH, height: REF_HEIGHT };
            }
        };
    })();
})();

