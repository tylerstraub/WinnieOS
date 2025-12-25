/**
 * Shapes (stub)
 */

export default {
    id: 'shapes',
    title: 'Shapes',
    iconEmoji: '🔺',
    sortOrder: 40,

    mount: function(ctx) {
        const root = ctx && ctx.root;
        if (!root) return;
        root.className = 'wos-app-placeholder';
        root.innerHTML = `
            <div class="wos-app-placeholder-title">Shapes</div>
            <div class="wos-app-placeholder-text">Match the shapes.</div>
        `;
    },

    unmount: function() {
        // no-op for stub
    }
};


