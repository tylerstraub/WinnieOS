// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const policy = JSON.parse(readFileSync(resolve('deploy/chromium-kiosk-policy.json'), 'utf8'));
const bindings = readFileSync(resolve('deploy/winnieos-shortcuts.conf'), 'utf8')
    .split('\n').filter(line => line.startsWith('bindsym '))
    .map(line => line.split(/\s+/)[2]);

describe('kiosk deployment guardrails', () => {
    it('denies arbitrary navigation while allowing the kiosk and existing Space app', () => {
        expect(policy.URLBlocklist).toContain('*');
        expect(policy.URLAllowlist).toContain('http://.localhost:3000');
        expect(policy.URLAllowlist).toContain('https://.tylerstraub.github.io/floor-zero/');
        expect(policy.URLAllowlist).not.toContain('*');
    });

    it('disables alternate profiles, developer tools, file pickers, and downloads', () => {
        expect(policy.BrowserGuestModeEnabled).toBe(false);
        expect(policy.BrowserAddPersonEnabled).toBe(false);
        expect(policy.IncognitoModeAvailability).toBe(1);
        expect(policy.DeveloperToolsAvailability).toBe(2);
        expect(policy.AllowFileSelectionDialogs).toBe(false);
        expect(policy.DownloadRestrictions).toBe(3);
    });

    it('does not override the separately managed local microphone policy', () => {
        expect(policy).not.toHaveProperty('AudioCaptureAllowed');
        expect(policy).not.toHaveProperty('AudioCaptureAllowedUrls');
    });

    it.each(['Control+n', 'Control+Shift+n', 'Control+t', 'Control+l', 'Control+k',
        'Mod1+d', 'Mod1+f', 'Mod1+e', 'F6', 'F10', 'F11', 'F12', 'Shift+F10',
        'Control+Shift+i', 'Control+Shift+j', 'Shift+Escape', 'Mod1+F4'])
    ('intercepts browser command %s before it reaches the page', key => {
        expect(bindings).toContain(key);
    });

    it('has no duplicate bindings', () => {
        expect(new Set(bindings).size).toBe(bindings.length);
    });

    it.each(['Control+a', 'Control+c', 'Control+v', 'Control+x', 'Control+z',
        'Control+y', 'Control+Left', 'Control+Right', 'Control+BackSpace'])
    ('preserves ordinary editing command %s', key => {
        expect(bindings).not.toContain(key);
    });
});
