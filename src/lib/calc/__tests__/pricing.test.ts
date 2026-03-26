import { describe, it, expect } from "vitest";
import {
  roundCents,
  calculateIngredientCost,
  calculateTotalCosts,
  calculatePricing,
} from "../pricing.js";
import type { Ingredient, Recipe } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal ingredient with sensible defaults. */
function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: "test-1",
    name: "Test Flour",
    purchaseAmount: 5,
    purchaseUnit: "lb",
    purchasePrice: 3.49,
    usedAmount: 2.5,
    usedUnit: "lb",
    wastePercent: 0,
    ...overrides,
  };
}

/**
 * Chocolate Chip Cookies reference recipe.
 *
 * This is the canonical acceptance-test recipe from Issue #4.
 * Ingredients are designed so that:
 *   ingredientCost ≈ $8.50
 *   laborCost = 2.5 × 15 = $37.50
 *   packaging = $4.00
 *   overhead = $2.50
 *   platformFees = $0
 *   trueTotalCost ≈ $52.50
 *
 * At 30% target cost ratio → recommended price ≈ $7.29/cookie.
 */
function makeChocolateChipCookieRecipe(): Recipe {
  return {
    name: "Chocolate Chip Cookies",
    quantity: 24,
    quantityUnit: "cookies",
    batchTimeHours: 2.5,
    ingredients: [
      {
        id: "flour",
        name: "All-purpose flour",
        purchaseAmount: 5,
        purchaseUnit: "lb",
        purchasePrice: 3.49,
        usedAmount: 1.5,
        usedUnit: "lb",
        wastePercent: 2,
      },
      {
        id: "butter",
        name: "Unsalted butter",
        purchaseAmount: 1,
        purchaseUnit: "lb",
        purchasePrice: 4.99,
        usedAmount: 0.5,
        usedUnit: "lb",
        wastePercent: 0,
      },
      {
        id: "sugar",
        name: "Granulated sugar",
        purchaseAmount: 4,
        purchaseUnit: "lb",
        purchasePrice: 3.29,
        usedAmount: 0.75,
        usedUnit: "lb",
        wastePercent: 0,
      },
      {
        id: "brown-sugar",
        name: "Brown sugar",
        purchaseAmount: 2,
        purchaseUnit: "lb",
        purchasePrice: 2.99,
        usedAmount: 0.75,
        usedUnit: "lb",
        wastePercent: 0,
      },
      {
        id: "eggs",
        name: "Eggs",
        purchaseAmount: 12,
        purchaseUnit: "each",
        purchasePrice: 3.49,
        usedAmount: 2,
        usedUnit: "each",
        wastePercent: 0,
      },
      {
        id: "vanilla",
        name: "Vanilla extract",
        purchaseAmount: 8,
        purchaseUnit: "oz",
        purchasePrice: 8.99,
        usedAmount: 0.5,
        usedUnit: "oz",
        wastePercent: 0,
      },
      {
        id: "choc-chips",
        name: "Chocolate chips",
        purchaseAmount: 2,
        purchaseUnit: "lb",
        purchasePrice: 5.49,
        usedAmount: 0.75,
        usedUnit: "lb",
        wastePercent: 5,
      },
      {
        id: "baking-soda",
        name: "Baking soda",
        purchaseAmount: 16,
        purchaseUnit: "oz",
        purchasePrice: 1.29,
        usedAmount: 0.5,
        usedUnit: "oz",
        wastePercent: 0,
      },
      {
        id: "salt",
        name: "Salt",
        purchaseAmount: 26,
        purchaseUnit: "oz",
        purchasePrice: 1.49,
        usedAmount: 0.25,
        usedUnit: "oz",
        wastePercent: 0,
      },
    ],
    laborAndOverhead: {
      hourlyRate: 15,
      packaging: 4.0,
      overhead: 2.5,
      platformFees: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// roundCents
// ---------------------------------------------------------------------------

describe("roundCents", () => {
  it("rounds to 2 decimal places", () => {
    expect(roundCents(1.005)).toBe(1);
    expect(roundCents(1.555)).toBe(1.56);
    expect(roundCents(0)).toBe(0);
    expect(roundCents(99.999)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// calculateIngredientCost
// ---------------------------------------------------------------------------

describe("calculateIngredientCost", () => {
  it("calculates basic ingredient cost without waste", () => {
    const ing = makeIngredient({
      purchasePrice: 3.49,
      purchaseAmount: 5,
      usedAmount: 2.5,
      wastePercent: 0,
    });
    // 3.49 × (2.5 / 5) = 1.745 → rounds to 1.75
    expect(calculateIngredientCost(ing)).toBe(1.75);
  });

  it("applies waste percentage correctly (10%)", () => {
    const ing = makeIngredient({
      purchasePrice: 10,
      purchaseAmount: 1,
      usedAmount: 1,
      wastePercent: 10,
    });
    // 10 × (1/1) × 1.10 = 11.00
    expect(calculateIngredientCost(ing)).toBe(11);
  });

  it("applies waste percentage correctly (5%)", () => {
    const ing = makeIngredient({
      purchasePrice: 5.49,
      purchaseAmount: 2,
      usedAmount: 0.75,
      wastePercent: 5,
    });
    // 5.49 × (0.75/2) × 1.05 = 5.49 × 0.375 × 1.05 = 2.160...
    expect(calculateIngredientCost(ing)).toBe(2.16);
  });

  it("handles zero used amount (cost = 0)", () => {
    const ing = makeIngredient({ usedAmount: 0 });
    expect(calculateIngredientCost(ing)).toBe(0);
  });

  it("handles zero waste percent", () => {
    const ing = makeIngredient({
      purchasePrice: 4.99,
      purchaseAmount: 1,
      usedAmount: 0.5,
      wastePercent: 0,
    });
    // 4.99 × 0.5 = 2.495 → 2.50
    expect(calculateIngredientCost(ing)).toBe(2.5);
  });

  it("throws on negative purchasePrice", () => {
    const ing = makeIngredient({ purchasePrice: -1 });
    expect(() => calculateIngredientCost(ing)).toThrow("purchasePrice");
  });

  it("throws on zero purchaseAmount", () => {
    const ing = makeIngredient({ purchaseAmount: 0 });
    expect(() => calculateIngredientCost(ing)).toThrow("purchaseAmount");
  });

  it("throws on negative purchaseAmount", () => {
    const ing = makeIngredient({ purchaseAmount: -5 });
    expect(() => calculateIngredientCost(ing)).toThrow("purchaseAmount");
  });

  it("throws on negative usedAmount", () => {
    const ing = makeIngredient({ usedAmount: -1 });
    expect(() => calculateIngredientCost(ing)).toThrow("usedAmount");
  });

  it("throws on negative wastePercent", () => {
    const ing = makeIngredient({ wastePercent: -5 });
    expect(() => calculateIngredientCost(ing)).toThrow("wastePercent");
  });
});

// ---------------------------------------------------------------------------
// calculateTotalCosts
// ---------------------------------------------------------------------------

describe("calculateTotalCosts", () => {
  it("computes the Chocolate Chip Cookies reference case", () => {
    const recipe = makeChocolateChipCookieRecipe();
    const costs = calculateTotalCosts(recipe);

    // Labor: 2.5 × 15 = 37.50
    expect(costs.laborCost).toBe(37.5);
    expect(costs.packagingCost).toBe(4.0);
    expect(costs.overheadCost).toBe(2.5);
    expect(costs.platformFees).toBe(0);

    // Ingredient cost breakdown (calculated manually):
    //   flour:       3.49 × (1.5/5)   × 1.02 = 1.0647  → 1.07
    //   butter:      4.99 × (0.5/1)   × 1.00 = 2.495   → 2.50
    //   sugar:       3.29 × (0.75/4)  × 1.00 = 0.61687  → 0.62
    //   brown sugar: 2.99 × (0.75/2)  × 1.00 = 1.12125  → 1.12
    //   eggs:        3.49 × (2/12)    × 1.00 = 0.58166  → 0.58
    //   vanilla:     8.99 × (0.5/8)   × 1.00 = 0.56187  → 0.56
    //   choc chips:  5.49 × (0.75/2)  × 1.05 = 2.16056  → 2.16
    //   baking soda: 1.29 × (0.5/16)  × 1.00 = 0.04031  → 0.04
    //   salt:        1.49 × (0.25/26) × 1.00 = 0.01432  → 0.01
    //   Sum = 1.07+2.50+0.62+1.12+0.58+0.56+2.16+0.04+0.01 = 8.66
    expect(costs.ingredientCost).toBe(8.66);

    // Total: 8.66 + 37.50 + 4.00 + 2.50 + 0 = 52.66
    expect(costs.trueTotalCost).toBe(52.66);
  });

  it("handles empty ingredients array (ingredientCost = 0)", () => {
    const recipe = makeChocolateChipCookieRecipe();
    recipe.ingredients = [];
    const costs = calculateTotalCosts(recipe);

    expect(costs.ingredientCost).toBe(0);
    expect(costs.trueTotalCost).toBe(44); // 37.5 + 4 + 2.5
  });

  it("handles all hidden costs = 0", () => {
    const recipe = makeChocolateChipCookieRecipe();
    recipe.batchTimeHours = 0;
    recipe.laborAndOverhead = {
      hourlyRate: 0,
      packaging: 0,
      overhead: 0,
      platformFees: 0,
    };
    const costs = calculateTotalCosts(recipe);

    expect(costs.laborCost).toBe(0);
    expect(costs.packagingCost).toBe(0);
    expect(costs.overheadCost).toBe(0);
    expect(costs.platformFees).toBe(0);
    expect(costs.trueTotalCost).toBe(costs.ingredientCost);
  });

  it("throws on negative batchTimeHours", () => {
    const recipe = makeChocolateChipCookieRecipe();
    recipe.batchTimeHours = -1;
    expect(() => calculateTotalCosts(recipe)).toThrow("batchTimeHours");
  });

  it("throws on negative hourlyRate", () => {
    const recipe = makeChocolateChipCookieRecipe();
    recipe.laborAndOverhead.hourlyRate = -10;
    expect(() => calculateTotalCosts(recipe)).toThrow("hourlyRate");
  });

  it("throws on negative packaging", () => {
    const recipe = makeChocolateChipCookieRecipe();
    recipe.laborAndOverhead.packaging = -1;
    expect(() => calculateTotalCosts(recipe)).toThrow("packaging");
  });

  it("throws on negative overhead", () => {
    const recipe = makeChocolateChipCookieRecipe();
    recipe.laborAndOverhead.overhead = -1;
    expect(() => calculateTotalCosts(recipe)).toThrow("overhead");
  });

  it("throws on negative platformFees", () => {
    const recipe = makeChocolateChipCookieRecipe();
    recipe.laborAndOverhead.platformFees = -1;
    expect(() => calculateTotalCosts(recipe)).toThrow("platformFees");
  });
});

// ---------------------------------------------------------------------------
// calculatePricing
// ---------------------------------------------------------------------------

describe("calculatePricing", () => {
  it("computes the Chocolate Chip Cookies reference pricing (30% ratio)", () => {
    // trueTotalCost = 52.66 (from calculateTotalCosts), quantity = 24, targetCostRatio = 0.30
    const result = calculatePricing(52.66, 24, 0.3);

    // costPerUnit = 52.66 / 24 = 2.19416... → 2.19
    expect(result.costPerUnit).toBe(2.19);
    // recommendedPricePerUnit = 2.19 / 0.30 = 7.30
    expect(result.recommendedPricePerUnit).toBe(7.3);
    // recommendedPricePerBatch = 7.30 × 24 = 175.20
    expect(result.recommendedPricePerBatch).toBe(175.2);
    // profitPerUnit = 7.30 - 2.19 = 5.11
    expect(result.profitPerUnit).toBe(5.11);
    // profitMargin = 1 - 0.30 = 0.70
    expect(result.profitMargin).toBe(0.7);
  });

  it("computes correctly with 20% target cost ratio", () => {
    const result = calculatePricing(100, 10, 0.2);

    expect(result.costPerUnit).toBe(10);
    expect(result.recommendedPricePerUnit).toBe(50); // 10 / 0.20
    expect(result.recommendedPricePerBatch).toBe(500);
    expect(result.profitPerUnit).toBe(40);
    expect(result.profitMargin).toBe(0.8);
  });

  it("computes correctly with 50% target cost ratio", () => {
    const result = calculatePricing(100, 10, 0.5);

    expect(result.costPerUnit).toBe(10);
    expect(result.recommendedPricePerUnit).toBe(20); // 10 / 0.50
    expect(result.recommendedPricePerBatch).toBe(200);
    expect(result.profitPerUnit).toBe(10);
    expect(result.profitMargin).toBe(0.5);
  });

  it("clamps targetCostRatio below 0.20 to 0.20", () => {
    const result = calculatePricing(100, 10, 0.1);

    // Should be clamped to 0.20
    expect(result.recommendedPricePerUnit).toBe(50); // 10 / 0.20
    expect(result.profitMargin).toBe(0.8); // 1 - 0.20
  });

  it("clamps targetCostRatio above 0.50 to 0.50", () => {
    const result = calculatePricing(100, 10, 0.8);

    // Should be clamped to 0.50
    expect(result.recommendedPricePerUnit).toBe(20); // 10 / 0.50
    expect(result.profitMargin).toBe(0.5); // 1 - 0.50
  });

  it("throws on quantity = 0 (division by zero)", () => {
    expect(() => calculatePricing(100, 0, 0.3)).toThrow("quantity");
  });

  it("throws on negative quantity", () => {
    expect(() => calculatePricing(100, -5, 0.3)).toThrow("quantity");
  });

  it("throws on targetCostRatio = 0 (division by zero)", () => {
    expect(() => calculatePricing(100, 10, 0)).toThrow("targetCostRatio");
  });

  it("throws on negative targetCostRatio", () => {
    expect(() => calculatePricing(100, 10, -0.3)).toThrow("targetCostRatio");
  });

  it("throws on negative trueTotalCost", () => {
    expect(() => calculatePricing(-50, 10, 0.3)).toThrow("trueTotalCost");
  });

  it("handles trueTotalCost = 0 (all outputs are 0)", () => {
    const result = calculatePricing(0, 10, 0.3);

    expect(result.costPerUnit).toBe(0);
    expect(result.recommendedPricePerUnit).toBe(0);
    expect(result.recommendedPricePerBatch).toBe(0);
    expect(result.profitPerUnit).toBe(0);
    expect(result.profitMargin).toBe(0.7);
  });

  it("handles quantity = 1 (single unit batch)", () => {
    const result = calculatePricing(25, 1, 0.3);

    expect(result.costPerUnit).toBe(25);
    expect(result.recommendedPricePerUnit).toBe(83.33);
    expect(result.recommendedPricePerBatch).toBe(83.33);
    expect(result.profitPerUnit).toBe(58.33);
  });

  it("rounds all monetary outputs to 2 decimal places", () => {
    // Use values that produce many decimal places
    const result = calculatePricing(100, 3, 0.3);

    // costPerUnit = 100/3 = 33.3333... → 33.33
    expect(result.costPerUnit).toBe(33.33);
    // recommendedPricePerUnit = 33.33/0.30 = 111.1 → 111.10
    expect(result.recommendedPricePerUnit).toBe(111.1);
    // recommendedPricePerBatch = 111.1 × 3 = 333.30
    expect(result.recommendedPricePerBatch).toBe(333.3);
    // profitPerUnit = 111.10 - 33.33 = 77.77
    expect(result.profitPerUnit).toBe(77.77);

    // Verify they are actually rounded (no more than 2 decimal places)
    const checkDecimals = (n: number) => {
      const str = n.toString();
      const parts = str.split(".");
      if (parts.length === 2) {
        expect(parts[1].length).toBeLessThanOrEqual(2);
      }
    };
    checkDecimals(result.costPerUnit);
    checkDecimals(result.recommendedPricePerUnit);
    checkDecimals(result.recommendedPricePerBatch);
    checkDecimals(result.profitPerUnit);
    checkDecimals(result.profitMargin);
  });
});

// ---------------------------------------------------------------------------
// Integration: full pipeline
// ---------------------------------------------------------------------------

describe("full pipeline integration", () => {
  it("Chocolate Chip Cookies: costs → pricing end-to-end", () => {
    const recipe = makeChocolateChipCookieRecipe();
    const costs = calculateTotalCosts(recipe);
    const pricing = calculatePricing(costs.trueTotalCost, recipe.quantity, 0.3);

    // Verify the "aha moment" numbers bakers care about
    expect(costs.ingredientCost).toBeLessThan(costs.trueTotalCost);
    expect(costs.trueTotalCost).toBeGreaterThan(50);
    expect(costs.trueTotalCost).toBeLessThan(55);
    expect(pricing.recommendedPricePerUnit).toBeGreaterThan(7);
    expect(pricing.recommendedPricePerUnit).toBeLessThan(8);
    expect(pricing.profitMargin).toBe(0.7);
  });

  it("simple recipe with single ingredient", () => {
    const recipe: Recipe = {
      name: "Lemonade",
      quantity: 8,
      quantityUnit: "glasses",
      batchTimeHours: 0.5,
      ingredients: [
        {
          id: "lemons",
          name: "Lemons",
          purchaseAmount: 6,
          purchaseUnit: "each",
          purchasePrice: 3.0,
          usedAmount: 4,
          usedUnit: "each",
          wastePercent: 15,
        },
      ],
      laborAndOverhead: {
        hourlyRate: 12,
        packaging: 2,
        overhead: 1,
        platformFees: 0,
      },
    };

    const costs = calculateTotalCosts(recipe);
    // ingredient: 3.0 × (4/6) × 1.15 = 2.30
    expect(costs.ingredientCost).toBe(2.3);
    // labor: 0.5 × 12 = 6.00
    expect(costs.laborCost).toBe(6);
    // total: 2.30 + 6.00 + 2.00 + 1.00 + 0 = 11.30
    expect(costs.trueTotalCost).toBe(11.3);

    const pricing = calculatePricing(costs.trueTotalCost, recipe.quantity, 0.3);
    // costPerUnit: 11.30 / 8 = 1.4125 → 1.41
    expect(pricing.costPerUnit).toBe(1.41);
    // recommendedPricePerUnit: 1.41 / 0.30 = 4.70
    expect(pricing.recommendedPricePerUnit).toBe(4.7);
  });
});
