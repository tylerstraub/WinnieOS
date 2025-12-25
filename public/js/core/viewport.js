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

        function getCanvas() {
            if (!canvas) {
                canvas = document.getElementById('winnieos-canvas');
            }
            return canvas;
        }

        function updateScale() {
            const canvasElement = getCanvas();
            if (!canvasElement) return;

            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const isReference = vw === REF_WIDTH && vh === REF_HEIGHT;
            
            if (isReference) {
                // At reference: fill viewport directly
                canvasElement.style.position = 'fixed';
                canvasElement.style.top = '0';
                canvasElement.style.left = '0';
                canvasElement.style.width = '100%';
                canvasElement.style.height = '100%';
                canvasElement.style.transform = 'none';
                canvasElement.style.margin = '0';
                canvasElement.style.padding = '0';
            } else {
                // Other resolutions: scale to fit
                canvasElement.style.position = 'relative';
                canvasElement.style.width = REF_WIDTH + 'px';
                canvasElement.style.height = REF_HEIGHT + 'px';
                canvasElement.style.margin = '0';
                
                const scale = Math.min(vw / REF_WIDTH, vh / REF_HEIGHT);
                canvasElement.style.transform = `scale(${scale})`;
            }
        }

        return {
            init: function() {
                if (!getCanvas()) return;
                updateScale();
                window.addEventListener('resize', updateScale);
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

