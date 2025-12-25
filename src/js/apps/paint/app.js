/**
 * Paint (stub)
 */

export default {
    id: 'paint',
    title: 'Paint',
    iconEmoji: '🎨',
    sortOrder: 10,

    mount: function(ctx) {
        const root = ctx && ctx.root;
        if (!root) return;
        root.className = 'wos-app-placeholder';
        root.innerHTML = `
            <div class="wos-app-placeholder-title">Paint</div>
            <div class="wos-app-placeholder-text">A simple drawing app will live here.</div>
        `;
    },

    unmount: function() {
        // no-op for stub
    }
};


