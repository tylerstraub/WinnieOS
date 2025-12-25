/**
 * Story Time (stub)
 */

export default {
    id: 'story',
    title: 'Story Time',
    iconEmoji: '📖',
    sortOrder: 20,

    mount: function(ctx) {
        const root = ctx && ctx.root;
        if (!root) return;
        root.className = 'wos-app-placeholder';
        root.innerHTML = `
            <div class="wos-app-placeholder-title">Story Time</div>
            <div class="wos-app-placeholder-text">Soon we’ll read and play through stories here.</div>
        `;
    },

    unmount: function() {
        // no-op for stub
    }
};


