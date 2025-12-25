import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Storage } from '../../utils/storage.js';

const STORAGE_KEY = 'display.reference';

function mockFetchConfig(ref) {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    async json() {
      return { display: { reference: ref } };
    }
  }));
}

async function flushAsync() {
  // Let pending microtasks and any short timers run.
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

describe('Core init (config-driven default reference resolution)', () => {
  let originalFetch;

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.body.innerHTML = '<div id="winnieos-canvas"></div>';

    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('applies display.reference from config when no persisted reference exists', async () => {
    // Test with a non-default config value to verify config is applied
    mockFetchConfig({ width: 1024, height: 768 });

    const { Display } = await import('../display.js');
    const setSpy = vi.spyOn(Display, 'setReferenceSize');

    // Importing core index triggers init immediately in jsdom (document is already ready).
    await import('../index.js');
    await flushAsync();

    // Should apply non-persistent default from config.
    expect(setSpy).toHaveBeenCalledWith({ width: 1024, height: 768, persist: false });
  });

  it('does NOT override persisted localStorage reference with config default', async () => {
    // Use Storage utility to set persisted reference (consistent with implementation)
    // Use a different resolution than the config to verify persisted value takes precedence
    Storage.set(STORAGE_KEY, { width: 1920, height: 1080 });
    mockFetchConfig({ width: 1024, height: 768 });

    const { Display } = await import('../display.js');
    const setSpy = vi.spyOn(Display, 'setReferenceSize');

    await import('../index.js');
    await flushAsync();

    // Config default should be ignored if user has a persisted preference.
    expect(setSpy).not.toHaveBeenCalledWith({ width: 1024, height: 768, persist: false });
  });
});


