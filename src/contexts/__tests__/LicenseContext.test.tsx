import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { LicenseProvider, useLicense } from '../LicenseContext.js';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mock the LemonSqueezy API module
// ---------------------------------------------------------------------------

const mockActivate = vi.fn();

vi.mock('../../services/lemonsqueezy.js', () => ({
  activateLicense: (...args: unknown[]) => mockActivate(...args),
  _env: {
    get storeId() { return '12345'; },
    get productId() { return '67890'; },
  },
}));

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'recipecalc_license';

let store: Record<string, string> = {};

const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
};

beforeEach(() => {
  store = {};
  mockActivate.mockReset();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });
  mockLocalStorage.getItem.mockImplementation((key: string) => store[key] ?? null);
  mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
    store[key] = value;
  });
  mockLocalStorage.removeItem.mockImplementation((key: string) => {
    delete store[key];
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: ReactNode }) {
  return <LicenseProvider>{children}</LicenseProvider>;
}

function makeLicenseJSON(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    key: 'test-key-123',
    instanceId: 'instance-abc',
    activatedAt: '2026-03-30T12:00:00.000Z',
    storeId: '12345',
    productId: '67890',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LicenseContext', () => {
  // ---- Initial state ----

  it('returns isUnlocked=false when localStorage is empty', () => {
    const { result } = renderHook(() => useLicense(), { wrapper });

    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.license).toBeNull();
  });

  it('returns isUnlocked=true when valid license exists in localStorage', () => {
    store[STORAGE_KEY] = makeLicenseJSON();

    const { result } = renderHook(() => useLicense(), { wrapper });

    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.license).not.toBeNull();
    expect(result.current.license!.key).toBe('test-key-123');
    expect(result.current.license!.instanceId).toBe('instance-abc');
    expect(result.current.license!.activatedAt).toBe('2026-03-30T12:00:00.000Z');
  });

  it('clears corrupt license data and returns isUnlocked=false', () => {
    store[STORAGE_KEY] = '{not valid json!!!';

    const { result } = renderHook(() => useLicense(), { wrapper });

    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.license).toBeNull();
    expect(store[STORAGE_KEY]).toBeUndefined();
  });

  it('clears license data missing required fields', () => {
    store[STORAGE_KEY] = JSON.stringify({ key: 'x' }); // missing instanceId, etc.

    const { result } = renderHook(() => useLicense(), { wrapper });

    expect(result.current.isUnlocked).toBe(false);
    expect(store[STORAGE_KEY]).toBeUndefined();
  });

  it('clears license data with empty key', () => {
    store[STORAGE_KEY] = makeLicenseJSON({ key: '' });

    const { result } = renderHook(() => useLicense(), { wrapper });

    expect(result.current.isUnlocked).toBe(false);
    expect(store[STORAGE_KEY]).toBeUndefined();
  });

  // ---- activate ----

  it('activate() calls API and writes to localStorage on success', async () => {
    mockActivate.mockResolvedValueOnce({
      ok: true,
      instanceId: 'new-instance',
      activatedAt: '2026-03-30T14:00:00.000Z',
    });

    const { result } = renderHook(() => useLicense(), { wrapper });

    expect(result.current.isUnlocked).toBe(false);

    let activateResult: unknown;
    await act(async () => {
      activateResult = await result.current.activate('new-key');
    });

    expect(mockActivate).toHaveBeenCalledWith('new-key');
    expect(activateResult).toEqual({
      ok: true,
      instanceId: 'new-instance',
      activatedAt: '2026-03-30T14:00:00.000Z',
    });
    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.license!.key).toBe('new-key');
    expect(result.current.license!.instanceId).toBe('new-instance');

    // Verify localStorage was written
    const stored = JSON.parse(store[STORAGE_KEY]);
    expect(stored.key).toBe('new-key');
    expect(stored.instanceId).toBe('new-instance');
    expect(stored.storeId).toBe('12345');
    expect(stored.productId).toBe('67890');
  });

  it('activate() does not update state on API failure', async () => {
    mockActivate.mockResolvedValueOnce({
      ok: false,
      reason: 'invalid',
    });

    const { result } = renderHook(() => useLicense(), { wrapper });

    let activateResult: unknown;
    await act(async () => {
      activateResult = await result.current.activate('bad-key');
    });

    expect(activateResult).toEqual({ ok: false, reason: 'invalid' });
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.license).toBeNull();
    expect(store[STORAGE_KEY]).toBeUndefined();
  });

  it('activate() returns all error types from API', async () => {
    const reasons = ['invalid', 'wrong_product', 'limit_reached', 'network'] as const;

    for (const reason of reasons) {
      mockActivate.mockResolvedValueOnce({ ok: false, reason });

      const { result } = renderHook(() => useLicense(), { wrapper });

      let activateResult: unknown;
      await act(async () => {
        activateResult = await result.current.activate('key');
      });

      expect(activateResult).toEqual({ ok: false, reason });
    }
  });

  // ---- deactivate ----

  it('deactivate() clears localStorage and resets state', () => {
    store[STORAGE_KEY] = makeLicenseJSON();

    const { result } = renderHook(() => useLicense(), { wrapper });

    expect(result.current.isUnlocked).toBe(true);

    act(() => {
      result.current.deactivate();
    });

    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.license).toBeNull();
    expect(store[STORAGE_KEY]).toBeUndefined();
  });

  // ---- Persistence roundtrip ----

  it('activate → remount → license persists (page refresh simulation)', async () => {
    mockActivate.mockResolvedValueOnce({
      ok: true,
      instanceId: 'persist-instance',
      activatedAt: '2026-03-30T15:00:00.000Z',
    });

    // First mount: activate
    const { result: r1 } = renderHook(() => useLicense(), { wrapper });

    await act(async () => {
      await r1.current.activate('persist-key');
    });

    expect(r1.current.isUnlocked).toBe(true);

    // Second mount: should read from localStorage
    const { result: r2 } = renderHook(() => useLicense(), { wrapper });

    expect(r2.current.isUnlocked).toBe(true);
    expect(r2.current.license!.key).toBe('persist-key');
    expect(r2.current.license!.instanceId).toBe('persist-instance');
  });

  // ---- Error boundary ----

  it('throws when useLicense is used outside LicenseProvider', () => {
    // Suppress console.error from the expected React error
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useLicense());
    }).toThrow('useLicense must be used within a LicenseProvider');

    consoleError.mockRestore();
  });

  // ---- Graceful degradation ----

  it('handles localStorage being unavailable during activate', async () => {
    mockLocalStorage.setItem.mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    mockActivate.mockResolvedValueOnce({
      ok: true,
      instanceId: 'no-storage-instance',
      activatedAt: '2026-03-30T16:00:00.000Z',
    });

    const { result } = renderHook(() => useLicense(), { wrapper });

    // activate should not throw — state updates even if localStorage fails
    await act(async () => {
      await result.current.activate('key');
    });

    // In-memory state should still be updated
    expect(result.current.isUnlocked).toBe(true);
  });
});
