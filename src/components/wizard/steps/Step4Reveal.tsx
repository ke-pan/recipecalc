/**
 * Step 4 — Reveal: Cost comparison, pricing slider, and actions.
 *
 * Orchestrates a sequenced reveal animation:
 *   1. Skeleton shimmer (400ms)
 *   2. Left box fade-in (200ms) -> 150ms gap -> Right box fade-in (200ms)
 *   3. Number count-up (500ms)
 *   4. Gap bar slide-in (200ms)
 *   5. Recommended price scale-up + fade (300ms)
 *
 * Respects prefers-reduced-motion — skips to final state.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateTotalCosts, calculatePricing } from '../../../lib/calc/pricing.js';
import type { Recipe, CostBreakdown, PricingResult } from '../../../lib/calc/types.js';
import './step4.css';

export interface Step4Props {
  recipe: Recipe;
  onStartNew: () => void;
  onGoToStep: (step: number) => void;
}

/** Animation phase enum for sequenced reveal. */
type RevealPhase =
  | 'skeleton'
  | 'left-box'
  | 'right-box'
  | 'count-up'
  | 'gap-bar'
  | 'recommended'
  | 'complete';

/** Linear interpolation for count-up animation. */
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * Math.min(1, Math.max(0, t));
}

/** Format a number as currency ($X.XX). */
function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Check if user prefers reduced motion. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function Step4Reveal({ recipe, onStartNew, onGoToStep }: Step4Props) {
  // Calculate costs
  const costs: CostBreakdown = calculateTotalCosts(recipe);

  // Slider state
  const [targetCostRatio, setTargetCostRatio] = useState(0.3);
  const pricing: PricingResult = calculatePricing(
    costs.trueTotalCost,
    recipe.quantity,
    targetCostRatio,
  );

  // Animation state
  const [phase, setPhase] = useState<RevealPhase>('skeleton');
  const [countUpProgress, setCountUpProgress] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Determine if the full reveal sequence is done (for accessibility)
  const isComplete = phase === 'complete';

  // Run the reveal animation sequence on mount
  useEffect(() => {
    const reduced = prefersReducedMotion();

    if (reduced) {
      // Skip all animations — show final state immediately
      setPhase('complete');
      setCountUpProgress(1);
      return;
    }

    // Sequenced timers
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase 1: Skeleton shimmer (400ms)
    // Already in 'skeleton' phase

    // Phase 2a: Left box fade-in at 400ms
    timers.push(
      setTimeout(() => setPhase('left-box'), 400),
    );

    // Phase 2b: Right box fade-in at 400 + 200 + 150 = 750ms
    timers.push(
      setTimeout(() => setPhase('right-box'), 750),
    );

    // Phase 3: Count-up starts at 750 + 200 = 950ms
    timers.push(
      setTimeout(() => setPhase('count-up'), 950),
    );

    // Phase 4: Gap bar at 950 + 500 = 1450ms
    timers.push(
      setTimeout(() => setPhase('gap-bar'), 1450),
    );

    // Phase 5: Recommended price at 1450 + 200 = 1650ms
    timers.push(
      setTimeout(() => setPhase('recommended'), 1650),
    );

    // Phase complete at 1650 + 300 = 1950ms
    timers.push(
      setTimeout(() => setPhase('complete'), 1950),
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Count-up animation (runs when phase reaches 'count-up')
  useEffect(() => {
    if (phase !== 'count-up' && phase !== 'gap-bar' && phase !== 'recommended' && phase !== 'complete') {
      return;
    }

    if (countUpProgress >= 1) return;

    const reduced = prefersReducedMotion();
    if (reduced) {
      setCountUpProgress(1);
      return;
    }

    const duration = 500; // ms
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      setCountUpProgress(t);
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    }

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current != null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const text = [
      `Recipe: ${recipe.name}`,
      `Quantity: ${recipe.quantity} ${recipe.quantityUnit}`,
      ``,
      `Ingredient Cost: ${formatCurrency(costs.ingredientCost)}`,
      `True Total Cost: ${formatCurrency(costs.trueTotalCost)}`,
      `Hidden Cost Gap: ${formatCurrency(costs.trueTotalCost - costs.ingredientCost)}`,
      ``,
      `Target Cost Ratio: ${Math.round(targetCostRatio * 100)}%`,
      `Recommended Price/Unit: ${formatCurrency(pricing.recommendedPricePerUnit)}`,
      `Recommended Price/Batch: ${formatCurrency(pricing.recommendedPricePerBatch)}`,
      `Profit Margin: ${Math.round(pricing.profitMargin * 100)}%`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: silently fail (clipboard may not be available in all contexts)
    }

    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3000);
  }, [recipe, costs, pricing, targetCostRatio]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTargetCostRatio(Number(e.target.value));
    },
    [],
  );

  // Determine which elements are visible based on animation phase
  const phaseIndex = [
    'skeleton',
    'left-box',
    'right-box',
    'count-up',
    'gap-bar',
    'recommended',
    'complete',
  ].indexOf(phase);

  const showLeftBox = phaseIndex >= 1;
  const showRightBox = phaseIndex >= 2;
  const showSkeleton = phaseIndex < 1;
  const showGapBar = phaseIndex >= 4;
  const showRecommended = phaseIndex >= 5;

  // Animated values for count-up
  const displayIngredientCost = lerp(0, costs.ingredientCost, countUpProgress);
  const displayTrueCost = lerp(0, costs.trueTotalCost, countUpProgress);
  const gapAmount = costs.trueTotalCost - costs.ingredientCost;

  return (
    <div className="step4" data-testid="step4-reveal">
      {/* Cost comparison boxes */}
      <div className="step4-comparison" role="region" aria-label="Cost comparison">
        {showSkeleton ? (
          <>
            <div className="step4-skeleton" data-testid="skeleton-left" aria-hidden="true">
              <div className="step4-skeleton__line step4-skeleton__line--short" />
              <div className="step4-skeleton__line step4-skeleton__line--wide" />
            </div>
            <div className="step4-skeleton" data-testid="skeleton-right" aria-hidden="true">
              <div className="step4-skeleton__line step4-skeleton__line--short" />
              <div className="step4-skeleton__line step4-skeleton__line--wide" />
            </div>
          </>
        ) : (
          <>
            <div
              className={`step4-box ${showLeftBox ? 'step4-box--visible' : ''}`}
              data-testid="ingredient-cost-box"
            >
              <div className="step4-box__label">Ingredients Only</div>
              <div className="step4-box__amount" aria-live="polite">
                {formatCurrency(displayIngredientCost)}
              </div>
            </div>
            <div
              className={`step4-box ${showRightBox ? 'step4-box--visible' : ''}`}
              data-testid="true-cost-box"
            >
              <div className="step4-box__label">True Cost</div>
              <div className="step4-box__amount" aria-live="polite">
                {formatCurrency(displayTrueCost)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Gap bar */}
      <div className="step4-gap" data-testid="gap-section">
        <div
          className={`step4-gap__bar ${showGapBar ? 'step4-gap__bar--visible' : ''}`}
          data-testid="gap-bar"
          role="status"
          aria-label={`Hidden cost gap: ${formatCurrency(gapAmount)}`}
        >
          <span className="step4-gap__text">Hidden costs you're absorbing: </span>
          <span className="step4-gap__amount">{formatCurrency(gapAmount)}</span>
        </div>
      </div>

      {/* Recommended price */}
      <div
        className={`step4-recommended ${showRecommended ? 'step4-recommended--visible' : ''}`}
        data-testid="recommended-section"
      >
        <h3 className="step4-recommended__heading">Recommended Selling Price</h3>
        <div className="step4-recommended__price" data-testid="recommended-price-unit">
          {formatCurrency(pricing.recommendedPricePerUnit)}
        </div>
        <div className="step4-recommended__subtitle">
          per {recipe.quantityUnit.replace(/s$/, '')}
        </div>
        <div className="step4-recommended__batch" data-testid="recommended-price-batch">
          {formatCurrency(pricing.recommendedPricePerBatch)} per batch
        </div>
        <div className="step4-recommended__margin" data-testid="profit-margin">
          {Math.round(pricing.profitMargin * 100)}% profit margin
        </div>
      </div>

      {/* Target cost ratio slider */}
      <div className="step4-slider" data-testid="slider-section">
        <div className="step4-slider__header">
          <label htmlFor="cost-ratio-slider" className="step4-slider__label">
            Target cost ratio
          </label>
          <span className="step4-slider__value" data-testid="slider-value">
            {Math.round(targetCostRatio * 100)}%
          </span>
        </div>
        <input
          id="cost-ratio-slider"
          type="range"
          className="step4-slider__input"
          min="0.2"
          max="0.5"
          step="0.01"
          value={targetCostRatio}
          onChange={handleSliderChange}
          aria-valuemin={20}
          aria-valuemax={50}
          aria-valuenow={Math.round(targetCostRatio * 100)}
          aria-valuetext={`${Math.round(targetCostRatio * 100)}%`}
        />
        <div className="step4-slider__range">
          <span className="step4-slider__range-label">20% (higher margin)</span>
          <span className="step4-slider__range-label">50% (lower margin)</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="step4-actions" data-testid="actions-section">
        <button
          type="button"
          className="step4-btn step4-btn--copy"
          onClick={handleCopy}
          aria-label="Copy results to clipboard"
          data-testid="copy-button"
        >
          Copy results
        </button>
        <button
          type="button"
          className="step4-btn step4-btn--ghost"
          onClick={onStartNew}
          aria-label="Start a new recipe"
          data-testid="start-new-button"
        >
          Start a new recipe
        </button>
      </div>

      {/* Toast notification */}
      <div
        className={`step4-toast ${toastVisible ? 'step4-toast--visible' : ''}`}
        role="status"
        aria-live="polite"
        data-testid="toast"
      >
        Copied!
      </div>
    </div>
  );
}
