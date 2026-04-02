import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { LicenseProvider, useLicense, _resetSessionCache } from '../LicenseContext.js';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HINT_KEY = 'recipepricer_license_hint';
const OLD_KEY = 'recipecalc_license';

function wrapper({ children }: { children: ReactNode }) {
  return <LicenseProvider>{children}</LicenseProvider>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LicenseContext', () => {
  // ---- 1. Session check on mount ----

  it('calls /api/session on mount and unlocks when server says unlocked', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ unlocked: true, keyPrefix: 'abc12345' })),
    );

    const { result } = renderHook(() => useLicense(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.license).toEqual({ keyPrefix: 'abc12345' });
    expect(fetch).toHaveBeenCalledWith('/api/session');
  });

  it('stays locked when server says not unlocked', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ unlocked: false })),
    );

    const { result } = renderHook(() => useLicense(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.license).toBeNull();
  });

  // ---- 2. Hint-based initial state ----

  it('starts as isUnlocked=true when hint exists in localStorage before server responds', async () => {
    // Set up hint before rendering
    localStorage.setItem(HINT_KEY, JSON.stringify({ keyPrefix: 'hintpref' }));
    // Reset cache so a new session fetch is triggered
    _resetSessionCache();

    // Use a deferred promise so we can control when the server responds
    let resolveSession!: (v: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(
      () => new Promise((resolve) => { resolveSession = resolve; }),
    );

    const { result } = renderHook(() => useLicense(), { wrapper });

    // Before server responds: hint gives immediate unlocked state
    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.isLoading).toBe(true);

    // Now let the server respond
    await act(async () => {
      resolveSession(
        new Response(JSON.stringify({ unlocked: true, keyPrefix: 'hintpref' })),
      );
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isUnlocked).toBe(true);
  });

  // ---- 3. Legacy migration ----

  it('migrates old recipecalc_license key to hint format after server confirms', async () => {
    // Set old format in localStorage
    localStorage.setItem(OLD_KEY, JSON.stringify({ key: 'ABCDEFGH-rest-of-key' }));
    _resetSessionCache();

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ unlocked: true, keyPrefix: 'ABCDEFGH' })),
    );

    const { result } = renderHook(() => useLicense(), { wrapper });

    // Old key used as hint: initial state is unlocked
    expect(result.current.isUnlocked).toBe(true);

    // Old key is NOT deleted until server confirms
    expect(localStorage.getItem(OLD_KEY)).not.toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // After server confirms: old key removed, hint written
    expect(localStorage.getItem(OLD_KEY)).toBeNull();
    expect(localStorage.getItem(HINT_KEY)).not.toBeNull();
    const hint = JSON.parse(localStorage.getItem(HINT_KEY)!);
    expect(hint.keyPrefix).toBe('ABCDEFGH');
  });

  // ---- 4. activate() success ----

  it('activate() POSTs to /api/activate and sets unlocked on success', async () => {
    const { result } = renderHook(() => useLicense(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Override fetch for the activate call
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          instanceId: 'inst-123',
          activatedAt: '2026-04-01T10:00:00.000Z',
        }),
      ),
    );

    let activateResult: unknown;
    await act(async () => {
      activateResult = await result.current.activate('MYKEY123-full-license-key');
    });

    expect(activateResult).toEqual({
      ok: true,
      instanceId: 'inst-123',
      activatedAt: '2026-04-01T10:00:00.000Z',
    });
    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.license).toEqual({ keyPrefix: 'MYKEY123' });

    // Verify fetch was called correctly
    expect(fetch).toHaveBeenCalledWith('/api/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'MYKEY123-full-license-key' }),
    });

    // Verify localStorage hint was written
    const hint = JSON.parse(localStorage.getItem(HINT_KEY)!);
    expect(hint.keyPrefix).toBe('MYKEY123');
  });

  // ---- 5. activate() failure (all reason types) ----

  it('activate() does not unlock on server failure', async () => {
    const { result } = renderHook(() => useLicense(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, reason: 'invalid' })),
    );

    let activateResult: unknown;
    await act(async () => {
      activateResult = await result.current.activate('bad-key');
    });

    expect(activateResult).toEqual({ ok: false, reason: 'invalid' });
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.license).toBeNull();
  });

  it.each([
    'invalid',
    'wrong_product',
    'limit_reached',
    'network',
  ] as const)('activate() returns reason=%s from server', async (reason) => {
    const { result } = renderHook(() => useLicense(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, reason })),
    );

    let activateResult: unknown;
    await act(async () => {
      activateResult = await result.current.activate('some-key');
    });

    expect(activateResult).toEqual({ ok: false, reason });
    expect(result.current.isUnlocked).toBe(false);
  });

  // ---- 6. activate() network error ----

  it('activate() returns reason=network when fetch throws', async () => {
    const { result } = renderHook(() => useLicense(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    let activateResult: unknown;
    await act(async () => {
      activateResult = await result.current.activate('any-key');
    });

    expect(activateResult).toEqual({ ok: false, reason: 'network' });
    expect(result.current.isUnlocked).toBe(false);
  });

  // ---- 7. deactivate() ----

  it('deactivate() calls /api/deactivate, clears state and hint', async () => {
    // Start with an unlocked state
    localStorage.setItem(HINT_KEY, JSON.stringify({ keyPrefix: 'testpref' }));
    _resetSessionCache();

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ unlocked: true, keyPrefix: 'testpref' })),
    );

    const { result } = renderHook(() => useLicense(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isUnlocked).toBe(true);

    // Now deactivate
    act(() => {
      result.current.deactivate();
    });

    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.license).toBeNull();
    expect(localStorage.getItem(HINT_KEY)).toBeNull();

    // Verify /api/deactivate was called
    expect(fetch).toHaveBeenCalledWith('/api/deactivate', { method: 'POST' });
  });

  // ---- 8. Server overrides hint ----

  it('clears hint and locks when hint says unlocked but server says not', async () => {
    // Hint says we're unlocked
    localStorage.setItem(HINT_KEY, JSON.stringify({ keyPrefix: 'stale' }));
    _resetSessionCache();

    // Server disagrees
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ unlocked: false })),
    );

    const { result } = renderHook(() => useLicense(), { wrapper });

    // Initially unlocked from hint
    expect(result.current.isUnlocked).toBe(true);

    // After server responds, state should flip
    await waitFor(() => {
      expect(result.current.isUnlocked).toBe(false);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.license).toBeNull();
    // Hint should be cleared
    expect(localStorage.getItem(HINT_KEY)).toBeNull();
  });

  // ---- 9. Session cache deduplication ----

  it('multiple providers on same page only trigger one /api/session fetch', async () => {
    // The session cache from the setup.ts beforeEach means fetchSession()
    // already resolved for the first provider. Reset it so we control the flow.
    _resetSessionCache();

    const sessionResponse = new Response(
      JSON.stringify({ unlocked: false }),
    );
    vi.mocked(fetch).mockResolvedValueOnce(sessionResponse);

    // Render two separate providers (simulating multiple islands on the page)
    const wrapper1 = ({ children }: { children: ReactNode }) => (
      <LicenseProvider>{children}</LicenseProvider>
    );
    const wrapper2 = ({ children }: { children: ReactNode }) => (
      <LicenseProvider>{children}</LicenseProvider>
    );

    const { result: r1 } = renderHook(() => useLicense(), { wrapper: wrapper1 });
    const { result: r2 } = renderHook(() => useLicense(), { wrapper: wrapper2 });

    await waitFor(() => {
      expect(r1.current.isLoading).toBe(false);
    });
    await waitFor(() => {
      expect(r2.current.isLoading).toBe(false);
    });

    // fetch should only have been called once for /api/session
    const sessionCalls = vi.mocked(fetch).mock.calls.filter(
      ([url]) => url === '/api/session',
    );
    expect(sessionCalls).toHaveLength(1);
  });

  // ---- 10. useLicense outside provider ----

  it('throws when useLicense is used outside LicenseProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useLicense());
    }).toThrow('useLicense must be used within a LicenseProvider');

    consoleError.mockRestore();
  });
});
