/**
 * Memory (stub)
 */

export default {
    id: 'memory',
    title: 'Memory',
    iconEmoji: '🧠',
    sortOrder: 45,

    mount: function(ctx) {
        const root = ctx && ctx.root;
        if (!root) return;
        root.className = 'wos-app-placeholder';
        root.innerHTML = `
            <div class="wos-app-placeholder-title">Memory</div>
            <div class="wos-app-placeholder-text">A simple matching game will live here.</div>
        `;
    },

    unmount: function() {
        // no-op for stub
    }
};


