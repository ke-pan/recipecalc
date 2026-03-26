/**
 * Unit conversion engine for RecipeCalc.
 *
 * Supports:
 * - Same-category conversion (weight↔weight, volume↔volume, count↔count)
 * - Cross-category conversion (weight↔volume) using ingredient density data
 *
 * Design decisions:
 * - Unit input is case-insensitive ('Cup' === 'cup' === 'CUP')
 * - Zero amount always returns 0
 * - Negative amount throws a RangeError
 * - Unknown unit throws a RangeError
 * - Cross-category conversion for unlisted ingredients returns null (no throw)
 */

import {
  WEIGHT_TO_GRAMS,
  VOLUME_TO_ML,
  COUNT_TO_EACH,
  WEIGHT_UNITS,
  VOLUME_UNITS,
  COUNT_UNITS,
} from './conversion-factors';
import { getDensity } from './density-data';
import type { Unit, UnitCategory } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise user-supplied unit string to canonical lowercase form. */
function normalizeUnit(unit: string): string {
  return unit.toLowerCase().trim();
}

/**
 * Return the category a unit belongs to.
 * Throws RangeError for unknown units.
 */
export function getUnitCategory(unit: string): UnitCategory {
  const u = normalizeUnit(unit);
  if (u in WEIGHT_TO_GRAMS) return 'weight';
  if (u in VOLUME_TO_ML) return 'volume';
  if (u in COUNT_TO_EACH) return 'count';
  throw new RangeError(`Unknown unit: "${unit}"`);
}

/**
 * Return every unit in the same category as the given unit.
 * Throws RangeError for unknown units.
 */
export function getCompatibleUnits(unit: string): string[] {
  const category = getUnitCategory(unit);
  switch (category) {
    case 'weight':
      return [...WEIGHT_UNITS];
    case 'volume':
      return [...VOLUME_UNITS];
    case 'count':
      return [...COUNT_UNITS];
  }
}

/**
 * Check whether a conversion is possible.
 * - Same-category conversions are always possible.
 * - Cross-category (weight↔volume) requires a known ingredientId.
 * - Cross-category involving count is never possible.
 */
export function canConvert(
  fromUnit: string,
  toUnit: string,
  ingredientId?: string,
): boolean {
  try {
    const fromCat = getUnitCategory(fromUnit);
    const toCat = getUnitCategory(toUnit);

    if (fromCat === toCat) return true;

    // Cross-category: only weight↔volume is supported (not count↔anything)
    if (fromCat === 'count' || toCat === 'count') return false;

    if (!ingredientId) return false;
    return getDensity(ingredientId) !== undefined;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Rounding
// ---------------------------------------------------------------------------

/**
 * Round the result to a sensible number of decimal places.
 * - Weight values: 1 decimal place
 * - Volume values: 2 decimal places
 * - Count values:  2 decimal places
 */
function roundResult(value: number, toUnit: string): number {
  const cat = getUnitCategory(toUnit);
  const decimals = cat === 'weight' ? 1 : 2;
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateAmount(amount: number): void {
  if (amount < 0) {
    throw new RangeError(`Amount must be non-negative, got ${amount}`);
  }
}

// ---------------------------------------------------------------------------
// Same-category conversion
// ---------------------------------------------------------------------------

/**
 * Convert an amount between two units of the same category.
 *
 * @param amount   - The numeric quantity to convert (must be >= 0)
 * @param fromUnit - Source unit (case-insensitive)
 * @param toUnit   - Target unit (case-insensitive)
 * @returns The converted amount, rounded appropriately
 * @throws RangeError if amount is negative or units are unknown/incompatible
 */
export function convert(amount: number, fromUnit: string, toUnit: string): number {
  validateAmount(amount);
  if (amount === 0) return 0;

  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  const fromCat = getUnitCategory(from);
  const toCat = getUnitCategory(to);

  if (fromCat !== toCat) {
    throw new RangeError(
      `Cannot convert between different categories without ingredient data. ` +
        `Use convertCrossCategory() for ${fromCat}→${toCat} conversion.`,
    );
  }

  // Same unit — no-op
  if (from === to) return amount;

  let baseAmount: number;
  let result: number;

  switch (fromCat) {
    case 'weight':
      baseAmount = amount * WEIGHT_TO_GRAMS[from];
      result = baseAmount / WEIGHT_TO_GRAMS[to];
      break;
    case 'volume':
      baseAmount = amount * VOLUME_TO_ML[from];
      result = baseAmount / VOLUME_TO_ML[to];
      break;
    case 'count':
      baseAmount = amount * COUNT_TO_EACH[from];
      result = baseAmount / COUNT_TO_EACH[to];
      break;
  }

  return roundResult(result, to);
}

// ---------------------------------------------------------------------------
// Cross-category conversion
// ---------------------------------------------------------------------------

/**
 * Convert between different unit categories (weight↔volume) using ingredient density.
 *
 * @param amount       - Numeric quantity (must be >= 0)
 * @param fromUnit     - Source unit (case-insensitive)
 * @param toUnit       - Target unit (case-insensitive)
 * @param ingredientId - Identifier matching an entry in the density table
 * @returns The converted amount, or null if the ingredient is not in the density table
 * @throws RangeError if amount is negative, units are unknown, or cross-category
 *         involves count units
 */
export function convertCrossCategory(
  amount: number,
  fromUnit: string,
  toUnit: string,
  ingredientId: string,
): number | null {
  validateAmount(amount);
  if (amount === 0) return 0;

  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  const fromCat = getUnitCategory(from);
  const toCat = getUnitCategory(to);

  // If same category, delegate to the simpler function
  if (fromCat === toCat) {
    return convert(amount, from, to);
  }

  // Cross-category involving count is not meaningful
  if (fromCat === 'count' || toCat === 'count') {
    throw new RangeError(
      `Cannot convert between count and ${fromCat === 'count' ? toCat : fromCat}. ` +
        `Count units are not interchangeable with weight or volume.`,
    );
  }

  // Look up density
  const density = getDensity(ingredientId);
  if (!density) return null;

  const { g_per_ml } = density.density;

  // Strategy: convert source → base unit of its category → grams → ml → target base → target
  let grams: number;

  if (fromCat === 'weight') {
    // Convert from weight unit → grams
    grams = amount * WEIGHT_TO_GRAMS[from];
  } else {
    // fromCat === 'volume': convert volume → ml → grams
    const ml = amount * VOLUME_TO_ML[from];
    grams = ml * g_per_ml;
  }

  let result: number;

  if (toCat === 'weight') {
    // Convert grams → target weight unit
    result = grams / WEIGHT_TO_GRAMS[to];
  } else {
    // toCat === 'volume': grams → ml → target volume unit
    const ml = grams / g_per_ml;
    result = ml / VOLUME_TO_ML[to];
  }

  return roundResult(result, to);
}
