/**
 * 50 common baking ingredients for autocomplete.
 *
 * Each entry provides:
 * - id: stable identifier (matches density-data.ts where applicable)
 * - name: human-readable display name
 * - defaultPurchaseUnit: the unit most home bakers buy this in
 * - defaultUsedUnit: the unit most recipes call for
 *
 * When an ingredient has a matching density ID, cross-category unit
 * conversion (weight <-> volume) is available.
 */

export interface CommonIngredient {
  id: string;
  name: string;
  defaultPurchaseUnit: string;
  defaultUsedUnit: string;
}

export const COMMON_INGREDIENTS: CommonIngredient[] = [
  // Flours
  { id: 'all-purpose-flour', name: 'All-Purpose Flour', defaultPurchaseUnit: 'lb', defaultUsedUnit: 'cup' },
  { id: 'bread-flour', name: 'Bread Flour', defaultPurchaseUnit: 'lb', defaultUsedUnit: 'cup' },
  { id: 'whole-wheat-flour', name: 'Whole Wheat Flour', defaultPurchaseUnit: 'lb', defaultUsedUnit: 'cup' },
  { id: 'cake-flour', name: 'Cake Flour', defaultPurchaseUnit: 'lb', defaultUsedUnit: 'cup' },
  { id: 'almond-flour', name: 'Almond Flour', defaultPurchaseUnit: 'lb', defaultUsedUnit: 'cup' },
  { id: 'coconut-flour', name: 'Coconut Flour', defaultPurchaseUnit: 'lb', defaultUsedUnit: 'cup' },
  { id: 'rye-flour', name: 'Rye Flour', defaultPurchaseUnit: 'lb', defaultUsedUnit: 'cup' },

  // Sugars & sweeteners
  { id: 'sugar', name: 'Granulated Sugar', defaultPurchaseUnit: 'lb', defaultUsedUnit: 'cup' },
  { id: 'brown-sugar', name: 'Brown Sugar', defaultPurchaseUnit: 'lb', defaultUsedUnit: 'cup' },
  { id: 'powdered-sugar', name: 'Powdered Sugar', defaultPurchaseUnit: 'lb', defaultUsedUnit: 'cup' },
  { id: 'honey', name: 'Honey', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'tbsp' },
  { id: 'maple-syrup', name: 'Maple Syrup', defaultPurchaseUnit: 'fl oz', defaultUsedUnit: 'tbsp' },
  { id: 'molasses', name: 'Molasses', defaultPurchaseUnit: 'fl oz', defaultUsedUnit: 'tbsp' },
  { id: 'corn-syrup', name: 'Corn Syrup', defaultPurchaseUnit: 'fl oz', defaultUsedUnit: 'tbsp' },

  // Fats & oils
  { id: 'butter', name: 'Butter', defaultPurchaseUnit: 'lb', defaultUsedUnit: 'tbsp' },
  { id: 'vegetable-oil', name: 'Vegetable Oil', defaultPurchaseUnit: 'fl oz', defaultUsedUnit: 'cup' },
  { id: 'olive-oil', name: 'Olive Oil', defaultPurchaseUnit: 'fl oz', defaultUsedUnit: 'tbsp' },
  { id: 'coconut-oil', name: 'Coconut Oil', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'tbsp' },
  { id: 'shortening', name: 'Shortening', defaultPurchaseUnit: 'lb', defaultUsedUnit: 'cup' },
  { id: 'cream-cheese', name: 'Cream Cheese', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'oz' },

  // Dairy & eggs
  { id: 'eggs', name: 'Eggs (large)', defaultPurchaseUnit: 'dozen', defaultUsedUnit: 'each' },
  { id: 'milk', name: 'Whole Milk', defaultPurchaseUnit: 'gallon', defaultUsedUnit: 'cup' },
  { id: 'heavy-cream', name: 'Heavy Cream', defaultPurchaseUnit: 'fl oz', defaultUsedUnit: 'cup' },
  { id: 'buttermilk', name: 'Buttermilk', defaultPurchaseUnit: 'quart', defaultUsedUnit: 'cup' },
  { id: 'sour-cream', name: 'Sour Cream', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'cup' },
  { id: 'yogurt', name: 'Yogurt', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'cup' },
  { id: 'evaporated-milk', name: 'Evaporated Milk', defaultPurchaseUnit: 'fl oz', defaultUsedUnit: 'cup' },
  { id: 'condensed-milk', name: 'Condensed Milk', defaultPurchaseUnit: 'fl oz', defaultUsedUnit: 'tbsp' },

  // Leaveners
  { id: 'baking-powder', name: 'Baking Powder', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'tsp' },
  { id: 'baking-soda', name: 'Baking Soda', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'tsp' },
  { id: 'yeast', name: 'Active Dry Yeast', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'tsp' },

  // Chocolate & cocoa
  { id: 'cocoa-powder', name: 'Cocoa Powder', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'tbsp' },
  { id: 'chocolate-chips', name: 'Chocolate Chips', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'cup' },
  { id: 'dark-chocolate', name: 'Dark Chocolate', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'oz' },
  { id: 'white-chocolate', name: 'White Chocolate', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'oz' },

  // Flavoring & spices
  { id: 'vanilla-extract', name: 'Vanilla Extract', defaultPurchaseUnit: 'fl oz', defaultUsedUnit: 'tsp' },
  { id: 'salt', name: 'Salt', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'tsp' },
  { id: 'cinnamon', name: 'Cinnamon', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'tsp' },
  { id: 'nutmeg', name: 'Nutmeg', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'tsp' },
  { id: 'ginger', name: 'Ground Ginger', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'tsp' },
  { id: 'allspice', name: 'Allspice', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'tsp' },
  { id: 'cloves', name: 'Ground Cloves', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'tsp' },
  { id: 'lemon-juice', name: 'Lemon Juice', defaultPurchaseUnit: 'fl oz', defaultUsedUnit: 'tbsp' },
  { id: 'lemon-zest', name: 'Lemon Zest', defaultPurchaseUnit: 'each', defaultUsedUnit: 'tsp' },

  // Starches & thickeners
  { id: 'cornstarch', name: 'Cornstarch', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'tbsp' },
  { id: 'gelatin', name: 'Gelatin (unflavored)', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'tsp' },

  // Nuts & dried fruit
  { id: 'walnuts', name: 'Walnuts', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'cup' },
  { id: 'pecans', name: 'Pecans', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'cup' },
  { id: 'almonds', name: 'Almonds (sliced)', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'cup' },
  { id: 'raisins', name: 'Raisins', defaultPurchaseUnit: 'oz', defaultUsedUnit: 'cup' },

  // Misc
  { id: 'water', name: 'Water', defaultPurchaseUnit: 'gallon', defaultUsedUnit: 'cup' },
];
