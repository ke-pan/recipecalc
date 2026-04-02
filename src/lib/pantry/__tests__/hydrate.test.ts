import { describe, it, expect } from 'vitest';
import {
  hydrateIngredient,
  hydrateRecipe,
  type PantryItem,
} from '../hydrate.js';
import type { Ingredient, Recipe } from '../../calc/types.js';
import { calculateTotalCosts, calculateIngredientCost } from '../../calc/pricing.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: 'ing-1',
    name: 'All-Purpose Flour',
    purchaseAmount: 5,
    purchaseUnit: 'lb',
    purchasePrice: 3.49,
    usedAmount: 1.5,
    usedUnit: 'lb',
    wastePercent: 0,
    ...overrides,
  };
}

function makePantryItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    id: 'pantry-flour',
    name: 'All-Purpose Flour',
    ingredientKey: 'all-purpose-flour',
    purchaseUnit: 'lb',
    purchaseAmount: 10,
    purchasePrice: 5.99,
    updatedAt: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    name: 'Test Cookies',
    quantity: 24,
    quantityUnit: 'cookies',
    batchTimeHours: 1,
    ingredients: [
      makeIngredient({
        id: 'ing-1',
        name: 'Flour',
        pantryId: 'pantry-flour',
        ingredientKey: 'all-purpose-flour',
      }),
      makeIngredient({
        id: 'ing-2',
        name: 'Sugar',
        purchaseAmount: 4,
        purchaseUnit: 'lb',
        purchasePrice: 3.29,
        usedAmount: 0.75,
        usedUnit: 'lb',
        wastePercent: 0,
        pantryId: 'pantry-sugar',
        ingredientKey: 'sugar',
      }),
      makeIngredient({
        id: 'ing-3',
        name: 'Vanilla',
        purchaseAmount: 8,
        purchaseUnit: 'oz',
        purchasePrice: 8.99,
        usedAmount: 0.5,
        usedUnit: 'oz',
        wastePercent: 0,
      }), // no pantryId — inline pricing
    ],
    laborAndOverhead: {
      hourlyRate: 15,
      packaging: 2,
      overhead: 1,
      platformFees: 0,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// hydrateIngredient
// ---------------------------------------------------------------------------

describe('hydrateIngredient', () => {
  it('passes through ingredient with no pantryId', () => {
    const ing = makeIngredient(); // no pantryId
    const pantry = [makePantryItem()];

    const result = hydrateIngredient(ing, pantry);

    expect(result.ingredient).toEqual(ing);
    expect(result.warning).toBeUndefined();
  });

  it('passes through ingredient with null pantryId', () => {
    const ing = makeIngredient({ pantryId: null });
    const pantry = [makePantryItem()];

    const result = hydrateIngredient(ing, pantry);

    expect(result.ingredient).toEqual(ing);
    expect(result.warning).toBeUndefined();
  });

  it('passes through ingredient with undefined pantryId', () => {
    const ing = makeIngredient({ pantryId: undefined });
    const pantry = [makePantryItem()];

    const result = hydrateIngredient(ing, pantry);

    expect(result.ingredient).toEqual(ing);
    expect(result.warning).toBeUndefined();
  });

  it('replaces purchase info from Pantry when pantryId matches (same unit category)', () => {
    const ing = makeIngredient({
      pantryId: 'pantry-flour',
      ingredientKey: 'all-purpose-flour',
      purchaseAmount: 5,
      purchaseUnit: 'lb',
      purchasePrice: 3.49,
    });
    const pantryItem = makePantryItem({
      id: 'pantry-flour',
      purchaseAmount: 10,
      purchaseUnit: 'lb',
      purchasePrice: 5.99,
    });

    const result = hydrateIngredient(ing, [pantryItem]);

    expect(result.warning).toBeUndefined();
    expect(result.ingredient.purchaseAmount).toBe(10);
    expect(result.ingredient.purchaseUnit).toBe('lb');
    expect(result.ingredient.purchasePrice).toBe(5.99);
    // Other fields should remain unchanged
    expect(result.ingredient.id).toBe(ing.id);
    expect(result.ingredient.name).toBe(ing.name);
    expect(result.ingredient.usedAmount).toBe(ing.usedAmount);
    expect(result.ingredient.usedUnit).toBe(ing.usedUnit);
    expect(result.ingredient.wastePercent).toBe(ing.wastePercent);
    expect(result.ingredient.pantryId).toBe('pantry-flour');
    expect(result.ingredient.ingredientKey).toBe('all-purpose-flour');
  });

  it('returns pantry_deleted warning when pantryId points to missing item', () => {
    const ing = makeIngredient({
      pantryId: 'pantry-deleted-item',
      ingredientKey: 'all-purpose-flour',
    });
    const pantry = [makePantryItem({ id: 'pantry-flour' })]; // different ID

    const result = hydrateIngredient(ing, pantry);

    expect(result.warning).toBe('pantry_deleted');
    // Should return original ingredient unchanged
    expect(result.ingredient).toEqual(ing);
  });

  it('returns pantry_deleted warning with empty pantry array', () => {
    const ing = makeIngredient({
      pantryId: 'pantry-flour',
    });

    const result = hydrateIngredient(ing, []);

    expect(result.warning).toBe('pantry_deleted');
    expect(result.ingredient).toEqual(ing);
  });

  it('returns unit_incompatible warning when units cannot be converted', () => {
    // count (each) cannot convert to weight (lb)
    const ing = makeIngredient({
      pantryId: 'pantry-eggs',
      ingredientKey: 'eggs',
      usedUnit: 'each',
    });
    const pantryItem = makePantryItem({
      id: 'pantry-eggs',
      ingredientKey: 'eggs',
      purchaseUnit: 'lb', // weight vs count — incompatible
      purchaseAmount: 2,
      purchasePrice: 4.99,
    });

    const result = hydrateIngredient(ing, [pantryItem]);

    expect(result.warning).toBe('unit_incompatible');
    // Should return original ingredient unchanged
    expect(result.ingredient).toEqual(ing);
  });

  it('allows cross-category conversion when density data exists (weight -> volume)', () => {
    // All-purpose flour has density data, so weight<->volume is possible
    const ing = makeIngredient({
      pantryId: 'pantry-flour',
      ingredientKey: 'all-purpose-flour',
      usedUnit: 'cup', // volume
    });
    const pantryItem = makePantryItem({
      id: 'pantry-flour',
      ingredientKey: 'all-purpose-flour',
      purchaseUnit: 'lb', // weight
      purchaseAmount: 5,
      purchasePrice: 3.49,
    });

    const result = hydrateIngredient(ing, [pantryItem]);

    // Weight<->volume for all-purpose-flour has density data, so canConvert = true
    expect(result.warning).toBeUndefined();
    expect(result.ingredient.purchaseAmount).toBe(5);
    expect(result.ingredient.purchaseUnit).toBe('lb');
    expect(result.ingredient.purchasePrice).toBe(3.49);
  });

  it('falls back to inline price when cross-category lacks density data', () => {
    // "custom-spice" has no density data
    const ing = makeIngredient({
      pantryId: 'pantry-spice',
      ingredientKey: 'custom-spice', // not in density table
      usedUnit: 'cup', // volume
    });
    const pantryItem = makePantryItem({
      id: 'pantry-spice',
      ingredientKey: 'custom-spice',
      purchaseUnit: 'g', // weight — cross-category, no density
      purchaseAmount: 100,
      purchasePrice: 6.99,
    });

    const result = hydrateIngredient(ing, [pantryItem]);

    expect(result.warning).toBe('unit_incompatible');
    expect(result.ingredient).toEqual(ing);
  });

  it('uses ingredientKey from pantryItem when ingredient has no ingredientKey', () => {
    const ing = makeIngredient({
      pantryId: 'pantry-flour',
      // no ingredientKey on ingredient
      usedUnit: 'cup', // volume
    });
    const pantryItem = makePantryItem({
      id: 'pantry-flour',
      ingredientKey: 'all-purpose-flour', // density exists
      purchaseUnit: 'lb', // weight
      purchaseAmount: 5,
      purchasePrice: 3.49,
    });

    const result = hydrateIngredient(ing, [pantryItem]);

    // Should succeed because pantryItem.ingredientKey is used as fallback
    expect(result.warning).toBeUndefined();
    expect(result.ingredient.purchaseAmount).toBe(5);
  });

  it('does not mutate the original ingredient', () => {
    const ing = makeIngredient({
      pantryId: 'pantry-flour',
      ingredientKey: 'all-purpose-flour',
    });
    const originalPrice = ing.purchasePrice;
    const pantryItem = makePantryItem({ id: 'pantry-flour', purchasePrice: 99.99 });

    hydrateIngredient(ing, [pantryItem]);

    expect(ing.purchasePrice).toBe(originalPrice);
  });
});

// ---------------------------------------------------------------------------
// hydrateRecipe
// ---------------------------------------------------------------------------

describe('hydrateRecipe', () => {
  it('hydrates all pantry-linked ingredients in a recipe', () => {
    const pantry = [
      makePantryItem({
        id: 'pantry-flour',
        purchaseAmount: 10,
        purchaseUnit: 'lb',
        purchasePrice: 5.99,
      }),
      makePantryItem({
        id: 'pantry-sugar',
        name: 'Sugar',
        ingredientKey: 'sugar',
        purchaseAmount: 8,
        purchaseUnit: 'lb',
        purchasePrice: 6.49,
      }),
    ];
    const recipe = makeRecipe();

    const result = hydrateRecipe(recipe, pantry);

    expect(result.warnings).toEqual([]);
    // Flour hydrated from pantry
    expect(result.recipe.ingredients[0].purchasePrice).toBe(5.99);
    expect(result.recipe.ingredients[0].purchaseAmount).toBe(10);
    // Sugar hydrated from pantry
    expect(result.recipe.ingredients[1].purchasePrice).toBe(6.49);
    expect(result.recipe.ingredients[1].purchaseAmount).toBe(8);
    // Vanilla remains unchanged (no pantryId)
    expect(result.recipe.ingredients[2].purchasePrice).toBe(8.99);
    expect(result.recipe.ingredients[2].purchaseAmount).toBe(8);
  });

  it('collects warnings from multiple ingredients', () => {
    const pantry: PantryItem[] = []; // empty — all pantry refs will trigger warnings
    const recipe = makeRecipe();

    const result = hydrateRecipe(recipe, pantry);

    // Flour and Sugar both have pantryId but pantry is empty
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toEqual({
      ingredientName: 'Flour',
      warning: 'pantry_deleted',
    });
    expect(result.warnings[1]).toEqual({
      ingredientName: 'Sugar',
      warning: 'pantry_deleted',
    });
  });

  it('returns empty warnings for recipe with no pantry references', () => {
    const recipe = makeRecipe({
      ingredients: [
        makeIngredient({ id: 'ing-1', name: 'Flour' }), // no pantryId
        makeIngredient({ id: 'ing-2', name: 'Sugar' }), // no pantryId
      ],
    });

    const result = hydrateRecipe(recipe, []);

    expect(result.warnings).toEqual([]);
  });

  it('handles recipe with empty ingredients array', () => {
    const recipe = makeRecipe({ ingredients: [] });

    const result = hydrateRecipe(recipe, []);

    expect(result.recipe.ingredients).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('does not mutate the original recipe', () => {
    const recipe = makeRecipe();
    const originalIngredients = [...recipe.ingredients];
    const pantry = [
      makePantryItem({ id: 'pantry-flour', purchasePrice: 99.99 }),
      makePantryItem({ id: 'pantry-sugar', ingredientKey: 'sugar', purchasePrice: 88.88 }),
    ];

    hydrateRecipe(recipe, pantry);

    // Original recipe should be untouched
    expect(recipe.ingredients[0].purchasePrice).toBe(originalIngredients[0].purchasePrice);
    expect(recipe.ingredients[1].purchasePrice).toBe(originalIngredients[1].purchasePrice);
  });

  it('preserves all non-ingredient recipe fields', () => {
    const recipe = makeRecipe();
    const pantry = [makePantryItem({ id: 'pantry-flour' })];

    const result = hydrateRecipe(recipe, pantry);

    expect(result.recipe.name).toBe(recipe.name);
    expect(result.recipe.quantity).toBe(recipe.quantity);
    expect(result.recipe.quantityUnit).toBe(recipe.quantityUnit);
    expect(result.recipe.batchTimeHours).toBe(recipe.batchTimeHours);
    expect(result.recipe.laborAndOverhead).toEqual(recipe.laborAndOverhead);
  });

  it('mixes hydrated and warning ingredients correctly', () => {
    const pantry = [
      makePantryItem({
        id: 'pantry-flour',
        purchaseAmount: 10,
        purchaseUnit: 'lb',
        purchasePrice: 5.99,
      }),
      // pantry-sugar is missing → will generate pantry_deleted warning
    ];
    const recipe = makeRecipe();

    const result = hydrateRecipe(recipe, pantry);

    // Flour: successfully hydrated
    expect(result.recipe.ingredients[0].purchasePrice).toBe(5.99);
    // Sugar: pantry_deleted, keeps inline price
    expect(result.recipe.ingredients[1].purchasePrice).toBe(3.29);
    // Vanilla: no pantryId, keeps inline price
    expect(result.recipe.ingredients[2].purchasePrice).toBe(8.99);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toEqual({
      ingredientName: 'Sugar',
      warning: 'pantry_deleted',
    });
  });
});

// ---------------------------------------------------------------------------
// Integration: hydrated recipe works with calculateTotalCosts
// ---------------------------------------------------------------------------

describe('integration with calculateTotalCosts', () => {
  it('hydrated recipe produces valid CostBreakdown', () => {
    const pantry = [
      makePantryItem({
        id: 'pantry-flour',
        purchaseAmount: 10,
        purchaseUnit: 'lb',
        purchasePrice: 5.99,
      }),
      makePantryItem({
        id: 'pantry-sugar',
        name: 'Sugar',
        ingredientKey: 'sugar',
        purchaseAmount: 8,
        purchaseUnit: 'lb',
        purchasePrice: 6.49,
      }),
    ];
    const recipe = makeRecipe();

    const { recipe: hydrated } = hydrateRecipe(recipe, pantry);
    const costs = calculateTotalCosts(hydrated);

    expect(costs.ingredientCost).toBeGreaterThan(0);
    expect(costs.trueTotalCost).toBeGreaterThan(0);
    expect(costs.laborCost).toBe(15); // 1 hour * $15/hr
    expect(costs.packagingCost).toBe(2);
    expect(costs.overheadCost).toBe(1);
  });

  it('hydrated ingredient can be passed to calculateIngredientCost', () => {
    const ing = makeIngredient({
      pantryId: 'pantry-flour',
      ingredientKey: 'all-purpose-flour',
      usedAmount: 2,
      usedUnit: 'lb',
    });
    const pantryItem = makePantryItem({
      id: 'pantry-flour',
      purchaseAmount: 10,
      purchaseUnit: 'lb',
      purchasePrice: 5.99,
    });

    const { ingredient: hydrated } = hydrateIngredient(ing, [pantryItem]);
    const cost = calculateIngredientCost(hydrated);

    // 5.99 * (2/10) = 1.198 -> 1.20
    expect(cost).toBe(1.2);
  });

  it('fallen-back ingredient (pantry_deleted) still works with calculateIngredientCost', () => {
    const ing = makeIngredient({
      pantryId: 'deleted-id',
      purchaseAmount: 5,
      purchaseUnit: 'lb',
      purchasePrice: 3.49,
      usedAmount: 1.5,
      wastePercent: 2,
    });

    const { ingredient: fallback, warning } = hydrateIngredient(ing, []);

    expect(warning).toBe('pantry_deleted');
    const cost = calculateIngredientCost(fallback);
    // 3.49 * (1.5/5) * 1.02 = 1.0647 -> 1.07
    expect(cost).toBe(1.07);
  });

  it('fallen-back ingredient (unit_incompatible) still works with calculateIngredientCost', () => {
    const ing = makeIngredient({
      pantryId: 'pantry-spice',
      ingredientKey: 'unknown-spice',
      purchaseAmount: 4,
      purchaseUnit: 'oz',
      purchasePrice: 9.99,
      usedAmount: 1,
      usedUnit: 'each', // count vs weight — incompatible
      wastePercent: 0,
    });
    const pantryItem = makePantryItem({
      id: 'pantry-spice',
      ingredientKey: 'unknown-spice',
      purchaseUnit: 'lb',
      purchaseAmount: 2,
      purchasePrice: 12.99,
    });

    const { ingredient: fallback, warning } = hydrateIngredient(ing, [pantryItem]);

    expect(warning).toBe('unit_incompatible');
    const cost = calculateIngredientCost(fallback);
    // 9.99 * (1/4) * 1.0 = 2.4975 -> 2.50
    expect(cost).toBe(2.5);
  });
});
