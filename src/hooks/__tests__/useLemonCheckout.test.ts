import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — must be set up BEFORE importing the module under test
// ---------------------------------------------------------------------------

const mockSetupLemonSqueezy = vi.fn();
const mockOpenCheckout = vi.fn();

vi.mock('../../lib/lemonjs.js', () => ({
  setupLemonSqueezy: (...args: unknown[]) => mockSetupLemonSqueezy(...args),
  openCheckout: (...args: unknown[]) => mockOpenCheckout(...args),
}));

const mockActivate = vi.fn();

vi.mock('../../contexts/LicenseContext.js', () => ({
  useLicense: () => ({
    isUnlocked: false,
    license: null,
    activate: mockActivate,
    deactivate: vi.fn(),
  }),
  LicenseProvider: ({ children }: { children: ReactNode }) => children,
}));

const mockTrackEvent = vi.fn();
vi.mock('../../lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  EVENTS: {
    ACTIVATE_SUCCESS: 'activate_success',
    ACTIVATE_FAIL: 'activate_fail',
  },
}));

// Now import the hook (mocks are already in place)
import { useLemonCheckout } from '../useLemonCheckout.js';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockSetupLemonSqueezy.mockReset();
  mockOpenCheckout.mockReset();
  mockActivate.mockReset();
  mockTrackEvent.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLemonCheckout', () => {
  it('calls setupLemonSqueezy on mount with an activation callback', () => {
    renderHook(() => useLemonCheckout());

    expect(mockSetupLemonSqueezy).toHaveBeenCalledTimes(1);
    expect(mockSetupLemonSqueezy).toHaveBeenCalledWith(expect.any(Function));
  });

  it('activation callback calls LicenseContext.activate with the license key', async () => {
    mockActivate.mockResolvedValue({ ok: true, instanceId: 'id', activatedAt: '2026-01-01T00:00:00Z' });
    renderHook(() => useLemonCheckout());

    // Extract the onActivate callback passed to setupLemonSqueezy
    const onActivate = mockSetupLemonSqueezy.mock.calls[0][0];

    // Simulate the Checkout.Success → key extraction flow
    await onActivate('LICENSE-KEY-FROM-CHECKOUT');

    expect(mockActivate).toHaveBeenCalledTimes(1);
    expect(mockActivate).toHaveBeenCalledWith('LICENSE-KEY-FROM-CHECKOUT');
  });

  it('returns openCheckout function', () => {
    const { result } = renderHook(() => useLemonCheckout());

    expect(result.current.openCheckout).toBeInstanceOf(Function);
  });

  it('openCheckout calls lemon.js openCheckout with the given URL', () => {
    const { result } = renderHook(() => useLemonCheckout());

    act(() => {
      result.current.openCheckout('https://recipepricer.lemonsqueezy.com/buy/abc');
    });

    expect(mockOpenCheckout).toHaveBeenCalledTimes(1);
    expect(mockOpenCheckout).toHaveBeenCalledWith(
      'https://recipepricer.lemonsqueezy.com/buy/abc',
    );
  });

  it('openCheckout throws when no URL is provided and env var is empty', () => {
    const { result } = renderHook(() => useLemonCheckout());

    expect(() => {
      result.current.openCheckout();
    }).toThrow('No checkout URL provided');
  });

  it('does not re-run setupLemonSqueezy on re-render', () => {
    const { rerender } = renderHook(() => useLemonCheckout());

    rerender();
    rerender();

    // useEffect with [] deps should only fire once
    expect(mockSetupLemonSqueezy).toHaveBeenCalledTimes(1);
  });

  it('fires ACTIVATE_SUCCESS with channel "website" on successful activation', async () => {
    mockActivate.mockResolvedValue({ ok: true, instanceId: 'id', activatedAt: '2026-01-01T00:00:00Z' });
    renderHook(() => useLemonCheckout());

    const onActivate = mockSetupLemonSqueezy.mock.calls[0][0];
    await onActivate('VALID-KEY');

    expect(mockTrackEvent).toHaveBeenCalledWith('activate_success', { channel: 'website' });
  });

  it('fires ACTIVATE_FAIL with reason on failed activation', async () => {
    mockActivate.mockResolvedValue({ ok: false, reason: 'limit_reached' });
    renderHook(() => useLemonCheckout());

    const onActivate = mockSetupLemonSqueezy.mock.calls[0][0];
    await onActivate('BAD-KEY');

    expect(mockTrackEvent).toHaveBeenCalledWith('activate_fail', { reason: 'limit_reached' });
  });
});
