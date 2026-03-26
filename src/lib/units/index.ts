/**
 * @module units
 *
 * Unit conversion engine for RecipeCalc.
 * Pure logic — no UI dependencies.
 */

export { convert, convertCrossCategory, getUnitCategory, getCompatibleUnits, canConvert } from './converter';
export { getDensity, DENSITY_TABLE } from './density-data';
export { WEIGHT_TO_GRAMS, VOLUME_TO_ML, COUNT_TO_EACH, WEIGHT_UNITS, VOLUME_UNITS, COUNT_UNITS } from './conversion-factors';
export type { Unit, UnitCategory, WeightUnit, VolumeUnit, CountUnit, IngredientDensity } from './types';
