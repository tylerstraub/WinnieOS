/**
 * DesktopScreen
 * Scrollable, touch-first list of registered apps.
 */

export const DesktopScreen = (function() {
    let rootEl = null;

    function renderAppTile(app, nav) {
        const btn = document.createElement('button');
        btn.className = 'wos-app-tile';
        btn.type = 'button';
        btn.setAttribute('aria-label', app.title);
        btn.addEventListener('click', () => nav.openApp(app.id));

        if (app.iconSrc) {
            const img = document.createElement('img');
            img.className = 'wos-app-icon';
            img.alt = '';
            img.src = app.iconSrc;
            btn.appendChild(img);
        } else {
            const emoji = document.createElement('div');
            emoji.className = 'wos-app-emoji';
            emoji.textContent = app.iconEmoji || '⭐';
            btn.appendChild(emoji);
        }

        const title = document.createElement('div');
        title.className = 'wos-app-title';
        title.textContent = app.title;
        btn.appendChild(title);
        return btn;
    }

    return {
        mount: function(ctx) {
            const root = ctx && ctx.root;
            const nav = ctx && ctx.nav;
            const apps = ctx && ctx.apps;
            if (!root || !nav || !apps) return;

            const list = apps.list();

            rootEl = document.createElement('div');
            rootEl.className = 'wos-desktop';

            const header = document.createElement('div');
            header.className = 'wos-desktop-header';
            header.innerHTML = `
                <div class="wos-desktop-title">Winnie’s Desktop</div>
                <div class="wos-desktop-subtitle">Tap an app to play</div>
            `;

            const grid = document.createElement('div');
            grid.className = 'wos-app-grid';

            list.forEach((app) => {
                grid.appendChild(renderAppTile(app, nav));
            });

            rootEl.appendChild(header);
            rootEl.appendChild(grid);
            root.replaceChildren(rootEl);
        },

        unmount: function() {
            if (rootEl && rootEl.parentNode) {
                try { rootEl.parentNode.removeChild(rootEl); } catch (_) { /* ignore */ }
            }
            rootEl = null;
        }
    };
})();


