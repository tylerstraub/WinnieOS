/**
 * Garden (stub)
 */

export default {
    id: 'garden',
    title: 'Garden',
    iconEmoji: '🌻',
    sortOrder: 60,

    mount: function(ctx) {
        const root = ctx && ctx.root;
        if (!root) return;
        root.className = 'wos-app-placeholder';
        root.innerHTML = `
            <div class="wos-app-placeholder-title">Garden</div>
            <div class="wos-app-placeholder-text">Plant and grow little flowers.</div>
        `;
    },

    unmount: function() {
        // no-op for stub
    }
};


