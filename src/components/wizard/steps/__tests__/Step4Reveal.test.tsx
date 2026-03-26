import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import Step4Reveal from '../Step4Reveal';
import type { Recipe } from '../../../../lib/calc/types.js';

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
    onStartNew.mockClear();
    onGoToStep.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- 1. Rendering ---

  it('renders the reveal container', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
    );

    expect(screen.getByTestId('step4-reveal')).toBeInTheDocument();
  });

  // --- 2. Cost calculation integration ---

  it('displays correct ingredient cost', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
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
    );

    // True cost: ingredients($5.85) + labor(2*$20=$40) + packaging($5) + overhead($3) + platform($2) = $55.85
    const trueCostBox = screen.getByTestId('true-cost-box');
    expect(trueCostBox).toHaveTextContent('$55.85');
  });

  // --- 3. Gap bar ---

  it('displays the hidden cost gap amount', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
    );

    // Gap = $55.85 - $5.85 = $50.00
    const gapBar = screen.getByTestId('gap-bar');
    expect(gapBar).toHaveTextContent('$50.00');
  });

  it('shows gap bar with accessible label', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
    );

    const gapBar = screen.getByTestId('gap-bar');
    expect(gapBar).toHaveAttribute('aria-label', 'Hidden cost gap: $50.00');
  });

  // --- 4. Recommended pricing ---

  it('displays recommended price per unit at default 30% cost ratio', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
    );

    // Cost per unit: $55.85 / 24 = $2.33 (rounded)
    // Recommended price: $2.33 / 0.3 = $7.77
    const priceUnit = screen.getByTestId('recommended-price-unit');
    expect(priceUnit).toHaveTextContent('$7.77');
  });

  it('displays recommended price per batch', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
    );

    // $7.77 * 24 = $186.48
    const priceBatch = screen.getByTestId('recommended-price-batch');
    expect(priceBatch).toHaveTextContent('$186.48');
  });

  it('displays profit margin', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
    );

    // 1 - 0.3 = 0.7 = 70%
    const margin = screen.getByTestId('profit-margin');
    expect(margin).toHaveTextContent('70% profit margin');
  });

  // --- 5. Slider ---

  it('renders the slider at default 30%', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
    );

    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('0.3');
    expect(screen.getByTestId('slider-value')).toHaveTextContent('30%');
  });

  it('updates pricing when slider is changed', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
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
    );

    fireEvent.click(screen.getByTestId('start-new-button'));
    expect(onStartNew).toHaveBeenCalledTimes(1);
  });

  // --- 8. Animation sequence ---

  it('shows skeleton initially when animations are enabled', () => {
    mockMatchMedia(false); // Enable animations

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
    );

    expect(screen.getByTestId('skeleton-left')).toBeInTheDocument();
    expect(screen.getByTestId('skeleton-right')).toBeInTheDocument();
  });

  it('reveals left box after skeleton phase', () => {
    mockMatchMedia(false);

    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
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
    );

    expect(screen.getByTestId('ingredient-cost-box')).toHaveTextContent('$0.00');
    // True cost = labor(40) + packaging(5) + overhead(3) + platform(2) = $50.00
    expect(screen.getByTestId('true-cost-box')).toHaveTextContent('$50.00');
  });

  // --- 12. Slider boundary values ---

  it('clamps cost ratio to valid range at boundaries', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
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
    );

    expect(screen.getByRole('region', { name: 'Cost comparison' })).toBeInTheDocument();
  });

  // --- 14. Quantity unit displayed correctly ---

  it('displays the quantity unit in recommended section', () => {
    render(
      <Step4Reveal recipe={makeRecipe()} onStartNew={onStartNew} onGoToStep={onGoToStep} />,
    );

    // "cookies" -> "cookie" (singular)
    expect(screen.getByTestId('recommended-section')).toHaveTextContent('per cookie');
  });
});
