/**
 * Dance (stub)
 */

export default {
    id: 'dance',
    title: 'Dance',
    iconEmoji: '💃',
    sortOrder: 55,

    mount: function(ctx) {
        const root = ctx && ctx.root;
        if (!root) return;
        root.className = 'wos-app-placeholder';
        root.innerHTML = `
            <div class="wos-app-placeholder-title">Dance</div>
            <div class="wos-app-placeholder-text">A dance party will live here.</div>
        `;
    },

    unmount: function() {
        // no-op for stub
    }
};


