/**
 * Blocks (stub)
 */

export default {
    id: 'blocks',
    title: 'Blocks',
    iconEmoji: '🧱',
    sortOrder: 15,

    mount: function(ctx) {
        const root = ctx && ctx.root;
        if (!root) return;
        root.className = 'wos-app-placeholder';
        root.innerHTML = `
            <div class="wos-app-placeholder-title">Blocks</div>
            <div class="wos-app-placeholder-text">A building blocks game will live here.</div>
        `;
    },

    unmount: function() {
        // no-op for stub
    }
};


