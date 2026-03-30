/**
 * Density data for 20 common baking ingredients.
 *
 * Sources:
 * - King Arthur Baking ingredient weight chart
 *   https://www.kingarthurbaking.com/learn/ingredient-weight-chart
 * - USDA FoodData Central (FDC)
 *   https://fdc.nal.usda.gov/
 *
 * g_per_cup is the primary value (sourced directly from King Arthur or USDA).
 * g_per_ml is derived as g_per_cup / 236.588 unless an independent source exists.
 */

import type { IngredientDensity } from './types.js';

export const DENSITY_TABLE: IngredientDensity[] = [
  {
    id: 'all-purpose-flour',
    name: 'All-Purpose Flour',
    density: { g_per_ml: 0.507, g_per_cup: 120 },
    source: 'King Arthur Baking weight chart; USDA FDC ID 169761',
  },
  {
    id: 'bread-flour',
    name: 'Bread Flour',
    density: { g_per_ml: 0.515, g_per_cup: 120 },
    source: 'King Arthur Baking weight chart; USDA FDC ID 169762',
  },
  {
    id: 'whole-wheat-flour',
    name: 'Whole Wheat Flour',
    density: { g_per_ml: 0.507, g_per_cup: 120 },
    source: 'King Arthur Baking weight chart; USDA FDC ID 169764',
  },
  {
    id: 'cake-flour',
    name: 'Cake Flour',
    density: { g_per_ml: 0.481, g_per_cup: 113 },
    source: 'King Arthur Baking weight chart',
  },
  {
    id: 'butter',
    name: 'Butter',
    density: { g_per_ml: 0.959, g_per_cup: 227 },
    source: 'King Arthur Baking weight chart; USDA FDC ID 173410',
  },
  {
    id: 'sugar',
    name: 'Granulated Sugar',
    density: { g_per_ml: 0.845, g_per_cup: 198 },
    source: 'King Arthur Baking weight chart; USDA FDC ID 169655',
  },
  {
    id: 'brown-sugar',
    name: 'Brown Sugar (packed)',
    density: { g_per_ml: 0.900, g_per_cup: 213 },
    source: 'King Arthur Baking weight chart; USDA FDC ID 169656',
  },
  {
    id: 'powdered-sugar',
    name: 'Powdered Sugar (unsifted)',
    density: { g_per_ml: 0.507, g_per_cup: 120 },
    source: 'King Arthur Baking weight chart; USDA FDC ID 169657',
  },
  {
    id: 'salt',
    name: 'Table Salt',
    density: { g_per_ml: 1.217, g_per_cup: 288 },
    source: 'King Arthur Baking weight chart; USDA FDC ID 173468',
  },
  {
    id: 'baking-powder',
    name: 'Baking Powder',
    density: { g_per_ml: 0.921, g_per_cup: 218 },
    source: 'USDA FDC ID 172866',
  },
  {
    id: 'baking-soda',
    name: 'Baking Soda',
    density: { g_per_ml: 1.058, g_per_cup: 250 },
    source: 'USDA FDC ID 172867',
  },
  {
    id: 'cocoa-powder',
    name: 'Cocoa Powder (unsweetened)',
    density: { g_per_ml: 0.355, g_per_cup: 84 },
    source: 'King Arthur Baking weight chart; USDA FDC ID 169593',
  },
  {
    id: 'milk',
    name: 'Whole Milk',
    density: { g_per_ml: 1.03, g_per_cup: 244 },
    source: 'USDA FDC ID 171265',
  },
  {
    id: 'heavy-cream',
    name: 'Heavy Cream',
    density: { g_per_ml: 1.008, g_per_cup: 238 },
    source: 'USDA FDC ID 170859',
  },
  {
    id: 'water',
    name: 'Water',
    density: { g_per_ml: 1.0, g_per_cup: 237 },
    source: 'Standard; USDA FDC ID 175026',
  },
  {
    id: 'eggs',
    name: 'Large Egg (without shell)',
    density: { g_per_ml: 1.031, g_per_cup: 244 },
    source: 'USDA FDC ID 171287 (large egg ≈ 50g, 1 cup ≈ 4.88 eggs)',
  },
  {
    id: 'vegetable-oil',
    name: 'Vegetable Oil',
    density: { g_per_ml: 0.92, g_per_cup: 218 },
    source: 'USDA FDC ID 172336',
  },
  {
    id: 'honey',
    name: 'Honey',
    density: { g_per_ml: 1.42, g_per_cup: 336 },
    source: 'King Arthur Baking weight chart; USDA FDC ID 169640',
  },
  {
    id: 'vanilla-extract',
    name: 'Vanilla Extract',
    density: { g_per_ml: 0.879, g_per_cup: 208 },
    source: 'USDA FDC ID 170939',
  },
  {
    id: 'cornstarch',
    name: 'Cornstarch',
    density: { g_per_ml: 0.541, g_per_cup: 128 },
    source: 'King Arthur Baking weight chart; USDA FDC ID 169690',
  },
];

/** Lookup map by ingredient ID for O(1) access */
const densityMap = new Map<string, IngredientDensity>(
  DENSITY_TABLE.map((entry) => [entry.id, entry]),
);

/** Get density data for a given ingredient ID. Returns undefined if not found. */
export function getDensity(ingredientId: string): IngredientDensity | undefined {
  return densityMap.get(ingredientId);
}
