/**
 * Intra-category conversion factors.
 *
 * Each map converts FROM the key unit TO the base unit of that category.
 * - Weight base: grams (g)
 * - Volume base: milliliters (ml)
 * - Count base:  each
 */

/** Conversion factor to grams */
export const WEIGHT_TO_GRAMS: Record<string, number> = {
  g: 1,
  oz: 28.3495,
  lb: 453.592,
  kg: 1000,
};

/** Conversion factor to milliliters */
export const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  cup: 236.588,
  tsp: 4.92892,
  tbsp: 14.7868,
  'fl oz': 29.5735,
  quart: 946.353,
  gallon: 3785.41,
  liter: 1000,
};

/** Conversion factor to each */
export const COUNT_TO_EACH: Record<string, number> = {
  each: 1,
  dozen: 12,
};

export const WEIGHT_UNITS = Object.keys(WEIGHT_TO_GRAMS);
export const VOLUME_UNITS = Object.keys(VOLUME_TO_ML);
export const COUNT_UNITS = Object.keys(COUNT_TO_EACH);
