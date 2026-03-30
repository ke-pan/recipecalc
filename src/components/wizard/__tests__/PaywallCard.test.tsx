import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import PaywallCard from '../PaywallCard';
import { LicenseProvider } from '../../../contexts/LicenseContext.js';

// Mock the LemonSqueezy service so LicenseProvider can initialize
vi.mock('../../../services/lemonsqueezy.js', () => ({
  activateLicense: vi.fn(),
  _env: {
    get storeId() { return '12345'; },
    get productId() { return '67890'; },
  },
}));

// Mock useLemonCheckout to capture openCheckout calls
const mockOpenCheckout = vi.fn();
vi.mock('../../../hooks/useLemonCheckout.js', () => ({
  useLemonCheckout: () => ({ openCheckout: mockOpenCheckout }),
}));

/** Wrapper that provides LicenseProvider context. */
function Wrapper({ children }: { children: ReactNode }) {
  return <LicenseProvider>{children}</LicenseProvider>;
}

const TEST_CHECKOUT_URL = 'https://recipecalc.lemonsqueezy.com/buy/test-123';

describe('PaywallCard', () => {
  beforeEach(() => {
    mockOpenCheckout.mockClear();
  });

  // --- 1. Rendering ---

  it('renders the paywall card', () => {
    render(
      <PaywallCard checkoutUrl={TEST_CHECKOUT_URL} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('paywall-card')).toBeInTheDocument();
  });

  it('displays the title with price', () => {
    render(
      <PaywallCard checkoutUrl={TEST_CHECKOUT_URL} />,
      { wrapper: Wrapper },
    );

    const title = screen.getByText(/Unlock Full Pricing/);
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent('$19');
  });

  it('displays "one-time, not a subscription" subtitle', () => {
    render(
      <PaywallCard checkoutUrl={TEST_CHECKOUT_URL} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('one-time, not a subscription')).toBeInTheDocument();
  });

  // --- 2. Feature list ---

  it('displays all three features', () => {
    render(
      <PaywallCard checkoutUrl={TEST_CHECKOUT_URL} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Recommended pricing + slider')).toBeInTheDocument();
    expect(screen.getByText('Save unlimited recipes')).toBeInTheDocument();
    expect(screen.getByText('Copy & export results')).toBeInTheDocument();
  });

  it('renders feature checkmarks', () => {
    render(
      <PaywallCard checkoutUrl={TEST_CHECKOUT_URL} />,
      { wrapper: Wrapper },
    );

    const checks = screen.getAllByText('✓');
    expect(checks).toHaveLength(3);
    checks.forEach((check) => {
      expect(check).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // --- 3. CTA button ---

  it('renders the "Get Your Price" CTA button', () => {
    render(
      <PaywallCard checkoutUrl={TEST_CHECKOUT_URL} />,
      { wrapper: Wrapper },
    );

    const cta = screen.getByTestId('paywall-cta');
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveTextContent('Get Your Price');
    expect(cta.tagName).toBe('BUTTON');
  });

  it('calls openCheckout with the checkout URL when CTA is clicked', () => {
    render(
      <PaywallCard checkoutUrl={TEST_CHECKOUT_URL} />,
      { wrapper: Wrapper },
    );

    fireEvent.click(screen.getByTestId('paywall-cta'));

    expect(mockOpenCheckout).toHaveBeenCalledOnce();
    expect(mockOpenCheckout).toHaveBeenCalledWith(TEST_CHECKOUT_URL);
  });

  // --- 4. Activate link ---

  it('renders "Already have a key?" with /activate link', () => {
    render(
      <PaywallCard checkoutUrl={TEST_CHECKOUT_URL} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText(/Already have a key/)).toBeInTheDocument();

    const link = screen.getByTestId('paywall-activate-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/activate');
    expect(link.tagName).toBe('A');
  });

  // --- 5. Dashed border (CSS class) ---

  it('has the paywall-card CSS class for dashed border styling', () => {
    render(
      <PaywallCard checkoutUrl={TEST_CHECKOUT_URL} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('paywall-card')).toHaveClass('paywall-card');
  });
});
