/**
 * Music (stub)
 */

export default {
    id: 'music',
    title: 'Music',
    iconEmoji: '🎵',
    sortOrder: 30,

    mount: function(ctx) {
        const root = ctx && ctx.root;
        if (!root) return;
        root.className = 'wos-app-placeholder';
        root.innerHTML = `
            <div class="wos-app-placeholder-title">Music</div>
            <div class="wos-app-placeholder-text">This will become a simple music player with big buttons.</div>
        `;
    },

    unmount: function() {
        // no-op for stub
    }
};


