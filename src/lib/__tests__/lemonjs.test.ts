import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock analytics before importing lemonjs
const mockTrackEvent = vi.fn();
vi.mock('../analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  EVENTS: {
    PURCHASE_COMPLETE: 'purchase_complete',
  },
}));

import {
  setupLemonSqueezy,
  openCheckout,
  _reset,
} from '../lemonjs.js';

// ---------------------------------------------------------------------------
// Mock LemonSqueezy global
// ---------------------------------------------------------------------------

const mockSetup = vi.fn();
const mockUrlOpen = vi.fn();

function installLemonSqueezyGlobal() {
  (window as unknown as Record<string, unknown>).LemonSqueezy = {
    Setup: mockSetup,
    Url: { Open: mockUrlOpen },
  };
}

function removeLemonSqueezyGlobal() {
  delete (window as unknown as Record<string, unknown>).LemonSqueezy;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  _reset();
  mockSetup.mockReset();
  mockUrlOpen.mockReset();
  mockTrackEvent.mockClear();
  installLemonSqueezyGlobal();
});

afterEach(() => {
  removeLemonSqueezyGlobal();
  delete (window as unknown as Record<string, unknown>).createLemonSqueezy;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('setupLemonSqueezy', () => {
  it('calls LemonSqueezy.Setup with an eventHandler', () => {
    const onActivate = vi.fn();
    setupLemonSqueezy(onActivate);

    expect(mockSetup).toHaveBeenCalledTimes(1);
    expect(mockSetup).toHaveBeenCalledWith({
      eventHandler: expect.any(Function),
    });
  });

  it('only calls Setup once (idempotent)', () => {
    const onActivate = vi.fn();
    setupLemonSqueezy(onActivate);
    setupLemonSqueezy(onActivate);
    setupLemonSqueezy(onActivate);

    expect(mockSetup).toHaveBeenCalledTimes(1);
  });

  it('updates the onActivate callback even when already setup', () => {
    const onActivate1 = vi.fn();
    const onActivate2 = vi.fn();

    setupLemonSqueezy(onActivate1);

    // Extract the event handler that was registered
    const eventHandler = mockSetup.mock.calls[0][0].eventHandler;

    // Update callback
    setupLemonSqueezy(onActivate2);

    // Simulate Checkout.Success — should call the LATEST callback
    eventHandler({
      event: 'Checkout.Success',
      data: {
        order: { first_order_item: { license_key: 'key-abc' } },
      },
    });

    expect(onActivate1).not.toHaveBeenCalled();
    expect(onActivate2).toHaveBeenCalledWith('key-abc');
  });

  it('calls createLemonSqueezy if available on window', () => {
    const createFn = vi.fn();
    (window as unknown as Record<string, unknown>).createLemonSqueezy = createFn;

    setupLemonSqueezy(vi.fn());

    expect(createFn).toHaveBeenCalledTimes(1);
  });

  it('does not throw when LemonSqueezy global is missing', () => {
    removeLemonSqueezyGlobal();

    expect(() => setupLemonSqueezy(vi.fn())).not.toThrow();
    expect(mockSetup).not.toHaveBeenCalled();
  });
});

describe('eventHandler — Checkout.Success', () => {
  it('extracts license_key and calls onActivate', () => {
    const onActivate = vi.fn();
    setupLemonSqueezy(onActivate);

    const eventHandler = mockSetup.mock.calls[0][0].eventHandler;

    eventHandler({
      event: 'Checkout.Success',
      data: {
        order: { first_order_item: { license_key: 'LICENSE-123-XYZ' } },
      },
    });

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith('LICENSE-123-XYZ');
  });

  it('fires PURCHASE_COMPLETE event on Checkout.Success', () => {
    const onActivate = vi.fn();
    setupLemonSqueezy(onActivate);

    const eventHandler = mockSetup.mock.calls[0][0].eventHandler;

    eventHandler({
      event: 'Checkout.Success',
      data: {
        order: { first_order_item: { license_key: 'KEY-123' } },
      },
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('purchase_complete', { channel: 'website' });
  });

  it('does not fire PURCHASE_COMPLETE when license_key is empty', () => {
    const onActivate = vi.fn();
    setupLemonSqueezy(onActivate);

    const eventHandler = mockSetup.mock.calls[0][0].eventHandler;

    eventHandler({
      event: 'Checkout.Success',
      data: { order: { first_order_item: { license_key: '' } } },
    });

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('ignores non-Checkout.Success events', () => {
    const onActivate = vi.fn();
    setupLemonSqueezy(onActivate);

    const eventHandler = mockSetup.mock.calls[0][0].eventHandler;

    eventHandler({ event: 'Checkout.ViewCart', data: {} as never });
    eventHandler({ event: 'PaymentMethodUpdate.Updated', data: {} as never });

    expect(onActivate).not.toHaveBeenCalled();
  });

  it('does not call onActivate when license_key is missing', () => {
    const onActivate = vi.fn();
    setupLemonSqueezy(onActivate);

    const eventHandler = mockSetup.mock.calls[0][0].eventHandler;

    eventHandler({
      event: 'Checkout.Success',
      data: { order: { first_order_item: { license_key: '' } } },
    });

    expect(onActivate).not.toHaveBeenCalled();
  });

  it('does not call onActivate when data structure is unexpected', () => {
    const onActivate = vi.fn();
    setupLemonSqueezy(onActivate);

    const eventHandler = mockSetup.mock.calls[0][0].eventHandler;

    // Missing nested properties
    eventHandler({
      event: 'Checkout.Success',
      data: null as never,
    });

    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe('openCheckout', () => {
  it('calls LemonSqueezy.Url.Open with the given URL', () => {
    const url = 'https://recipecalc.lemonsqueezy.com/buy/abc123';
    openCheckout(url);

    expect(mockUrlOpen).toHaveBeenCalledTimes(1);
    expect(mockUrlOpen).toHaveBeenCalledWith(url);
  });

  it('throws when LemonSqueezy global is not loaded', () => {
    removeLemonSqueezyGlobal();

    expect(() => openCheckout('https://example.com/buy/x')).toThrow(
      'LemonSqueezy is not loaded',
    );
  });
});

describe('_reset', () => {
  it('allows re-setup after reset', () => {
    const onActivate = vi.fn();
    setupLemonSqueezy(onActivate);

    expect(mockSetup).toHaveBeenCalledTimes(1);

    _reset();
    setupLemonSqueezy(onActivate);

    expect(mockSetup).toHaveBeenCalledTimes(2);
  });
});
