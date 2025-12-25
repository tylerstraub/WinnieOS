/**
 * Bubbles (stub)
 */

export default {
    id: 'bubbles',
    title: 'Bubbles',
    iconEmoji: '🫧',
    sortOrder: 20,

    mount: function(ctx) {
        const root = ctx && ctx.root;
        if (!root) return;
        root.className = 'wos-app-placeholder';
        root.innerHTML = `
            <div class="wos-app-placeholder-title">Bubbles</div>
            <div class="wos-app-placeholder-text">Pop pop pop!</div>
        `;
    },

    unmount: function() {
        // no-op for stub
    }
};


