/**
 * Colors (stub)
 */

export default {
    id: 'colors',
    title: 'Colors',
    iconEmoji: '🌈',
    sortOrder: 30,

    mount: function(ctx) {
        const root = ctx && ctx.root;
        if (!root) return;
        root.className = 'wos-app-placeholder';
        root.innerHTML = `
            <div class="wos-app-placeholder-title">Colors</div>
            <div class="wos-app-placeholder-text">Tap colors and paint the world.</div>
        `;
    },

    unmount: function() {
        // no-op for stub
    }
};


