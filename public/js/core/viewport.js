/**
 * WinnieOS Viewport Scaling System
 * 
 * FOUNDATION PRINCIPLE:
 * - Canvas is ALWAYS 1280x800px (reference resolution)
 * - Calculate scale factor to fit viewport
 * - Apply CSS transform scale from center
 * - Maintains aspect ratio automatically
 * 
 * SCALING LOGIC:
 * 1. Calculate scale factors for width and height
 * 2. Use minimum scale to ensure canvas fits entirely
 * 3. Canvas scales proportionally, maintains 16:10 aspect
 * 4. At reference resolution (1280x800): scale = 1.0
 * 5. On larger screens: scales up proportionally
 * 6. On smaller screens: scales down proportionally
 * 7. On different aspect ratios: letterboxes/pillarboxes
 */

(function() {
    'use strict';

    const WinnieOS = window.WinnieOS = window.WinnieOS || {};

    WinnieOS.Viewport = (function() {
        // Reference resolution constants
        const REF_WIDTH = 1280;
        const REF_HEIGHT = 800;
        const REF_ASPECT = REF_WIDTH / REF_HEIGHT; // 1.6 (16:10)
        
        // Canvas element - will be set during init() after DOM is ready
        let canvas = null;

        /**
         * Gets the canvas element, ensuring it exists
         * @returns {HTMLElement|null} The canvas element or null if not found
         */
        function getCanvas() {
            if (!canvas) {
                canvas = document.getElementById('winnieos-canvas');
            }
            return canvas;
        }

        /**
         * Updates the canvas scale to fit the current viewport
         * Canvas always remains 1280x800px, scaled via CSS transform
         */
        function updateScale() {
            const canvasElement = getCanvas();
            if (!canvasElement) {
                console.warn('WinnieOS.Viewport: Canvas element not found');
                return;
            }

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Check if we're at or very close to reference resolution
            // Use small tolerance (2px) to account for browser chrome/scrollbars
            const isReferenceResolution = Math.abs(viewportWidth - REF_WIDTH) <= 2 && 
                                         Math.abs(viewportHeight - REF_HEIGHT) <= 2;
            
            if (isReferenceResolution) {
                // At reference resolution: fill viewport directly, no transform needed
                canvasElement.style.transform = 'none';
                canvasElement.style.position = 'fixed';
                canvasElement.style.top = '0';
                canvasElement.style.left = '0';
                canvasElement.style.width = '100vw';
                canvasElement.style.height = '100vh';
                canvasElement.style.margin = '0';
                document.body.style.display = 'block';
                document.body.style.justifyContent = 'normal';
                document.body.style.alignItems = 'normal';
                canvasElement.dataset.scale = '1.0000';
            } else {
                // For other resolutions: use flexbox centering and scale transform
                document.body.style.display = 'flex';
                document.body.style.justifyContent = 'center';
                document.body.style.alignItems = 'center';
                
                // Reset canvas to reference size (remove inline styles to let CSS take over)
                canvasElement.style.position = '';
                canvasElement.style.width = '';
                canvasElement.style.height = '';
                canvasElement.style.top = '';
                canvasElement.style.left = '';
                canvasElement.style.margin = '';
                
                // Calculate scale factors for both dimensions
                const scaleX = viewportWidth / REF_WIDTH;
                const scaleY = viewportHeight / REF_HEIGHT;
                
                // Use minimum scale to ensure canvas fits entirely in viewport
                // This maintains aspect ratio and prevents overflow
                const scale = Math.min(scaleX, scaleY);
                
                // Apply scale transform
                // Transform origin is center (set in CSS), so canvas scales from center
                canvasElement.style.transform = `scale(${scale})`;
                
                // Store scale value for potential use by other modules
                canvasElement.dataset.scale = scale.toFixed(4);
            }
        }

        // Public API
        return {
            /**
             * Initialize viewport scaling system
             * Sets up initial scale and resize listener
             */
            init: function() {
                // Ensure canvas element exists before proceeding
                if (!getCanvas()) {
                    console.error('WinnieOS.Viewport: Cannot initialize - canvas element not found');
                    return;
                }

                updateScale();
                window.addEventListener('resize', updateScale);
                
                // Also listen for orientation changes on mobile devices
                window.addEventListener('orientationchange', function() {
                    // Small delay to ensure viewport has updated
                    setTimeout(updateScale, 100);
                });
            },
            
            /**
             * Get current scale factor
             * @returns {number} Current scale factor (1.0 = reference resolution)
             */
            getScale: function() {
                const canvasElement = getCanvas();
                if (!canvasElement) {
                    return 1;
                }
                return parseFloat(canvasElement.dataset.scale || '1');
            },
            
            /**
             * Get reference resolution dimensions
             * @returns {Object} Object with width and height
             */
            getReferenceSize: function() {
                return {
                    width: REF_WIDTH,
                    height: REF_HEIGHT,
                    aspect: REF_ASPECT
                };
            }
        };
    })();
})();

