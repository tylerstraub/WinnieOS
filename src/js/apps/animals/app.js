/**
 * Animals (stub)
 */

export default {
    id: 'animals',
    title: 'Animals',
    iconEmoji: '🦁',
    sortOrder: 25,

    mount: function(ctx) {
        const root = ctx && ctx.root;
        if (!root) return;
        root.className = 'wos-app-placeholder';
        root.innerHTML = `
            <div class="wos-app-placeholder-title">Animals</div>
            <div class="wos-app-placeholder-text">Animal sounds and matching will live here.</div>
        `;
    },

    unmount: function() {
        // no-op for stub
    }
};


