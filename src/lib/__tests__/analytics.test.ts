import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackEvent, EVENTS, type EventName } from '../analytics';

describe('EVENTS constants', () => {
  it('exports exactly 13 event names', () => {
    expect(Object.keys(EVENTS)).toHaveLength(13);
  });

  it.each([
    ['STEP_COMPLETE', 'step_complete'],
    ['WIZARD_COMPLETE', 'wizard_complete'],
    ['PAYWALL_VIEW', 'paywall_view'],
    ['PAYWALL_CLICK', 'paywall_click'],
    ['PURCHASE_COMPLETE', 'purchase_complete'],
    ['ACTIVATE_SUCCESS', 'activate_success'],
    ['ACTIVATE_FAIL', 'activate_fail'],
    ['COPY_RESULT', 'copy_result'],
    ['SAVE_RECIPE', 'save_recipe'],
    ['EXPORT_JSON', 'export_json'],
    ['IMPORT_JSON', 'import_json'],
    ['RESUME_RECIPE', 'resume_recipe'],
    ['NEW_RECIPE', 'new_recipe'],
  ] as const)('EVENTS.%s === "%s"', (key, value) => {
    expect(EVENTS[key as keyof typeof EVENTS]).toBe(value);
  });

  it('values are assignable to EventName type', () => {
    // Type-level check — if this compiles, the type works
    const name: EventName = EVENTS.STEP_COMPLETE;
    expect(name).toBe('step_complete');
  });
});

describe('trackEvent', () => {
  let originalUmami: typeof window.umami;

  beforeEach(() => {
    originalUmami = window.umami;
  });

  afterEach(() => {
    window.umami = originalUmami;
  });

  it('calls window.umami.track when umami is loaded', () => {
    const mockTrack = vi.fn();
    window.umami = { track: mockTrack };

    trackEvent('test_event');

    expect(mockTrack).toHaveBeenCalledWith('test_event', undefined);
  });

  it('passes event data to umami.track', () => {
    const mockTrack = vi.fn();
    window.umami = { track: mockTrack };

    trackEvent('test_event', { step: '2', recipe: 'cookies' });

    expect(mockTrack).toHaveBeenCalledWith('test_event', {
      step: '2',
      recipe: 'cookies',
    });
  });

  it('does not throw when window.umami is undefined', () => {
    window.umami = undefined;

    expect(() => trackEvent('test_event')).not.toThrow();
  });

  it('does not throw when window.umami is not set at all', () => {
    delete (window as unknown as Record<string, unknown>).umami;

    expect(() => trackEvent('test_event', { key: 'val' })).not.toThrow();
  });

  it('silently fails in server context (no window)', async () => {
    // Simulate server context by temporarily hiding window
    const originalWindow = globalThis.window;
    // @ts-expect-error — intentionally deleting window to simulate SSR
    delete globalThis.window;

    try {
      expect(() => trackEvent('test_event')).not.toThrow();
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
