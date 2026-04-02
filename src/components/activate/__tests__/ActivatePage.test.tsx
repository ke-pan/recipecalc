import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActivatePage from '../ActivatePage';

// ---------------------------------------------------------------------------
// Mock analytics
// ---------------------------------------------------------------------------

const mockTrackEvent = vi.fn();

vi.mock('../../../lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  EVENTS: {
    ACTIVATE_SUCCESS: 'activate_success',
    ACTIVATE_FAIL: 'activate_fail',
  },
}));

// ---------------------------------------------------------------------------
// matchMedia mock
// ---------------------------------------------------------------------------

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HINT_KEY = 'recipepricer_license_hint';
const OLD_KEY = 'recipecalc_license';

/** Override fetch to make /api/activate fail with a specific reason. */
function mockActivateFail(reason: string) {
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/api/activate') {
      return new Response(JSON.stringify({ ok: false, reason }), { status: 401 });
    }
    if (url === '/api/session') {
      return new Response(JSON.stringify({ unlocked: false }));
    }
    return new Response(JSON.stringify({}));
  });
}

/** Override fetch to make /api/activate hang (never resolve). Returns a getter for the resolve fn. */
function mockActivateHang() {
  let resolveActivate!: (v: Response) => void;
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/api/activate') {
      return new Promise<Response>((resolve) => {
        resolveActivate = resolve;
      });
    }
    if (url === '/api/session') {
      return new Response(JSON.stringify({ unlocked: false }));
    }
    return new Response(JSON.stringify({}));
  });
  return () => resolveActivate;
}

/** Override fetch to make /api/activate throw a network error. */
function mockActivateNetworkError() {
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/api/activate') {
      throw new TypeError('Network error');
    }
    if (url === '/api/session') {
      return new Response(JSON.stringify({ unlocked: false }));
    }
    return new Response(JSON.stringify({}));
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockTrackEvent.mockClear();
  mockMatchMedia(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActivatePage', () => {
  // ---- Rendering ----

  it('renders the activate page with title and input', async () => {
    render(<ActivatePage />);
    await waitFor(() => {
      expect(screen.getByText('Activate your license')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    expect(screen.getByText('Activate')).toBeInTheDocument();
  });

  it('renders RecipePricer logo linking to home', () => {
    render(<ActivatePage />);
    const logo = screen.getByText('RecipePricer');
    expect(logo).toBeInTheDocument();
    expect(logo.closest('a')).toHaveAttribute('href', '/');
  });

  it('renders subtitle with instructions', async () => {
    render(<ActivatePage />);
    await waitFor(() => {
      expect(screen.getByText('Enter the license key from your purchase email')).toBeInTheDocument();
    });
  });

  // ---- IDLE state: button disabled when empty ----

  it('disables Activate button when input is empty', async () => {
    render(<ActivatePage />);
    await waitFor(() => {
      expect(screen.getByText('Activate')).toBeInTheDocument();
    });
    expect(screen.getByText('Activate')).toBeDisabled();
  });

  it('disables Activate button when input contains only whitespace', async () => {
    const user = userEvent.setup();
    render(<ActivatePage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });
    const input = screen.getByPlaceholderText('Paste your license key');
    await user.type(input, '   ');
    expect(screen.getByText('Activate')).toBeDisabled();
  });

  it('enables Activate button when key is entered', async () => {
    const user = userEvent.setup();
    render(<ActivatePage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });
    const input = screen.getByPlaceholderText('Paste your license key');
    await user.type(input, 'some-key');
    expect(screen.getByText('Activate')).not.toBeDisabled();
  });

  // ---- VALIDATING state ----

  it('shows "Activating..." and disables input during validation', async () => {
    // Make activate hang to observe validating state
    const getResolve = mockActivateHang();

    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Paste your license key');
    await user.type(input, 'test-key');
    await user.click(screen.getByText('Activate'));

    expect(screen.getByText('Activating...')).toBeInTheDocument();
    expect(input).toBeDisabled();

    // Cleanup: resolve the pending promise
    getResolve()(new Response(JSON.stringify({
      ok: true, instanceId: 'id', activatedAt: '2026-01-01T00:00:00Z',
    })));
  });

  // ---- SUCCESS state ----

  it('shows success state after valid key activation', async () => {
    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Paste your license key');
    await user.type(input, 'valid-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByText("You're unlocked!")).toBeInTheDocument();
    });

    expect(screen.getByTestId('success-state')).toBeInTheDocument();
    expect(screen.getByText(/Start calculating/)).toBeInTheDocument();
    expect(screen.getByText(/Start calculating/).closest('a')).toHaveAttribute('href', '/calculator');
  });

  it('saves license hint to localStorage on success', async () => {
    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'persist-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByText("You're unlocked!")).toBeInTheDocument();
    });

    expect(localStorage.getItem(HINT_KEY)).not.toBeNull();
    const hint = JSON.parse(localStorage.getItem(HINT_KEY)!);
    expect(hint.keyPrefix).toBe('persist-');
  });

  // ---- ERROR states ----

  it('shows "Invalid key" error for invalid reason', async () => {
    mockActivateFail('invalid');

    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'bad-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
    expect(screen.getByText(/Invalid key\. Double-check your purchase email\./)).toBeInTheDocument();
  });

  it('shows "wrong product" error for wrong_product reason', async () => {
    mockActivateFail('wrong_product');

    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'wrong-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByText(/This key is for a different product\./)).toBeInTheDocument();
    });
  });

  it('shows "limit reached" error for limit_reached reason', async () => {
    mockActivateFail('limit_reached');

    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'maxed-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByText(/This key has reached its activation limit\. Contact support\./)).toBeInTheDocument();
    });
  });

  it('shows "network error" for network failure', async () => {
    mockActivateNetworkError();

    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'net-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByText(/Connection error\. Please try again\./)).toBeInTheDocument();
    });
  });

  it('error message has role="alert" for accessibility', async () => {
    mockActivateFail('invalid');

    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'bad');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('has an aria-live="polite" region for status messages', () => {
    render(<ActivatePage />);
    const statusRegion = screen.getByTestId('activate-status');
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('announces validating state to screen readers via aria-live', async () => {
    const getResolve = mockActivateHang();

    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Paste your license key');
    await user.type(input, 'test-key');
    await user.click(screen.getByText('Activate'));

    // The sr-only text should be present in the aria-live region
    const statusRegion = screen.getByTestId('activate-status');
    expect(statusRegion).toHaveTextContent('Validating your license key...');

    // Cleanup: resolve the pending promise
    getResolve()(new Response(JSON.stringify({
      ok: true, instanceId: 'id', activatedAt: '2026-01-01T00:00:00Z',
    })));
  });

  // ---- Retry (ERROR → IDLE) ----

  it('allows retry after error via "Try again" button', async () => {
    mockActivateFail('network');

    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'retry-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Try again'));

    // Should be back in IDLE state
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste your license key')).not.toBeDisabled();
    expect(screen.getByText('Activate')).toBeInTheDocument();
  });

  it('clears error when user types in input', async () => {
    mockActivateFail('invalid');

    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Paste your license key');
    await user.type(input, 'bad');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    // Type in input to clear error
    await user.type(input, 'x');

    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
  });

  // ---- Already activated user ----

  it('shows already-activated state when license exists in localStorage', async () => {
    // Set old-format key — the fetch mock in setup.ts detects it and returns unlocked
    localStorage.setItem(OLD_KEY, JSON.stringify({
      key: 'test-key-123', instanceId: 'instance-abc',
      activatedAt: '2026-03-30T12:00:00.000Z', storeId: '12345', productId: '67890',
    }));

    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByTestId('already-activated')).toBeInTheDocument();
    });
    expect(screen.getByText('Already activated')).toBeInTheDocument();
    expect(screen.getByText('Go to calculator')).toBeInTheDocument();
    expect(screen.getByText('Go to calculator').closest('a')).toHaveAttribute('href', '/calculator');
  });

  it('shows truncated key in already-activated state', async () => {
    localStorage.setItem(OLD_KEY, JSON.stringify({
      key: 'abcdefghijklmnop', instanceId: 'instance-abc',
      activatedAt: '2026-03-30T12:00:00.000Z', storeId: '12345', productId: '67890',
    }));

    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByTestId('already-activated')).toBeInTheDocument();
    });
    // The fetch mock returns keyPrefix: 'test-key' for any old-format key
    expect(screen.getByText('test-key...')).toBeInTheDocument();
  });

  it('does not show activate form when already activated', async () => {
    localStorage.setItem(OLD_KEY, JSON.stringify({
      key: 'test-key-123', instanceId: 'instance-abc',
      activatedAt: '2026-03-30T12:00:00.000Z', storeId: '12345', productId: '67890',
    }));

    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByTestId('already-activated')).toBeInTheDocument();
    });
    expect(screen.queryByPlaceholderText('Paste your license key')).not.toBeInTheDocument();
    expect(screen.queryByText('Activate your license')).not.toBeInTheDocument();
  });

  // ---- Persistence roundtrip (refresh simulation) ----

  it('persists license across remounts (page refresh)', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'roundtrip-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByText("You're unlocked!")).toBeInTheDocument();
    });

    unmount();

    // Re-render simulates page refresh — the hint is now in localStorage,
    // so the fetch mock returns unlocked: true for /api/session
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByTestId('already-activated')).toBeInTheDocument();
    });
    expect(screen.getByText('Already activated')).toBeInTheDocument();
  });

  // ---- Confetti & prefers-reduced-motion ----

  it('renders confetti on success when motion is not reduced', async () => {
    mockMatchMedia(false);

    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByTestId('success-state')).toBeInTheDocument();
    });

    const confetti = document.querySelector('.activate__confetti');
    expect(confetti).toBeInTheDocument();
  });

  it('does not render confetti when prefers-reduced-motion is set', async () => {
    mockMatchMedia(true);

    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByTestId('success-state')).toBeInTheDocument();
    });

    const confetti = document.querySelector('.activate__confetti');
    expect(confetti).not.toBeInTheDocument();
  });

  // ---- Form submission ----

  it('trims whitespace from key before activating', async () => {
    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Paste your license key'), '  trimmed-key  ');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByText("You're unlocked!")).toBeInTheDocument();
    });

    // Verify the key was trimmed by checking the fetch call
    const activateCall = vi.mocked(fetch).mock.calls.find(
      (call) => {
        const url = typeof call[0] === 'string' ? call[0] : call[0].toString();
        return url === '/api/activate';
      },
    );
    expect(activateCall).toBeDefined();
    const body = JSON.parse(String(activateCall![1]?.body));
    expect(body.key).toBe('trimmed-key');
  });

  it('submits form via Enter key', async () => {
    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Paste your license key');
    await user.type(input, 'enter-key{Enter}');

    await waitFor(() => {
      const activateCall = vi.mocked(fetch).mock.calls.find(
        (call) => {
          const url = typeof call[0] === 'string' ? call[0] : call[0].toString();
          return url === '/api/activate';
        },
      );
      expect(activateCall).toBeDefined();
      const body = JSON.parse(String(activateCall![1]?.body));
      expect(body.key).toBe('enter-key');
    });
  });

  // ---- Analytics events ----

  it('fires ACTIVATE_SUCCESS with channel "manual" on successful activation', async () => {
    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'good-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('activate_success', { channel: 'manual' });
    });
  });

  it('fires ACTIVATE_FAIL with reason on failed activation', async () => {
    mockActivateFail('invalid');

    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'bad-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('activate_fail', { reason: 'invalid' });
    });
  });

  it('fires ACTIVATE_FAIL with network reason on network error', async () => {
    mockActivateNetworkError();

    const user = userEvent.setup();
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'net-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('activate_fail', { reason: 'network' });
    });
  });
});
