/**
 * Unit conversion engine for RecipeCalc.
 *
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
} from './conversion-factors.js';
import { getDensity } from './density-data.js';
import type { UnitCategory } from './types.js';

/** Lookup table: category -> conversion factors to base unit. */
const FACTOR_TABLE: Record<UnitCategory, Record<string, number>> = {
  weight: WEIGHT_TO_GRAMS,
  volume: VOLUME_TO_ML,
  count: COUNT_TO_EACH,
};

/** Lookup table: category -> list of supported units. */
const UNIT_LIST: Record<UnitCategory, string[]> = {
  weight: WEIGHT_UNITS,
  volume: VOLUME_UNITS,
  count: COUNT_UNITS,
};

function normalizeUnit(unit: string): string {
  return unit.toLowerCase().trim();
}

/** Return the category if the unit is known, or undefined otherwise. */
function findUnitCategory(unit: string): UnitCategory | undefined {
  const u = normalizeUnit(unit);
  if (u in WEIGHT_TO_GRAMS) return 'weight';
  if (u in VOLUME_TO_ML) return 'volume';
  if (u in COUNT_TO_EACH) return 'count';
  return undefined;
}

/** Return the category a unit belongs to. Throws RangeError for unknown units. */
export function getUnitCategory(unit: string): UnitCategory {
  const category = findUnitCategory(unit);
  if (!category) throw new RangeError(`Unknown unit: "${unit}"`);
  return category;
}

/** Return every unit in the same category as the given unit. */
export function getCompatibleUnits(unit: string): string[] {
  return [...UNIT_LIST[getUnitCategory(unit)]];
}

/**
 * Check whether a conversion is possible.
 * Same-category is always possible. Cross-category (weight<->volume)
 * requires a known ingredientId. Count cannot cross-convert.
 */
export function canConvert(
  fromUnit: string,
  toUnit: string,
  ingredientId?: string,
): boolean {
  const fromCat = findUnitCategory(fromUnit);
  const toCat = findUnitCategory(toUnit);
  if (!fromCat || !toCat) return false;
  if (fromCat === toCat) return true;
  if (fromCat === 'count' || toCat === 'count') return false;
  if (!ingredientId) return false;
  return getDensity(ingredientId) !== undefined;
}

/**
 * Round to a sensible number of decimal places for the target unit category.
 * Weight: 1 decimal place. Volume/count: 2 decimal places.
 */
function roundResult(value: number, toUnit: string): number {
  const factor = getUnitCategory(toUnit) === 'weight' ? 10 : 100;
  return Math.round(value * factor) / factor;
}

/**
 * Convert an amount between two units of the same category.
 *
 * @throws RangeError if amount is negative or units are unknown/incompatible
 */
export function convert(amount: number, fromUnit: string, toUnit: string): number {
  if (amount < 0) {
    throw new RangeError(`Amount must be non-negative, got ${amount}`);
  }
  if (amount === 0) return 0;

  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return amount;

  const fromCat = getUnitCategory(from);
  const toCat = getUnitCategory(to);

  if (fromCat !== toCat) {
    throw new RangeError(
      `Cannot convert between different categories without ingredient data. ` +
        `Use convertCrossCategory() for ${fromCat}->${toCat} conversion.`,
    );
  }

  const factors = FACTOR_TABLE[fromCat];
  const baseAmount = amount * factors[from];
  const result = baseAmount / factors[to];
  return roundResult(result, to);
}

/**
 * Convert between different unit categories (weight<->volume) using ingredient density.
 *
 * Returns null if the ingredient is not in the density table.
 * @throws RangeError if amount is negative, units are unknown, or count is involved
 */
export function convertCrossCategory(
  amount: number,
  fromUnit: string,
  toUnit: string,
  ingredientId: string,
): number | null {
  if (amount < 0) {
    throw new RangeError(`Amount must be non-negative, got ${amount}`);
  }
  if (amount === 0) return 0;

  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  const fromCat = getUnitCategory(from);
  const toCat = getUnitCategory(to);

  if (fromCat === toCat) {
    return convert(amount, from, to);
  }

  if (fromCat === 'count' || toCat === 'count') {
    throw new RangeError(
      `Cannot convert between ${fromCat} and ${toCat}. ` +
        `Count units are not interchangeable with weight or volume.`,
    );
  }

  const entry = getDensity(ingredientId);
  if (!entry) return null;

  const { g_per_ml } = entry.density;

  // Convert to grams as the intermediate base
  const grams = fromCat === 'weight'
    ? amount * WEIGHT_TO_GRAMS[from]
    : amount * VOLUME_TO_ML[from] * g_per_ml;

  // Convert from grams to the target unit
  const result = toCat === 'weight'
    ? grams / WEIGHT_TO_GRAMS[to]
    : grams / g_per_ml / VOLUME_TO_ML[to];

  return roundResult(result, to);
}
