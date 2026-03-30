/**
 * Cost calculation and pricing logic for RecipeCalc.
 *
 * Pure functions — no side effects, no UI dependencies.
 * All monetary outputs are rounded to 2 decimal places (cent precision).
 */

import type {
  Ingredient,
  Recipe,
  CostBreakdown,
  PricingResult,
} from "./types.js";

/** Round a number to 2 decimal places (cent precision). */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Throw if a numeric field is negative, or non-positive when `mustBePositive` is set. */
function assertNonNegative(
  name: string,
  value: number,
  mustBePositive = false,
): void {
  if (mustBePositive && value <= 0) {
    throw new Error(`Invalid ${name} (${value}): must be positive`);
  }
  if (!mustBePositive && value < 0) {
    throw new Error(`Invalid ${name} (${value}): must not be negative`);
  }
}

/**
 * Calculate the cost of a single ingredient, including waste.
 *
 * Formula: purchasePrice x (usedAmount / purchaseAmount) x (1 + wastePercent / 100)
 *
 * Assumes usedAmount and purchaseAmount are in the same unit
 * (unit conversion happens at the call site).
 */
export function calculateIngredientCost(ingredient: Ingredient): number {
  const { purchasePrice, purchaseAmount, usedAmount, wastePercent } =
    ingredient;

  assertNonNegative("purchaseAmount", purchaseAmount, true);
  assertNonNegative("purchasePrice", purchasePrice);
  assertNonNegative("usedAmount", usedAmount);
  assertNonNegative("wastePercent", wastePercent);

  const baseCost = purchasePrice * (usedAmount / purchaseAmount);
  const costWithWaste = baseCost * (1 + wastePercent / 100);
  return roundCents(costWithWaste);
}

/** Calculate the full cost breakdown for a recipe batch. */
export function calculateTotalCosts(recipe: Recipe): CostBreakdown {
  const { ingredients, laborAndOverhead, batchTimeHours } = recipe;
  const { hourlyRate, packaging, overhead, platformFees } = laborAndOverhead;

  assertNonNegative("batchTimeHours", batchTimeHours);
  assertNonNegative("hourlyRate", hourlyRate);
  assertNonNegative("packaging", packaging);
  assertNonNegative("overhead", overhead);
  assertNonNegative("platformFees", platformFees);

  const ingredientCost = roundCents(
    ingredients.reduce((sum, ing) => sum + calculateIngredientCost(ing), 0)
  );
  const laborCost = roundCents(batchTimeHours * hourlyRate);
  const trueTotalCost = roundCents(
    ingredientCost + laborCost + packaging + overhead + platformFees
  );

  return {
    ingredientCost,
    laborCost,
    packagingCost: packaging,
    overheadCost: overhead,
    platformFees,
    trueTotalCost,
  };
}

/** Valid range for target cost ratio. */
const MIN_COST_RATIO = 0.2;
const MAX_COST_RATIO = 0.5;

/**
 * Calculate recommended pricing from total cost, quantity, and target cost ratio.
 *
 * target_cost_ratio = what fraction of the selling price is cost.
 *   - 0.30 means costs are 30% of price -> 70% gross margin
 *   - Valid range: 0.20-0.50 (clamped)
 */
export function calculatePricing(
  trueTotalCost: number,
  quantity: number,
  targetCostRatio: number,
): PricingResult {
  assertNonNegative("quantity", quantity, true);
  assertNonNegative("targetCostRatio", targetCostRatio, true);
  assertNonNegative("trueTotalCost", trueTotalCost);

  const clampedRatio = Math.min(
    MAX_COST_RATIO,
    Math.max(MIN_COST_RATIO, targetCostRatio),
  );

  const costPerUnit = roundCents(trueTotalCost / quantity);
  const recommendedPricePerUnit = roundCents(costPerUnit / clampedRatio);
  const recommendedPricePerBatch = roundCents(
    recommendedPricePerUnit * quantity,
  );
  const profitPerUnit = roundCents(recommendedPricePerUnit - costPerUnit);
  const profitMargin = roundCents(1 - clampedRatio);

  return {
    costPerUnit,
    recommendedPricePerUnit,
    recommendedPricePerBatch,
    profitPerUnit,
    profitMargin,
  };
}
