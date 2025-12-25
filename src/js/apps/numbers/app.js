/**
 * Numbers (stub)
 */

export default {
    id: 'numbers',
    title: 'Numbers',
    iconEmoji: '🔢',
    sortOrder: 35,

    mount: function(ctx) {
        const root = ctx && ctx.root;
        if (!root) return;
        root.className = 'wos-app-placeholder';
        root.innerHTML = `
            <div class="wos-app-placeholder-title">Numbers</div>
            <div class="wos-app-placeholder-text">Count and tap!</div>
        `;
    },

    unmount: function() {
        // no-op for stub
    }
};


