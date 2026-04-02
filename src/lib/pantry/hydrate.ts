/**
 * Hydration layer: bridges Pantry data into the Recipe calculation pipeline.
 *
 * When an Ingredient references a PantryItem (via pantryId), hydration replaces
 * the inline purchase info (amount, unit, price) with the Pantry's current values.
 * This keeps Pantry as the single source of truth for pricing while leaving the
 * existing calculateTotalCosts() engine unchanged.
 *
 * Graceful degradation:
 * - No pantryId → pass through unchanged
 * - pantryId points to deleted item → fall back to inline price + warning
 * - Unit incompatible → fall back to inline price + warning
 */

import type { Ingredient, Recipe } from '../calc/types.js';
import { canConvert } from '../units/converter.js';

// ---------------------------------------------------------------------------
// PantryItem (local definition — will be imported from shared types later)
// ---------------------------------------------------------------------------

/** A single item in the user's ingredient pantry. */
export interface PantryItem {
  id: string;
  name: string;
  /** Stable semantic key (e.g. "all-purpose-flour") for density table lookups. */
  ingredientKey: string;
  /** Unit of the purchase (e.g. "lb", "cup") */
  purchaseUnit: string;
  /** Amount purchased (e.g. 5 for "5 lb bag") */
  purchaseAmount: number;
  /** Price paid for the purchase amount */
  purchasePrice: number;
  /** ISO timestamp of last update */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Warning types
// ---------------------------------------------------------------------------

/** Reasons hydration could not use Pantry data and fell back to inline values. */
export type HydrationWarningType = 'pantry_deleted' | 'unit_incompatible';

// ---------------------------------------------------------------------------
// Result types (don't pollute Ingredient — Codex #2)
// ---------------------------------------------------------------------------

export interface HydrationResult {
  ingredient: Ingredient;
  warning?: HydrationWarningType;
}

export interface RecipeHydrationResult {
  /** Hydrated recipe — can be passed directly to calculateTotalCosts(). */
  recipe: Recipe;
  /** Warnings collected across all ingredients. */
  warnings: Array<{ ingredientName: string; warning: HydrationWarningType }>;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Hydrate a single ingredient with Pantry data.
 *
 * - No `pantryId` → return original ingredient unchanged.
 * - `pantryId` points to missing PantryItem → return original + `pantry_deleted` warning.
 * - Units incompatible (purchase vs used) → return original + `unit_incompatible` warning.
 * - Otherwise → replace purchaseAmount/Unit/Price from Pantry.
 */
export function hydrateIngredient(
  ingredient: Ingredient,
  pantry: PantryItem[],
): HydrationResult {
  // No Pantry reference → pass through
  if (!ingredient.pantryId) {
    return { ingredient };
  }

  const pantryItem = pantry.find((p) => p.id === ingredient.pantryId);

  // Pantry item deleted → fall back to inline price + warning
  if (!pantryItem) {
    return { ingredient, warning: 'pantry_deleted' };
  }

  // Check unit compatibility using ingredientKey for density lookup (Codex #1)
  const densityKey = ingredient.ingredientKey || pantryItem.ingredientKey;
  const compatible = canConvert(
    pantryItem.purchaseUnit,
    ingredient.usedUnit,
    densityKey,
  );

  if (!compatible) {
    // Units incompatible → fall back to inline price + warning
    return { ingredient, warning: 'unit_incompatible' };
  }

  // Hydrate: replace purchase info from Pantry
  return {
    ingredient: {
      ...ingredient,
      purchaseAmount: pantryItem.purchaseAmount,
      purchaseUnit: pantryItem.purchaseUnit,
      purchasePrice: pantryItem.purchasePrice,
    },
  };
}

/**
 * Hydrate all ingredients in a recipe.
 *
 * Returns a new Recipe (with hydrated ingredients) plus any collected warnings.
 * The returned recipe can be passed directly to `calculateTotalCosts()`.
 */
export function hydrateRecipe(
  recipe: Recipe,
  pantry: PantryItem[],
): RecipeHydrationResult {
  const warnings: RecipeHydrationResult['warnings'] = [];

  const hydratedIngredients = recipe.ingredients.map((ing) => {
    const result = hydrateIngredient(ing, pantry);
    if (result.warning) {
      warnings.push({ ingredientName: ing.name, warning: result.warning });
    }
    return result.ingredient;
  });

  return {
    recipe: { ...recipe, ingredients: hydratedIngredients },
    warnings,
  };
}
