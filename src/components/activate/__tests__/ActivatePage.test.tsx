import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActivatePage from '../ActivatePage';

// ---------------------------------------------------------------------------
// Mock LemonSqueezy API
// ---------------------------------------------------------------------------

const mockActivate = vi.fn();

vi.mock('../../../services/lemonsqueezy.js', () => ({
  activateLicense: (...args: unknown[]) => mockActivate(...args),
  _env: {
    get storeId() { return '12345'; },
    get productId() { return '67890'; },
  },
}));

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
// localStorage mock
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'recipecalc_license';

let store: Record<string, string> = {};

const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
};

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
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  store = {};
  mockActivate.mockReset();
  mockTrackEvent.mockClear();
  mockMatchMedia(false);
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
// Tests
// ---------------------------------------------------------------------------

describe('ActivatePage', () => {
  // ---- Rendering ----

  it('renders the activate page with title and input', () => {
    render(<ActivatePage />);
    expect(screen.getByText('Activate your license')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste your license key')).toBeInTheDocument();
    expect(screen.getByText('Activate')).toBeInTheDocument();
  });

  it('renders RecipeCalc logo linking to home', () => {
    render(<ActivatePage />);
    const logo = screen.getByText('RecipeCalc');
    expect(logo).toBeInTheDocument();
    expect(logo.closest('a')).toHaveAttribute('href', '/');
  });

  it('renders subtitle with instructions', () => {
    render(<ActivatePage />);
    expect(screen.getByText('Enter the license key from your purchase email')).toBeInTheDocument();
  });

  // ---- IDLE state: button disabled when empty ----

  it('disables Activate button when input is empty', () => {
    render(<ActivatePage />);
    const btn = screen.getByText('Activate');
    expect(btn).toBeDisabled();
  });

  it('disables Activate button when input contains only whitespace', async () => {
    const user = userEvent.setup();
    render(<ActivatePage />);
    const input = screen.getByPlaceholderText('Paste your license key');
    await user.type(input, '   ');
    expect(screen.getByText('Activate')).toBeDisabled();
  });

  it('enables Activate button when key is entered', async () => {
    const user = userEvent.setup();
    render(<ActivatePage />);
    const input = screen.getByPlaceholderText('Paste your license key');
    await user.type(input, 'some-key');
    expect(screen.getByText('Activate')).not.toBeDisabled();
  });

  // ---- VALIDATING state ----

  it('shows "Activating..." and disables input during validation', async () => {
    // Make activate hang to observe validating state
    let resolveActivate: (value: unknown) => void;
    mockActivate.mockReturnValue(new Promise((resolve) => { resolveActivate = resolve; }));

    const user = userEvent.setup();
    render(<ActivatePage />);

    const input = screen.getByPlaceholderText('Paste your license key');
    await user.type(input, 'test-key');
    await user.click(screen.getByText('Activate'));

    expect(screen.getByText('Activating...')).toBeInTheDocument();
    expect(input).toBeDisabled();

    // Cleanup: resolve the promise
    resolveActivate!({ ok: true, instanceId: 'id', activatedAt: '2026-01-01T00:00:00Z' });
  });

  // ---- SUCCESS state ----

  it('shows success state after valid key activation', async () => {
    mockActivate.mockResolvedValueOnce({
      ok: true,
      instanceId: 'new-instance',
      activatedAt: '2026-03-30T14:00:00.000Z',
    });

    const user = userEvent.setup();
    render(<ActivatePage />);

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

  it('saves license to localStorage on success', async () => {
    mockActivate.mockResolvedValueOnce({
      ok: true,
      instanceId: 'persist-instance',
      activatedAt: '2026-03-30T14:00:00.000Z',
    });

    const user = userEvent.setup();
    render(<ActivatePage />);

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'persist-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByText("You're unlocked!")).toBeInTheDocument();
    });

    const stored = JSON.parse(store[STORAGE_KEY]);
    expect(stored.key).toBe('persist-key');
    expect(stored.instanceId).toBe('persist-instance');
  });

  // ---- ERROR states ----

  it('shows "Invalid key" error for invalid reason', async () => {
    mockActivate.mockResolvedValueOnce({ ok: false, reason: 'invalid' });

    const user = userEvent.setup();
    render(<ActivatePage />);

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'bad-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
    expect(screen.getByText(/Invalid key\. Double-check your purchase email\./)).toBeInTheDocument();
  });

  it('shows "wrong product" error for wrong_product reason', async () => {
    mockActivate.mockResolvedValueOnce({ ok: false, reason: 'wrong_product' });

    const user = userEvent.setup();
    render(<ActivatePage />);

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'wrong-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByText(/This key is for a different product\./)).toBeInTheDocument();
    });
  });

  it('shows "limit reached" error for limit_reached reason', async () => {
    mockActivate.mockResolvedValueOnce({ ok: false, reason: 'limit_reached' });

    const user = userEvent.setup();
    render(<ActivatePage />);

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'maxed-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByText(/This key has reached its activation limit\. Contact support\./)).toBeInTheDocument();
    });
  });

  it('shows "network error" for network reason', async () => {
    mockActivate.mockResolvedValueOnce({ ok: false, reason: 'network' });

    const user = userEvent.setup();
    render(<ActivatePage />);

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'net-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByText(/Connection error\. Please try again\./)).toBeInTheDocument();
    });
  });

  it('error message has role="alert" for accessibility', async () => {
    mockActivate.mockResolvedValueOnce({ ok: false, reason: 'invalid' });

    const user = userEvent.setup();
    render(<ActivatePage />);

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
    let resolveActivate: (value: unknown) => void;
    mockActivate.mockReturnValue(new Promise((resolve) => { resolveActivate = resolve; }));

    const user = userEvent.setup();
    render(<ActivatePage />);

    const input = screen.getByPlaceholderText('Paste your license key');
    await user.type(input, 'test-key');
    await user.click(screen.getByText('Activate'));

    // The sr-only text should be present in the aria-live region
    const statusRegion = screen.getByTestId('activate-status');
    expect(statusRegion).toHaveTextContent('Validating your license key...');

    // Cleanup: resolve the promise
    resolveActivate!({ ok: true, instanceId: 'id', activatedAt: '2026-01-01T00:00:00Z' });
  });

  // ---- Retry (ERROR → IDLE) ----

  it('allows retry after error via "Try again" button', async () => {
    mockActivate.mockResolvedValueOnce({ ok: false, reason: 'network' });

    const user = userEvent.setup();
    render(<ActivatePage />);

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
    mockActivate.mockResolvedValueOnce({ ok: false, reason: 'invalid' });

    const user = userEvent.setup();
    render(<ActivatePage />);

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

  it('shows already-activated state when license exists in localStorage', () => {
    store[STORAGE_KEY] = makeLicenseJSON();
    render(<ActivatePage />);

    expect(screen.getByTestId('already-activated')).toBeInTheDocument();
    expect(screen.getByText('Already activated')).toBeInTheDocument();
    expect(screen.getByText('Go to calculator')).toBeInTheDocument();
    expect(screen.getByText('Go to calculator').closest('a')).toHaveAttribute('href', '/calculator');
  });

  it('shows truncated key in already-activated state', () => {
    store[STORAGE_KEY] = makeLicenseJSON({ key: 'abcdefghijklmnop' });
    render(<ActivatePage />);

    expect(screen.getByText('abcdefgh...')).toBeInTheDocument();
  });

  it('does not show activate form when already activated', () => {
    store[STORAGE_KEY] = makeLicenseJSON();
    render(<ActivatePage />);

    expect(screen.queryByPlaceholderText('Paste your license key')).not.toBeInTheDocument();
    expect(screen.queryByText('Activate your license')).not.toBeInTheDocument();
  });

  // ---- Persistence roundtrip (refresh simulation) ----

  it('persists license across remounts (page refresh)', async () => {
    mockActivate.mockResolvedValueOnce({
      ok: true,
      instanceId: 'roundtrip-instance',
      activatedAt: '2026-03-30T14:00:00.000Z',
    });

    const user = userEvent.setup();
    const { unmount } = render(<ActivatePage />);

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'roundtrip-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(screen.getByText("You're unlocked!")).toBeInTheDocument();
    });

    unmount();

    // Re-render simulates page refresh
    render(<ActivatePage />);

    expect(screen.getByTestId('already-activated')).toBeInTheDocument();
    expect(screen.getByText('Already activated')).toBeInTheDocument();
  });

  // ---- Confetti & prefers-reduced-motion ----

  it('renders confetti on success when motion is not reduced', async () => {
    mockMatchMedia(false);
    mockActivate.mockResolvedValueOnce({
      ok: true,
      instanceId: 'id',
      activatedAt: '2026-01-01T00:00:00Z',
    });

    const user = userEvent.setup();
    render(<ActivatePage />);

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
    mockActivate.mockResolvedValueOnce({
      ok: true,
      instanceId: 'id',
      activatedAt: '2026-01-01T00:00:00Z',
    });

    const user = userEvent.setup();
    render(<ActivatePage />);

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
    mockActivate.mockResolvedValueOnce({
      ok: true,
      instanceId: 'id',
      activatedAt: '2026-01-01T00:00:00Z',
    });

    const user = userEvent.setup();
    render(<ActivatePage />);

    await user.type(screen.getByPlaceholderText('Paste your license key'), '  trimmed-key  ');
    await user.click(screen.getByText('Activate'));

    expect(mockActivate).toHaveBeenCalledWith('trimmed-key');
  });

  it('submits form via Enter key', async () => {
    mockActivate.mockResolvedValueOnce({
      ok: true,
      instanceId: 'id',
      activatedAt: '2026-01-01T00:00:00Z',
    });

    const user = userEvent.setup();
    render(<ActivatePage />);

    const input = screen.getByPlaceholderText('Paste your license key');
    await user.type(input, 'enter-key{Enter}');

    await waitFor(() => {
      expect(mockActivate).toHaveBeenCalledWith('enter-key');
    });
  });

  // ---- Analytics events ----

  it('fires ACTIVATE_SUCCESS with channel "manual" on successful activation', async () => {
    mockActivate.mockResolvedValueOnce({
      ok: true,
      instanceId: 'id',
      activatedAt: '2026-01-01T00:00:00Z',
    });

    const user = userEvent.setup();
    render(<ActivatePage />);

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'good-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('activate_success', { channel: 'manual' });
    });
  });

  it('fires ACTIVATE_FAIL with reason on failed activation', async () => {
    mockActivate.mockResolvedValueOnce({ ok: false, reason: 'invalid' });

    const user = userEvent.setup();
    render(<ActivatePage />);

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'bad-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('activate_fail', { reason: 'invalid' });
    });
  });

  it('fires ACTIVATE_FAIL with network reason on network error', async () => {
    mockActivate.mockResolvedValueOnce({ ok: false, reason: 'network' });

    const user = userEvent.setup();
    render(<ActivatePage />);

    await user.type(screen.getByPlaceholderText('Paste your license key'), 'net-key');
    await user.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('activate_fail', { reason: 'network' });
    });
  });
});
