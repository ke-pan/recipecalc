import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import NavBar from '../NavBar';

// ---------------------------------------------------------------------------
// Mock LemonSqueezy service (needed by LicenseContext)
// ---------------------------------------------------------------------------

vi.mock('../../../services/lemonsqueezy.js', () => ({
  activateLicense: vi.fn(),
  _env: {
    get storeId() { return '12345'; },
    get productId() { return '67890'; },
  },
}));

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const LICENSE_KEY = 'recipecalc_license';

let store: Record<string, string> = {};

const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLicenseJSON(): string {
  return JSON.stringify({
    key: 'test-key-123',
    instanceId: 'instance-abc',
    activatedAt: '2026-03-30T12:00:00.000Z',
    storeId: '12345',
    productId: '67890',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NavBar', () => {
  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', mockLocalStorage);
    // Default: mock location as /calculator
    Object.defineProperty(window, 'location', {
      value: { pathname: '/calculator', href: '' },
      writable: true,
      configurable: true,
    });
  });

  it('renders nothing when user is not unlocked (free user)', () => {
    const { container } = render(<NavBar />);
    expect(container.querySelector('[data-testid="navbar"]')).toBeNull();
  });

  it('renders nav bar when user is unlocked (paid user)', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    render(<NavBar />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByText('Calculator')).toBeInTheDocument();
    expect(screen.getByText('My Recipes')).toBeInTheDocument();
    expect(screen.getByText('My Pantry')).toBeInTheDocument();
  });

  it('renders three navigation links with correct hrefs', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    render(<NavBar />);

    const calcLink = screen.getByTestId('navbar-link-calculator');
    const recipesLink = screen.getByTestId('navbar-link-template');
    const pantryLink = screen.getByTestId('navbar-link-pantry');

    expect(calcLink).toHaveAttribute('href', '/calculator');
    expect(recipesLink).toHaveAttribute('href', '/template');
    expect(pantryLink).toHaveAttribute('href', '/pantry');
  });

  it('highlights the current page with active class and aria-current', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/calculator', href: '' },
      writable: true,
      configurable: true,
    });

    render(<NavBar />);

    const calcLink = screen.getByTestId('navbar-link-calculator');
    const recipesLink = screen.getByTestId('navbar-link-template');

    expect(calcLink).toHaveClass('navbar__link--active');
    expect(calcLink).toHaveAttribute('aria-current', 'page');

    expect(recipesLink).not.toHaveClass('navbar__link--active');
    expect(recipesLink).not.toHaveAttribute('aria-current');
  });

  it('highlights My Recipes when on /template', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/template', href: '' },
      writable: true,
      configurable: true,
    });

    render(<NavBar />);

    const recipesLink = screen.getByTestId('navbar-link-template');
    expect(recipesLink).toHaveClass('navbar__link--active');
    expect(recipesLink).toHaveAttribute('aria-current', 'page');
  });

  it('highlights My Pantry when on /pantry', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/pantry', href: '' },
      writable: true,
      configurable: true,
    });

    render(<NavBar />);

    const pantryLink = screen.getByTestId('navbar-link-pantry');
    expect(pantryLink).toHaveClass('navbar__link--active');
    expect(pantryLink).toHaveAttribute('aria-current', 'page');
  });

  it('has proper ARIA navigation landmark', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    render(<NavBar />);

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(nav).toBeInTheDocument();
  });
});
