/**
 * Core types for RecipePricer cost calculation and pricing.
 *
 * These types model the data flowing through the 4-step wizard:
 *   Step 1: Recipe info (name, quantity, batch time)
 *   Step 2: Ingredients
 *   Step 3: Labor & overhead
 *   Step 4: Reveal (CostBreakdown + PricingResult)
 */

/** A single ingredient with purchase info and usage info. */
export interface Ingredient {
  id: string;
  name: string;
  /** Amount purchased (e.g. 5 for "5 lb bag") */
  purchaseAmount: number;
  /** Unit of purchase amount (e.g. "lb") */
  purchaseUnit: string;
  /** Price paid for the purchase amount */
  purchasePrice: number;
  /** Amount used in this recipe batch */
  usedAmount: number;
  /** Unit of used amount — assumed already converted to same unit as purchaseUnit */
  usedUnit: string;
  /** Waste percentage (0–100). 10 means 10% waste. */
  wastePercent: number;
  /** Reference to a Pantry item's ID. When set, hydration replaces purchase info from Pantry. */
  pantryId?: string | null;
  /** Stable semantic key (e.g. "all-purpose-flour") for density table lookups. */
  ingredientKey?: string;
}

/** Labor, packaging, and overhead costs for a recipe batch. */
export interface LaborAndOverhead {
  /** Hourly rate for the baker's time ($/hr) */
  hourlyRate: number;
  /** Packaging cost per batch ($) */
  packaging: number;
  /** Overhead cost per batch ($ — utilities, rent allocation, etc.) */
  overhead: number;
  /** Platform/marketplace fees per batch ($ — fixed amount in MVP) */
  platformFees: number;
}

/** A complete recipe as entered by the user. */
export interface Recipe {
  name: string;
  /** Number of units produced per batch (e.g. 24 cookies) */
  quantity: number;
  /** Unit label (e.g. "cookies", "loaves") */
  quantityUnit: string;
  /** Total batch preparation time in hours */
  batchTimeHours: number;
  /** List of ingredients with amounts and prices */
  ingredients: Ingredient[];
  /** Labor and overhead costs */
  laborAndOverhead: LaborAndOverhead;
}

/** Breakdown of all costs for a recipe batch. */
export interface CostBreakdown {
  /** Total ingredient cost (with waste) */
  ingredientCost: number;
  /** Labor cost = batchTimeHours × hourlyRate */
  laborCost: number;
  /** Packaging cost per batch */
  packagingCost: number;
  /** Overhead cost per batch */
  overheadCost: number;
  /** Platform fees per batch */
  platformFees: number;
  /** Sum of all costs */
  trueTotalCost: number;
}

/** Pricing recommendation based on target cost ratio. */
export interface PricingResult {
  /** Cost per unit = trueTotalCost / quantity */
  costPerUnit: number;
  /** Recommended price per unit = costPerUnit / targetCostRatio */
  recommendedPricePerUnit: number;
  /** Recommended price for the full batch */
  recommendedPricePerBatch: number;
  /** Profit per unit = recommendedPricePerUnit - costPerUnit */
  profitPerUnit: number;
  /** Profit margin = 1 - targetCostRatio */
  profitMargin: number;
}
