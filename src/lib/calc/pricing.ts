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

/**
 * Calculate the cost of a single ingredient, including waste.
 *
 * Formula: purchasePrice × (usedAmount / purchaseAmount) × (1 + wastePercent / 100)
 *
 * Assumes usedAmount and purchaseAmount are in the same unit
 * (unit conversion happens at the call site).
 *
 * @throws {Error} if purchaseAmount is zero or negative
 * @throws {Error} if any numeric field is negative
 */
export function calculateIngredientCost(ingredient: Ingredient): number {
  const { purchasePrice, purchaseAmount, usedAmount, wastePercent } =
    ingredient;

  if (purchaseAmount <= 0) {
    throw new Error(
      `Invalid purchaseAmount (${purchaseAmount}): must be positive`
    );
  }
  if (purchasePrice < 0) {
    throw new Error(
      `Invalid purchasePrice (${purchasePrice}): must not be negative`
    );
  }
  if (usedAmount < 0) {
    throw new Error(
      `Invalid usedAmount (${usedAmount}): must not be negative`
    );
  }
  if (wastePercent < 0) {
    throw new Error(
      `Invalid wastePercent (${wastePercent}): must not be negative`
    );
  }

  const baseCost = purchasePrice * (usedAmount / purchaseAmount);
  const costWithWaste = baseCost * (1 + wastePercent / 100);
  return roundCents(costWithWaste);
}

/**
 * Calculate the full cost breakdown for a recipe batch.
 *
 * @throws {Error} if any cost input is negative
 * @throws {Error} if batchTimeHours is negative
 */
export function calculateTotalCosts(recipe: Recipe): CostBreakdown {
  const { ingredients, laborAndOverhead, batchTimeHours } = recipe;
  const { hourlyRate, packaging, overhead, platformFees } = laborAndOverhead;

  // Validate non-negative inputs
  if (batchTimeHours < 0) {
    throw new Error(
      `Invalid batchTimeHours (${batchTimeHours}): must not be negative`
    );
  }
  if (hourlyRate < 0) {
    throw new Error(
      `Invalid hourlyRate (${hourlyRate}): must not be negative`
    );
  }
  if (packaging < 0) {
    throw new Error(
      `Invalid packaging (${packaging}): must not be negative`
    );
  }
  if (overhead < 0) {
    throw new Error(
      `Invalid overhead (${overhead}): must not be negative`
    );
  }
  if (platformFees < 0) {
    throw new Error(
      `Invalid platformFees (${platformFees}): must not be negative`
    );
  }

  // Sum ingredient costs (empty array → 0)
  const ingredientCost = roundCents(
    ingredients.reduce((sum, ing) => sum + calculateIngredientCost(ing), 0)
  );

  const laborCost = roundCents(batchTimeHours * hourlyRate);
  const packagingCost = roundCents(packaging);
  const overheadCost = roundCents(overhead);
  const platformFeesCost = roundCents(platformFees);

  const trueTotalCost = roundCents(
    ingredientCost + laborCost + packagingCost + overheadCost + platformFeesCost
  );

  return {
    ingredientCost,
    laborCost,
    packagingCost,
    overheadCost,
    platformFees: platformFeesCost,
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
 *   - 0.30 means costs are 30% of price → 70% gross margin
 *   - Valid range: 0.20–0.50 (clamped)
 *
 * @throws {Error} if quantity is zero or negative
 * @throws {Error} if targetCostRatio is zero or negative
 * @throws {Error} if trueTotalCost is negative
 */
export function calculatePricing(
  trueTotalCost: number,
  quantity: number,
  targetCostRatio: number
): PricingResult {
  if (quantity <= 0) {
    throw new Error(`Invalid quantity (${quantity}): must be positive`);
  }
  if (targetCostRatio <= 0) {
    throw new Error(
      `Invalid targetCostRatio (${targetCostRatio}): must be positive`
    );
  }
  if (trueTotalCost < 0) {
    throw new Error(
      `Invalid trueTotalCost (${trueTotalCost}): must not be negative`
    );
  }

  // Clamp targetCostRatio to valid range
  const clampedRatio = Math.min(
    MAX_COST_RATIO,
    Math.max(MIN_COST_RATIO, targetCostRatio)
  );

  const costPerUnit = roundCents(trueTotalCost / quantity);
  const recommendedPricePerUnit = roundCents(costPerUnit / clampedRatio);
  const recommendedPricePerBatch = roundCents(
    recommendedPricePerUnit * quantity
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
