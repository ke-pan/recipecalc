import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import Step4Reveal from '../Step4Reveal';
import { LicenseProvider } from '../../../../contexts/LicenseContext.js';
import type { Recipe } from '../../../../lib/calc/types.js';

// Mock the LemonSqueezy module so LicenseProvider can initialize
vi.mock('../../../../services/lemonsqueezy.js', () => ({
  activateLicense: vi.fn(),
  _env: {
    get storeId() { return '12345'; },
    get productId() { return '67890'; },
  },
}));

// Mock useLemonCheckout so PaywallCard can render without real Lemon.js
const mockOpenCheckout = vi.fn();
vi.mock('../../../../hooks/useLemonCheckout.js', () => ({
  useLemonCheckout: () => ({ openCheckout: mockOpenCheckout }),
}));

// Mock analytics
const mockTrackEvent = vi.fn();
vi.mock('../../../../lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  EVENTS: {
    COPY_RESULT: 'copy_result',
    SAVE_RECIPE: 'save_recipe',
    PAYWALL_VIEW: 'paywall_view',
    PAYWALL_CLICK: 'paywall_click',
  },
}));

// --- Test fixture ---

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    name: 'Chocolate Chip Cookies',
    quantity: 24,
    quantityUnit: 'cookies',
    batchTimeHours: 2,
    ingredients: [
      {
        id: 'flour',
        name: 'All-Purpose Flour',
        purchaseAmount: 5,
        purchaseUnit: 'lb',
        purchasePrice: 4.99,
        usedAmount: 2,
        usedUnit: 'lb',
        wastePercent: 5,
      },
      {
        id: 'butter',
        name: 'Butter',
        purchaseAmount: 1,
        purchaseUnit: 'lb',
        purchasePrice: 5.49,
        usedAmount: 0.5,
        usedUnit: 'lb',
        wastePercent: 0,
      },
      {
        id: 'sugar',
        name: 'Sugar',
        purchaseAmount: 4,
        purchaseUnit: 'lb',
        purchasePrice: 3.99,
        usedAmount: 1,
        usedUnit: 'lb',
        wastePercent: 0,
      },
    ],
    laborAndOverhead: {
      hourlyRate: 20,
      packaging: 5,
      overhead: 3,
      platformFees: 2,
    },
    ...overrides,
  };
}

// --- License helpers ---

const VALID_LICENSE = JSON.stringify({
  key: 'test-key-123',
  instanceId: 'inst-456',
  activatedAt: '2026-01-01T00:00:00Z',
  storeId: '12345',
  productId: '67890',
});

/** Set localStorage so LicenseProvider reads an active license (isUnlocked=true). */
function setLicenseUnlocked() {
  localStorage.setItem('recipecalc_license', VALID_LICENSE);
}

/** Clear localStorage so LicenseProvider reads no license (isUnlocked=false). */
function setLicenseLocked() {
  localStorage.removeItem('recipecalc_license');
}

/** Wrapper that provides LicenseProvider context. */
function Wrapper({ children }: { children: ReactNode }) {
  return <LicenseProvider>{children}</LicenseProvider>;
}

// --- Helpers ---

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

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    value: { writeText },
  });
  return writeText;
}

/** Advance all timers to complete the full reveal animation sequence. */
function completeRevealAnimation() {
  act(() => {
    vi.advanceTimersByTime(2000);
  });
}

describe('Step4Reveal', () => {
  const onStartNew = vi.fn();
  const onGoToStep = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(true); // Default: reduced motion ON (skip animations for most tests)
    setLicenseUnlocked(); // Default: license active (isUnlocked=true) to preserve MVP behavior
    onStartNew.mockClear();
    onGoToStep.mockClear();
    mockTrackEvent.mockClear();

    // Stub IntersectionObserver for PaywallCard (rendered in locked state)
    if (!globalThis.IntersectionObserver) {
      globalThis.IntersectionObserver = vi.fn(() => ({
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
        takeRecords: vi.fn().mockReturnValue([]),
        root: null,
        rootMargin: '',
        thresholds: [],
      })) as unknown as typeof IntersectionObserver;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- 1. Rendering ---

  it('renders the reveal container', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('step4-reveal')).toBeInTheDocument();
  });

  // --- 2. Cost calculation integration ---

  it('displays correct ingredient cost', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    // Ingredient cost: flour (4.99 * 2/5 * 1.05) = 2.0958 -> $2.10
    // + butter (5.49 * 0.5/1 * 1.0) = $2.745 -> $2.75
    // + sugar (3.99 * 1/4 * 1.0) = $0.9975 -> $1.00
    // Total ingredients: $5.85 (rounded)
    const ingredientBox = screen.getByTestId('ingredient-cost-box');
    expect(ingredientBox).toHaveTextContent('$5.85');
  });

  it('displays correct true total cost', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    // True cost: ingredients($5.85) + labor(2*$20=$40) + packaging($5) + overhead($3) + platform($2) = $55.85
    const trueCostBox = screen.getByTestId('true-cost-box');
    expect(trueCostBox).toHaveTextContent('$55.85');
  });

  // --- 3. Gap bar ---

  it('displays the hidden cost gap amount', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    // Gap = $55.85 - $5.85 = $50.00
    const gapBar = screen.getByTestId('gap-bar');
    expect(gapBar).toHaveTextContent('$50.00');
  });

  it('shows gap bar with accessible label', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const gapBar = screen.getByTestId('gap-bar');
    expect(gapBar).toHaveAttribute('aria-label', 'Hidden cost gap: $50.00');
  });

  // --- 4. Recommended pricing ---

  it('displays recommended price per unit at default 30% cost ratio', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    // Cost per unit: $55.85 / 24 = $2.33 (rounded)
    // Recommended price: $2.33 / 0.3 = $7.77
    const priceUnit = screen.getByTestId('recommended-price-unit');
    expect(priceUnit).toHaveTextContent('$7.77');
  });

  it('displays recommended price per batch', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    // $7.77 * 24 = $186.48
    const priceBatch = screen.getByTestId('recommended-price-batch');
    expect(priceBatch).toHaveTextContent('$186.48');
  });

  it('displays profit margin', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    // 1 - 0.3 = 0.7 = 70%
    const margin = screen.getByTestId('profit-margin');
    expect(margin).toHaveTextContent('70% profit margin');
  });

  // --- 5. Slider ---

  it('renders the slider at default 30%', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('0.3');
    expect(screen.getByTestId('slider-value')).toHaveTextContent('30%');
  });

  it('updates pricing when slider is changed', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.4' } });

    // Cost per unit: $2.33
    // At 40%: $2.33 / 0.4 = $5.83 (rounded)
    expect(screen.getByTestId('recommended-price-unit')).toHaveTextContent('$5.83');
    expect(screen.getByTestId('slider-value')).toHaveTextContent('40%');
    // Margin: 60%
    expect(screen.getByTestId('profit-margin')).toHaveTextContent('60% profit margin');
  });

  // --- 6. Copy results ---

  it('copies results to clipboard and shows toast', async () => {
    const writeText = mockClipboard();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const copyBtn = screen.getByTestId('copy-button');
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    const clipboardText = writeText.mock.calls[0][0] as string;
    expect(clipboardText).toContain('Chocolate Chip Cookies');
    expect(clipboardText).toContain('Ingredient Cost: $5.85');
    expect(clipboardText).toContain('True Total Cost: $55.85');
    expect(clipboardText).toContain('Hidden Cost Gap: $50.00');
    expect(clipboardText).toContain('Recommended Price/Unit: $7.77');

    // Toast should be visible
    const toast = screen.getByTestId('toast');
    expect(toast).toHaveClass('step4-toast--visible');
  });

  it('hides toast after 3 seconds', async () => {
    mockClipboard();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-button'));
    });

    expect(screen.getByTestId('toast')).toHaveClass('step4-toast--visible');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByTestId('toast')).not.toHaveClass('step4-toast--visible');
  });

  // --- 7. Start new recipe ---

  it('calls onStartNew when "Start a new recipe" is clicked', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    fireEvent.click(screen.getByTestId('start-new-button'));
    expect(onStartNew).toHaveBeenCalledTimes(1);
  });

  // --- 8. Animation sequence ---

  it('shows skeleton initially when animations are enabled', () => {
    mockMatchMedia(false); // Enable animations

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('skeleton-left')).toBeInTheDocument();
    expect(screen.getByTestId('skeleton-right')).toBeInTheDocument();
  });

  it('reveals left box after skeleton phase', () => {
    mockMatchMedia(false);

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    // At 400ms, skeleton should be replaced with boxes
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByTestId('ingredient-cost-box')).toBeInTheDocument();
    expect(screen.getByTestId('ingredient-cost-box')).toHaveClass('step4-box--visible');
  });

  it('reveals right box after left box with 150ms gap', () => {
    mockMatchMedia(false);

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    // At 750ms (400 + 200 + 150), right box should appear
    act(() => {
      vi.advanceTimersByTime(750);
    });

    expect(screen.getByTestId('true-cost-box')).toHaveClass('step4-box--visible');
  });

  it('shows gap bar after count-up phase', () => {
    mockMatchMedia(false);

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    // At 1450ms, gap bar should slide in
    act(() => {
      vi.advanceTimersByTime(1450);
    });

    expect(screen.getByTestId('gap-bar')).toHaveClass('step4-gap__bar--visible');
  });

  // --- 9. Reduced motion ---

  it('skips to final state when prefers-reduced-motion is set', () => {
    mockMatchMedia(true);

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    // Everything should be visible immediately
    expect(screen.getByTestId('ingredient-cost-box')).toHaveClass('step4-box--visible');
    expect(screen.getByTestId('true-cost-box')).toHaveClass('step4-box--visible');
    expect(screen.getByTestId('gap-bar')).toHaveClass('step4-gap__bar--visible');
    expect(screen.getByTestId('recommended-section')).toHaveClass('step4-recommended--visible');

    // Final values should be shown (no count-up)
    expect(screen.getByTestId('ingredient-cost-box')).toHaveTextContent('$5.85');
    expect(screen.getByTestId('true-cost-box')).toHaveTextContent('$55.85');
  });

  // --- 10. Accessibility ---

  it('has accessible labels on action buttons', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    expect(
      screen.getByRole('button', { name: 'Copy results to clipboard' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start a new recipe' }),
    ).toBeInTheDocument();
  });

  it('has a labeled slider with correct aria attributes', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', '20');
    expect(slider).toHaveAttribute('aria-valuemax', '50');
    expect(slider).toHaveAttribute('aria-valuenow', '30');
    expect(slider).toHaveAttribute('aria-valuetext', '30%');
  });

  // --- 11. Edge case: zero ingredients ---

  it('handles a recipe with zero ingredient cost', () => {
    const recipe = makeRecipe({ ingredients: [] });

    render(
      <Step4Reveal recipe={recipe} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('ingredient-cost-box')).toHaveTextContent('$0.00');
    // True cost = labor(40) + packaging(5) + overhead(3) + platform(2) = $50.00
    expect(screen.getByTestId('true-cost-box')).toHaveTextContent('$50.00');
  });

  // --- 12. Slider boundary values ---

  it('clamps cost ratio to valid range at boundaries', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const slider = screen.getByRole('slider');

    // Set to minimum (20%)
    fireEvent.change(slider, { target: { value: '0.2' } });
    expect(screen.getByTestId('slider-value')).toHaveTextContent('20%');
    // At 20%: $2.33 / 0.2 = $11.65
    expect(screen.getByTestId('recommended-price-unit')).toHaveTextContent('$11.65');
    expect(screen.getByTestId('profit-margin')).toHaveTextContent('80% profit margin');

    // Set to maximum (50%)
    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(screen.getByTestId('slider-value')).toHaveTextContent('50%');
    // At 50%: $2.33 / 0.5 = $4.66
    expect(screen.getByTestId('recommended-price-unit')).toHaveTextContent('$4.66');
    expect(screen.getByTestId('profit-margin')).toHaveTextContent('50% profit margin');
  });

  // --- 13. Cost comparison region has accessible label ---

  it('has an accessible region label for cost comparison', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByRole('region', { name: 'Cost comparison' })).toBeInTheDocument();
  });

  // --- 14. Quantity unit displayed correctly ---

  it('displays the quantity unit in recommended section', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    // "cookies" -> "cookie" (singular)
    expect(screen.getByTestId('recommended-section')).toHaveTextContent('per cookie');
  });

  // --- 15. Step 4a/4b structure ---

  it('renders step 4a and 4b sections', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('step4a-reveal')).toBeInTheDocument();
    expect(screen.getByTestId('step4b-pricing')).toBeInTheDocument();
  });

  it('renders the "What can I do about this?" CTA in step 4a', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const cta = screen.getByTestId('step4a-cta');
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveTextContent('What can I do about this?');
  });

  it('keeps cost comparison and gap bar inside step 4a', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const section4a = screen.getByTestId('step4a-reveal');
    expect(section4a.querySelector('[data-testid="ingredient-cost-box"]')).toBeInTheDocument();
    expect(section4a.querySelector('[data-testid="true-cost-box"]')).toBeInTheDocument();
    expect(section4a.querySelector('[data-testid="gap-bar"]')).toBeInTheDocument();
  });

  it('keeps pricing and slider inside step 4b when unlocked', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const section4b = screen.getByTestId('step4b-pricing');
    expect(section4b.querySelector('[data-testid="recommended-section"]')).toBeInTheDocument();
    expect(section4b.querySelector('[data-testid="slider-section"]')).toBeInTheDocument();
    expect(section4b.querySelector('[data-testid="copy-button"]')).toBeInTheDocument();
  });

  it('"Start a new recipe" is in shared actions (accessible to all users)', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const sharedActions = screen.getByTestId('shared-actions-section');
    expect(sharedActions.querySelector('[data-testid="start-new-button"]')).toBeInTheDocument();
  });

  // --- 16. Locked state (isUnlocked=false) — blurred pricing & locked slider ---

  it('renders blurred recommended price when locked', () => {
    setLicenseLocked();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const recommended = screen.getByTestId('recommended-section');
    expect(recommended).toBeInTheDocument();
    expect(recommended).toHaveClass('blurred-price');
    // Real number is in the DOM (honor system — intentional per RFC)
    expect(screen.getByTestId('recommended-price-unit')).toHaveTextContent('$7.77');
  });

  it('renders a disabled slider with lock icon when locked', () => {
    setLicenseLocked();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const sliderSection = screen.getByTestId('slider-section');
    expect(sliderSection).toHaveClass('locked-slider');

    const slider = sliderSection.querySelector('input[type="range"]');
    expect(slider).toBeDisabled();

    // Lock icon is present
    expect(sliderSection).toHaveTextContent('\u{1F512}');
  });

  it('shows paywall toast when copy button is clicked while locked', async () => {
    setLicenseLocked();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const copyBtn = screen.getByTestId('copy-button');
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    const toast = screen.getByTestId('toast');
    expect(toast).toHaveClass('step4-toast--visible');
    expect(toast).toHaveClass('step4-toast--paywall');
    expect(toast).toHaveTextContent('Unlock with a license key');
  });

  it('shows paywall toast when save button is clicked while locked', async () => {
    setLicenseLocked();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const saveBtn = screen.getByTestId('save-button');
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    const toast = screen.getByTestId('toast');
    expect(toast).toHaveClass('step4-toast--visible');
    expect(toast).toHaveClass('step4-toast--paywall');
    expect(toast).toHaveTextContent('Unlock with a license key');
  });

  it('paywall toast contains an activate link', async () => {
    setLicenseLocked();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-button'));
    });

    const link = screen.getByTestId('toast-activate-link');
    expect(link).toHaveAttribute('href', '/activate');
    expect(link).toHaveTextContent('Activate');
  });

  it('does not copy to clipboard when locked user clicks copy', async () => {
    setLicenseLocked();
    const writeText = mockClipboard();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-button'));
    });

    expect(writeText).not.toHaveBeenCalled();
  });

  it('paywall toast auto-hides after 4 seconds', async () => {
    setLicenseLocked();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-button'));
    });

    expect(screen.getByTestId('toast')).toHaveClass('step4-toast--visible');

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByTestId('toast')).not.toHaveClass('step4-toast--visible');
  });

  it('still shows step 4a reveal content when locked', () => {
    setLicenseLocked();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('step4a-reveal')).toBeInTheDocument();
    expect(screen.getByTestId('ingredient-cost-box')).toBeInTheDocument();
    expect(screen.getByTestId('true-cost-box')).toBeInTheDocument();
    expect(screen.getByTestId('gap-bar')).toBeInTheDocument();
  });

  it('"Start a new recipe" works when locked', () => {
    setLicenseLocked();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    fireEvent.click(screen.getByTestId('start-new-button'));
    expect(onStartNew).toHaveBeenCalledTimes(1);
  });

  it('still renders the 4a CTA when locked', () => {
    setLicenseLocked();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('step4a-cta')).toBeInTheDocument();
  });

  it('renders same DOM structure for pricing in both locked and unlocked states', () => {
    // Locked: verify presence of recommended-section, slider-section, copy-button
    setLicenseLocked();

    const { unmount } = render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const section4b = screen.getByTestId('step4b-pricing');
    expect(section4b.querySelector('[data-testid="recommended-section"]')).toBeInTheDocument();
    expect(section4b.querySelector('[data-testid="slider-section"]')).toBeInTheDocument();
    expect(section4b.querySelector('[data-testid="copy-button"]')).toBeInTheDocument();

    unmount();

    // Unlocked: same test IDs are present
    setLicenseUnlocked();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const section4bUnlocked = screen.getByTestId('step4b-pricing');
    expect(section4bUnlocked.querySelector('[data-testid="recommended-section"]')).toBeInTheDocument();
    expect(section4bUnlocked.querySelector('[data-testid="slider-section"]')).toBeInTheDocument();
    expect(section4bUnlocked.querySelector('[data-testid="copy-button"]')).toBeInTheDocument();
  });

  // --- 17. Unlocked state has no blur or lock ---

  it('unlocked user sees no blur on recommended price', () => {
    setLicenseUnlocked();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const recommended = screen.getByTestId('recommended-section');
    expect(recommended).not.toHaveClass('blurred-price');
  });

  it('unlocked user slider is not disabled', () => {
    setLicenseUnlocked();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    const slider = screen.getByRole('slider');
    expect(slider).not.toBeDisabled();
    expect(screen.getByTestId('slider-section')).not.toHaveClass('locked-slider');
  });

  // --- 18. PaywallCard integration ---

  it('shows PaywallCard for free users (locked)', () => {
    setLicenseLocked();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('paywall-card')).toBeInTheDocument();
    expect(screen.getByText(/Unlock Full Pricing/)).toBeInTheDocument();
    expect(screen.getByText('one-time, not a subscription')).toBeInTheDocument();
    expect(screen.getByTestId('paywall-cta')).toBeInTheDocument();
    expect(screen.getByTestId('paywall-activate-link')).toHaveAttribute('href', '/activate');
  });

  it('does not show PaywallCard for paid users (unlocked)', () => {
    setLicenseUnlocked();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    expect(screen.queryByTestId('paywall-card')).not.toBeInTheDocument();
  });

  it('PaywallCard CTA calls openCheckout when clicked', () => {
    setLicenseLocked();
    mockOpenCheckout.mockClear();

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
      { wrapper: Wrapper },
    );

    fireEvent.click(screen.getByTestId('paywall-cta'));
    expect(mockOpenCheckout).toHaveBeenCalledOnce();
  });

  // =======================================================================
  // 19. Edge case nudges
  // =======================================================================

  describe('Nudge: all hidden costs = $0 (scenario 1)', () => {
    function makeZeroHiddenCostsRecipe() {
      return makeRecipe({
        batchTimeHours: 0,
        laborAndOverhead: {
          hourlyRate: 0,
          packaging: 0,
          overhead: 0,
          platformFees: 0,
        },
      });
    }

    it('shows nudge when all hidden costs are zero', () => {
      render(
        <Step4Reveal recipe={makeZeroHiddenCostsRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      const nudge = screen.getByTestId('nudge-all-hidden-zero');
      expect(nudge).toBeInTheDocument();
      expect(nudge).toHaveTextContent('Are you sure there are no labor or packaging costs?');
    });

    it('does not show nudge when at least one hidden cost is non-zero', () => {
      render(
        <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      expect(screen.queryByTestId('nudge-all-hidden-zero')).not.toBeInTheDocument();
    });

    it('can be dismissed', () => {
      render(
        <Step4Reveal recipe={makeZeroHiddenCostsRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      expect(screen.getByTestId('nudge-all-hidden-zero')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('nudge-all-hidden-zero-dismiss'));

      expect(screen.queryByTestId('nudge-all-hidden-zero')).not.toBeInTheDocument();
    });

    it('is placed inside step 4a', () => {
      render(
        <Step4Reveal recipe={makeZeroHiddenCostsRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      const section4a = screen.getByTestId('step4a-reveal');
      expect(section4a.querySelector('[data-testid="nudge-all-hidden-zero"]')).toBeInTheDocument();
    });
  });

  describe('Nudge: batch time = 0 (scenario 2)', () => {
    function makeZeroBatchTimeRecipe() {
      return makeRecipe({
        batchTimeHours: 0,
      });
    }

    it('shows nudge when batch time is 0', () => {
      render(
        <Step4Reveal recipe={makeZeroBatchTimeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      const nudge = screen.getByTestId('nudge-batch-time-zero');
      expect(nudge).toBeInTheDocument();
      expect(nudge).toHaveTextContent('A batch time of 0 means your time is free');
    });

    it('does not show nudge when batch time is non-zero', () => {
      render(
        <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      expect(screen.queryByTestId('nudge-batch-time-zero')).not.toBeInTheDocument();
    });

    it('can be dismissed', () => {
      render(
        <Step4Reveal recipe={makeZeroBatchTimeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      fireEvent.click(screen.getByTestId('nudge-batch-time-zero-dismiss'));

      expect(screen.queryByTestId('nudge-batch-time-zero')).not.toBeInTheDocument();
    });
  });

  describe('Nudge: ingredient cost >= true cost — variant B (scenario 3)', () => {
    function makeVariantBRecipe() {
      // All hidden costs zero + batch time zero => ingredient cost = true cost
      return makeRecipe({
        batchTimeHours: 0,
        laborAndOverhead: {
          hourlyRate: 0,
          packaging: 0,
          overhead: 0,
          platformFees: 0,
        },
      });
    }

    it('shows variant B nudge when ingredient cost >= true total cost', () => {
      render(
        <Step4Reveal recipe={makeVariantBRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      const nudge = screen.getByTestId('nudge-low-hidden-costs');
      expect(nudge).toBeInTheDocument();
      expect(nudge).toHaveTextContent('Your hidden costs are unusually low');
    });

    it('has a "Revisit hidden costs" CTA that calls onGoToStep(2)', () => {
      render(
        <Step4Reveal recipe={makeVariantBRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      const cta = screen.getByTestId('nudge-low-hidden-costs-cta');
      expect(cta).toHaveTextContent('Revisit hidden costs');

      fireEvent.click(cta);
      expect(onGoToStep).toHaveBeenCalledWith(2);
    });

    it('applies neutral styling to cost comparison boxes', () => {
      render(
        <Step4Reveal recipe={makeVariantBRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      const ingredientBox = screen.getByTestId('ingredient-cost-box');
      const trueCostBox = screen.getByTestId('true-cost-box');

      expect(ingredientBox).toHaveClass('step4-box--neutral');
      expect(trueCostBox).toHaveClass('step4-box--neutral');
    });

    it('does not apply neutral styling when hidden costs exist', () => {
      render(
        <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      const ingredientBox = screen.getByTestId('ingredient-cost-box');
      const trueCostBox = screen.getByTestId('true-cost-box');

      expect(ingredientBox).not.toHaveClass('step4-box--neutral');
      expect(trueCostBox).not.toHaveClass('step4-box--neutral');
    });

    it('can be dismissed', () => {
      render(
        <Step4Reveal recipe={makeVariantBRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      fireEvent.click(screen.getByTestId('nudge-low-hidden-costs-dismiss'));

      expect(screen.queryByTestId('nudge-low-hidden-costs')).not.toBeInTheDocument();
    });
  });

  describe('Nudge: recommended price < $1/unit (scenario 4)', () => {
    function makeLowPriceRecipe() {
      // Very low total cost with many units -> price per unit < $1
      // Total cost must be low enough that costPerUnit / 0.3 < 1.0
      // costPerUnit < 0.3 => trueTotalCost / quantity < 0.3
      // With quantity=24, trueTotalCost < 7.2
      return makeRecipe({
        batchTimeHours: 0,
        ingredients: [
          {
            id: 'flour',
            name: 'Flour',
            purchaseAmount: 5,
            purchaseUnit: 'lb',
            purchasePrice: 2.00,
            usedAmount: 1,
            usedUnit: 'lb',
            wastePercent: 0,
          },
        ],
        laborAndOverhead: {
          hourlyRate: 0,
          packaging: 0,
          overhead: 0,
          platformFees: 0,
        },
      });
    }

    it('shows nudge when recommended price per unit < $1 (paid user)', () => {
      setLicenseUnlocked();

      render(
        <Step4Reveal recipe={makeLowPriceRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      const nudge = screen.getByTestId('nudge-low-price');
      expect(nudge).toBeInTheDocument();
      expect(nudge).toHaveTextContent('This seems very low');
    });

    it('does not show nudge when license is locked', () => {
      setLicenseLocked();

      render(
        <Step4Reveal recipe={makeLowPriceRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      expect(screen.queryByTestId('nudge-low-price')).not.toBeInTheDocument();
    });

    it('does not show nudge when price is >= $1/unit', () => {
      render(
        <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      expect(screen.queryByTestId('nudge-low-price')).not.toBeInTheDocument();
    });

    it('is placed inside step 4b', () => {
      setLicenseUnlocked();

      render(
        <Step4Reveal recipe={makeLowPriceRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      const section4b = screen.getByTestId('step4b-pricing');
      expect(section4b.querySelector('[data-testid="nudge-low-price"]')).toBeInTheDocument();
    });

    it('can be dismissed', () => {
      setLicenseUnlocked();

      render(
        <Step4Reveal recipe={makeLowPriceRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      fireEvent.click(screen.getByTestId('nudge-low-price-dismiss'));

      expect(screen.queryByTestId('nudge-low-price')).not.toBeInTheDocument();
    });
  });

  describe('Nudge: all nudges are non-blocking', () => {
    it('still shows cost comparison and gap bar when nudges are visible', () => {
      const recipe = makeRecipe({
        batchTimeHours: 0,
        laborAndOverhead: {
          hourlyRate: 0,
          packaging: 0,
          overhead: 0,
          platformFees: 0,
        },
      });

      render(
        <Step4Reveal recipe={recipe} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      // Nudges are visible
      expect(screen.getByTestId('nudge-all-hidden-zero')).toBeInTheDocument();
      expect(screen.getByTestId('nudge-batch-time-zero')).toBeInTheDocument();

      // Core reveal content is still accessible
      expect(screen.getByTestId('ingredient-cost-box')).toBeInTheDocument();
      expect(screen.getByTestId('true-cost-box')).toBeInTheDocument();
      expect(screen.getByTestId('gap-bar')).toBeInTheDocument();
      expect(screen.getByTestId('step4a-cta')).toBeInTheDocument();
    });
  });

  // =======================================================================
  // Save recipe functionality
  // =======================================================================

  describe('Save recipe (paid user)', () => {
    const mockSave = vi.fn().mockReturnValue({ id: 'new-uuid' });
    const mockUpdate = vi.fn();

    beforeEach(() => {
      mockSave.mockClear();
      mockUpdate.mockClear();

      vi.doMock('../../../../hooks/useRecipes.js', () => ({
        useRecipes: () => ({
          recipes: [],
          save: mockSave,
          update: mockUpdate,
          remove: vi.fn(),
          exportAll: vi.fn(),
          importRecipes: vi.fn(),
        }),
        readRecipes: () => [],
      }));
    });

    it('renders save button for paid users', () => {
      setLicenseUnlocked();

      render(
        <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      const saveBtn = screen.getByTestId('save-button');
      expect(saveBtn).toBeInTheDocument();
      expect(saveBtn).toHaveTextContent('Save recipe');
    });

    it('shows "Recipe saved!" toast when save button is clicked', async () => {
      setLicenseUnlocked();

      render(
        <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      const saveBtn = screen.getByTestId('save-button');
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('step4-toast--visible');
      expect(toast).toHaveTextContent('Recipe saved!');
    });

    it('save toast auto-hides after 3 seconds', async () => {
      setLicenseUnlocked();

      render(
        <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('save-button'));
      });

      expect(screen.getByTestId('toast')).toHaveClass('step4-toast--visible');

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByTestId('toast')).not.toHaveClass('step4-toast--visible');
    });

    it('save button has correct aria-label', () => {
      setLicenseUnlocked();

      render(
        <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      expect(screen.getByRole('button', { name: 'Save recipe' })).toBeInTheDocument();
    });

    it('save button is in step 4b section for paid users', () => {
      setLicenseUnlocked();

      render(
        <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      const section4b = screen.getByTestId('step4b-pricing');
      expect(section4b.querySelector('[data-testid="save-button"]')).toBeInTheDocument();
    });

    it('save button is in step 4b section for free users (triggers paywall)', () => {
      setLicenseLocked();

      render(
        <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      const section4b = screen.getByTestId('step4b-pricing');
      expect(section4b.querySelector('[data-testid="save-button"]')).toBeInTheDocument();
    });

    it('save toast does not have paywall class', async () => {
      setLicenseUnlocked();

      render(
        <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('save-button'));
      });

      const toast = screen.getByTestId('toast');
      expect(toast).not.toHaveClass('step4-toast--paywall');
    });
  });

  // --- Analytics events ---

  describe('analytics events', () => {
    it('fires COPY_RESULT when copy button is clicked (paid user)', async () => {
      setLicenseUnlocked();
      mockClipboard();

      render(
        <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('copy-button'));
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('copy_result');
    });

    it('fires SAVE_RECIPE when save button is clicked (paid user)', async () => {
      setLicenseUnlocked();

      render(
        <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('save-button'));
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('save_recipe');
    });

    it('does not fire COPY_RESULT or SAVE_RECIPE for free users (paywall)', async () => {
      setLicenseLocked();

      render(
        <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
        { wrapper: Wrapper },
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('copy-button'));
      });

      expect(mockTrackEvent).not.toHaveBeenCalledWith('copy_result');
      expect(mockTrackEvent).not.toHaveBeenCalledWith('save_recipe');
    });
  });
});
