/**
 * Step 4 — Reveal: Cost comparison, pricing slider, and actions.
 *
 * Split into two sections:
 *   - **Step 4a (THE REVEAL)**: Always free — animation sequence, cost comparison,
 *     gap bar, and "What can I do about this?" CTA.
 *   - **Step 4b (PRICING & ACTIONS)**: Gated by license — recommended selling price,
 *     target cost ratio slider, copy results. Shows placeholder when locked.
 *
 * Shared actions (all users): "Start a new recipe"
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
import { formatCurrency } from '../../../lib/format.js';
import { useLicense } from '../../../contexts/LicenseContext.js';
import { useRecipes } from '../../../hooks/useRecipes.js';
import { trackEvent, EVENTS } from '../../../lib/analytics';
import NudgeBanner from '../NudgeBanner.js';
import PaywallCard from '../PaywallCard.js';
import './step4.css';

/** Toast message variants. */
type ToastVariant = 'success' | 'paywall' | 'saved';

export interface Step4Props {
  recipe: Recipe;
  onStartNew: () => void;
  onGoToStep: (step: number) => void;
  /** When editing a previously saved recipe, this is the saved recipe's ID. */
  editingRecipeId?: string | null;
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

/** Check if user prefers reduced motion. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const PHASE_ORDER: Record<RevealPhase, number> = {
  skeleton: 0,
  'left-box': 1,
  'right-box': 2,
  'count-up': 3,
  'gap-bar': 4,
  recommended: 5,
  complete: 6,
};

/** LemonSqueezy checkout URL from environment. */
const CHECKOUT_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_LS_CHECKOUT_URL
    ? String(import.meta.env.PUBLIC_LS_CHECKOUT_URL)
    : '';

/** Detect edge case: all hidden costs are zero. */
function allHiddenCostsZero(recipe: Recipe): boolean {
  const { hourlyRate, packaging, overhead, platformFees } = recipe.laborAndOverhead;
  return hourlyRate === 0 && packaging === 0 && overhead === 0 && platformFees === 0;
}

/** Detect edge case: batch time is zero. */
function batchTimeZero(recipe: Recipe): boolean {
  return recipe.batchTimeHours === 0;
}

/** Detect edge case: ingredient cost >= true total cost. */
function ingredientCostExceedsTrueTotal(costs: CostBreakdown): boolean {
  return costs.ingredientCost >= costs.trueTotalCost;
}

export default function Step4Reveal({ recipe, onStartNew, onGoToStep, editingRecipeId }: Step4Props) {
  const { isUnlocked } = useLicense();
  const { save, update } = useRecipes();
  const costs: CostBreakdown = calculateTotalCosts(recipe);

  // Slider state
  const [targetCostRatio, setTargetCostRatio] = useState(0.3);
  const pricing: PricingResult = calculatePricing(
    costs.trueTotalCost,
    recipe.quantity,
    targetCostRatio,
  );

  // Nudge dismissed state — each scenario independent
  const [nudge1Dismissed, setNudge1Dismissed] = useState(false);
  const [nudge2Dismissed, setNudge2Dismissed] = useState(false);
  const [nudge3Dismissed, setNudge3Dismissed] = useState(false);
  const [nudge4Dismissed, setNudge4Dismissed] = useState(false);

  // Edge case detection
  const showNudge1 = !nudge1Dismissed && allHiddenCostsZero(recipe);
  const showNudge2 = !nudge2Dismissed && batchTimeZero(recipe);
  const isVariantB = ingredientCostExceedsTrueTotal(costs);
  const showNudge3 = !nudge3Dismissed && isVariantB;
  const showNudge4 = !nudge4Dismissed && isUnlocked && pricing.recommendedPricePerUnit < 1.0;

  // Animation state
  const [phase, setPhase] = useState<RevealPhase>('skeleton');
  const [countUpProgress, setCountUpProgress] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastVariant, setToastVariant] = useState<ToastVariant>('success');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const section4bRef = useRef<HTMLElement>(null);

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

  // Count-up animation (runs when phase reaches 'count-up' or later)
  useEffect(() => {
    if (PHASE_ORDER[phase] < PHASE_ORDER['count-up']) return;

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

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  /** Show a toast with the given variant, auto-hide after duration. */
  const showToast = useCallback((variant: ToastVariant, duration = 3000) => {
    setToastVariant(variant);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), duration);
  }, []);

  /** Free-user handler: intercept copy/save and show paywall toast instead. */
  const handlePaywallTrigger = useCallback(() => {
    showToast('paywall', 4000);
  }, [showToast]);

  /** Paid-user handler: save recipe to localStorage recipe library. */
  const handleSave = useCallback(() => {
    trackEvent(EVENTS.SAVE_RECIPE);
    if (editingRecipeId) {
      update(editingRecipeId, recipe, targetCostRatio);
    } else {
      save(recipe, targetCostRatio);
    }
    showToast('saved');
  }, [editingRecipeId, recipe, targetCostRatio, save, update, showToast]);

  const handleCopy = useCallback(async () => {
    trackEvent(EVENTS.COPY_RESULT);
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

    showToast('success');
  }, [recipe, costs, pricing, targetCostRatio, showToast]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTargetCostRatio(Number(e.target.value));
    },
    [],
  );

  const handleScrollTo4b = useCallback(() => {
    section4bRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const phaseIndex = PHASE_ORDER[phase];

  const showSkeleton = phaseIndex < 1;
  const showLeftBox = phaseIndex >= 1;
  const showRightBox = phaseIndex >= 2;
  const showGapBar = phaseIndex >= 4;
  const showRecommended = phaseIndex >= 5;

  // Animated values for count-up
  const displayIngredientCost = lerp(0, costs.ingredientCost, countUpProgress);
  const displayTrueCost = lerp(0, costs.trueTotalCost, countUpProgress);
  const gapAmount = costs.trueTotalCost - costs.ingredientCost;

  return (
    <div className="step4" data-testid="step4-reveal">
      {/* ================================================================
          Step 4a — THE REVEAL (always free)
          ================================================================ */}
      <section className="step4a" data-testid="step4a-reveal" aria-label="The Reveal">
        {/* Edge case nudges (scenarios 1-3) */}
        {showNudge1 && (
          <NudgeBanner
            message="Are you sure there are no labor or packaging costs? Most bakers have at least some."
            onDismiss={() => setNudge1Dismissed(true)}
            testId="nudge-all-hidden-zero"
          />
        )}
        {showNudge2 && (
          <NudgeBanner
            message="A batch time of 0 means your time is free. Sure about that?"
            onDismiss={() => setNudge2Dismissed(true)}
            testId="nudge-batch-time-zero"
          />
        )}
        {showNudge3 && (
          <NudgeBanner
            message="Your hidden costs are unusually low — double-check your labor and packaging?"
            onDismiss={() => setNudge3Dismissed(true)}
            cta={{ label: 'Revisit hidden costs \u2192', onClick: () => onGoToStep(2) }}
            testId="nudge-low-hidden-costs"
          />
        )}

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
                className={`step4-box ${showLeftBox ? 'step4-box--visible' : ''}${isVariantB ? ' step4-box--neutral' : ''}`}
                data-testid="ingredient-cost-box"
              >
                <div className="step4-box__label">Ingredients Only</div>
                <div className="step4-box__amount" aria-live="polite">
                  {formatCurrency(displayIngredientCost)}
                </div>
              </div>
              <div
                className={`step4-box ${showRightBox ? 'step4-box--visible' : ''}${isVariantB ? ' step4-box--neutral' : ''}`}
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

        {/* CTA to scroll to 4b */}
        <button
          type="button"
          className="step4a-cta"
          onClick={handleScrollTo4b}
          data-testid="step4a-cta"
        >
          What can I do about this? <span aria-hidden="true">↓</span>
        </button>
      </section>

      {/* ================================================================
          Step 4b — PRICING & ACTIONS (gated by license)
          ================================================================ */}
      <section
        className="step4b"
        data-testid="step4b-pricing"
        aria-label="Pricing and Actions"
        ref={section4bRef}
      >
        {isUnlocked ? (
          <>
            {/* Edge case nudge (scenario 4): recommended price < $1/unit */}
            {showNudge4 && (
              <NudgeBanner
                message="This seems very low — consider whether your batch size is accurate."
                onDismiss={() => setNudge4Dismissed(true)}
                testId="nudge-low-price"
              />
            )}

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

            {/* Copy & Save buttons (paid users only) */}
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
                className="step4-btn step4-btn--copy"
                onClick={handleSave}
                aria-label="Save recipe"
                data-testid="save-button"
              >
                Save recipe
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Recommended price — blurred for free users */}
            <div
              className={`step4-recommended step4-recommended--visible blurred-price`}
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

            {/* Target cost ratio slider — locked for free users */}
            <div className="step4-slider locked-slider" data-testid="slider-section">
              <div className="step4-slider__header">
                <label htmlFor="cost-ratio-slider-locked" className="step4-slider__label">
                  Target cost ratio <span className="locked-slider__icon" aria-label="Locked">&#x1F512;</span>
                </label>
                <span className="step4-slider__value" data-testid="slider-value">
                  {Math.round(targetCostRatio * 100)}%
                </span>
              </div>
              <input
                id="cost-ratio-slider-locked"
                type="range"
                className="step4-slider__input"
                min="0.2"
                max="0.5"
                step="0.01"
                value={targetCostRatio}
                disabled
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

            {/* Copy button — triggers paywall toast for free users */}
            <div className="step4-actions" data-testid="actions-section">
              <button
                type="button"
                className="step4-btn step4-btn--copy"
                onClick={handlePaywallTrigger}
                aria-label="Copy results to clipboard"
                data-testid="copy-button"
              >
                Copy results
              </button>
              <button
                type="button"
                className="step4-btn step4-btn--copy"
                onClick={handlePaywallTrigger}
                aria-label="Save results"
                data-testid="save-button"
              >
                Save results
              </button>
            </div>

            {/* Paywall Card — inline dashed-border card below blurred pricing */}
            <PaywallCard checkoutUrl={CHECKOUT_URL} />
          </>
        )}
      </section>

      {/* ================================================================
          Shared actions — all users
          ================================================================ */}
      <div className="step4-shared-actions" data-testid="shared-actions-section">
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
        className={`step4-toast ${toastVisible ? 'step4-toast--visible' : ''} ${toastVariant === 'paywall' ? 'step4-toast--paywall' : ''}`}
        role="status"
        aria-live="polite"
        data-testid="toast"
      >
        {toastVariant === 'paywall' ? (
          <>
            Unlock with a license key{' '}
            <a href="/activate" className="step4-toast__link" data-testid="toast-activate-link">
              Activate
            </a>
          </>
        ) : toastVariant === 'saved' ? (
          'Recipe saved!'
        ) : (
          'Copied!'
        )}
      </div>
    </div>
  );
}
