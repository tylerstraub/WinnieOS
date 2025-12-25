/**
 * Piano (stub)
 */

export default {
    id: 'piano',
    title: 'Piano',
    iconEmoji: '🎹',
    sortOrder: 50,

    mount: function(ctx) {
        const root = ctx && ctx.root;
        if (!root) return;
        root.className = 'wos-app-placeholder';
        root.innerHTML = `
            <div class="wos-app-placeholder-title">Piano</div>
            <div class="wos-app-placeholder-text">Tap keys to make music.</div>
        `;
    },

    unmount: function() {
        // no-op for stub
    }
};


