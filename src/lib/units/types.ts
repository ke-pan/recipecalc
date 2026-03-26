/**
 * Unit conversion module types.
 *
 * Supports three unit categories used in baking:
 * - weight: g, oz, lb, kg
 * - volume: ml, cup, tsp, tbsp, fl oz, quart, gallon, liter
 * - count:  each, dozen
 */

export type UnitCategory = 'weight' | 'volume' | 'count';

export type WeightUnit = 'g' | 'oz' | 'lb' | 'kg';
export type VolumeUnit = 'ml' | 'cup' | 'tsp' | 'tbsp' | 'fl oz' | 'quart' | 'gallon' | 'liter';
export type CountUnit = 'each' | 'dozen';

export type Unit = WeightUnit | VolumeUnit | CountUnit;

export interface IngredientDensity {
  /** Stable identifier, e.g. "all-purpose-flour" */
  id: string;
  /** Human-readable name */
  name: string;
  density: {
    /** Grams per milliliter */
    g_per_ml: number;
    /** Grams per US cup (236.588 ml) — primary cross-category bridge */
    g_per_cup: number;
  };
  /** Data provenance for each density value */
  source: string;
}
