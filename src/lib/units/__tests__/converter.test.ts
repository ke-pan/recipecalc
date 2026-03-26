import { describe, it, expect } from 'vitest';
import {
  convert,
  convertCrossCategory,
  getUnitCategory,
  getCompatibleUnits,
  canConvert,
} from '../converter';
import { DENSITY_TABLE } from '../density-data';

// ---------------------------------------------------------------------------
// getUnitCategory
// ---------------------------------------------------------------------------

describe('getUnitCategory', () => {
  it('identifies weight units', () => {
    expect(getUnitCategory('g')).toBe('weight');
    expect(getUnitCategory('oz')).toBe('weight');
    expect(getUnitCategory('lb')).toBe('weight');
    expect(getUnitCategory('kg')).toBe('weight');
  });

  it('identifies volume units', () => {
    expect(getUnitCategory('ml')).toBe('volume');
    expect(getUnitCategory('cup')).toBe('volume');
    expect(getUnitCategory('tsp')).toBe('volume');
    expect(getUnitCategory('tbsp')).toBe('volume');
    expect(getUnitCategory('fl oz')).toBe('volume');
    expect(getUnitCategory('quart')).toBe('volume');
    expect(getUnitCategory('gallon')).toBe('volume');
    expect(getUnitCategory('liter')).toBe('volume');
  });

  it('identifies count units', () => {
    expect(getUnitCategory('each')).toBe('count');
    expect(getUnitCategory('dozen')).toBe('count');
  });

  it('is case-insensitive', () => {
    expect(getUnitCategory('Cup')).toBe('volume');
    expect(getUnitCategory('CUP')).toBe('volume');
    expect(getUnitCategory('G')).toBe('weight');
    expect(getUnitCategory('Fl Oz')).toBe('volume');
  });

  it('throws RangeError for unknown units', () => {
    expect(() => getUnitCategory('banana')).toThrow(RangeError);
    expect(() => getUnitCategory('')).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// getCompatibleUnits
// ---------------------------------------------------------------------------

describe('getCompatibleUnits', () => {
  it('returns all weight units for a weight input', () => {
    const result = getCompatibleUnits('g');
    expect(result).toContain('g');
    expect(result).toContain('oz');
    expect(result).toContain('lb');
    expect(result).toContain('kg');
    expect(result).toHaveLength(4);
  });

  it('returns all volume units for a volume input', () => {
    const result = getCompatibleUnits('cup');
    expect(result).toContain('ml');
    expect(result).toContain('cup');
    expect(result).toContain('tsp');
    expect(result).toContain('tbsp');
    expect(result).toContain('fl oz');
    expect(result).toContain('quart');
    expect(result).toContain('gallon');
    expect(result).toContain('liter');
    expect(result).toHaveLength(8);
  });

  it('returns all count units for a count input', () => {
    const result = getCompatibleUnits('each');
    expect(result).toContain('each');
    expect(result).toContain('dozen');
    expect(result).toHaveLength(2);
  });

  it('is case-insensitive', () => {
    expect(getCompatibleUnits('CUP')).toEqual(getCompatibleUnits('cup'));
  });
});

// ---------------------------------------------------------------------------
// canConvert
// ---------------------------------------------------------------------------

describe('canConvert', () => {
  it('returns true for same-category conversions', () => {
    expect(canConvert('g', 'oz')).toBe(true);
    expect(canConvert('cup', 'ml')).toBe(true);
    expect(canConvert('each', 'dozen')).toBe(true);
  });

  it('returns false for cross-category without ingredientId', () => {
    expect(canConvert('g', 'cup')).toBe(false);
    expect(canConvert('ml', 'oz')).toBe(false);
  });

  it('returns true for cross-category with known ingredient', () => {
    expect(canConvert('g', 'cup', 'all-purpose-flour')).toBe(true);
    expect(canConvert('ml', 'oz', 'water')).toBe(true);
  });

  it('returns false for cross-category with unknown ingredient', () => {
    expect(canConvert('g', 'cup', 'unicorn-tears')).toBe(false);
  });

  it('returns false for count↔anything cross-category', () => {
    expect(canConvert('each', 'g', 'eggs')).toBe(false);
    expect(canConvert('cup', 'dozen', 'sugar')).toBe(false);
  });

  it('returns false for unknown units', () => {
    expect(canConvert('banana', 'g')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// convert (same-category)
// ---------------------------------------------------------------------------

describe('convert (same-category)', () => {
  // Weight conversions
  describe('weight↔weight', () => {
    it('g → oz', () => {
      expect(convert(100, 'g', 'oz')).toBeCloseTo(3.5, 1);
    });

    it('oz → g', () => {
      expect(convert(1, 'oz', 'g')).toBeCloseTo(28.3, 0);
    });

    it('lb → kg', () => {
      expect(convert(1, 'lb', 'kg')).toBeCloseTo(0.454, 1);
    });

    it('kg → lb', () => {
      expect(convert(1, 'kg', 'lb')).toBeCloseTo(2.2, 1);
    });

    it('g → kg', () => {
      expect(convert(1000, 'g', 'kg')).toBe(1);
    });

    it('lb → oz', () => {
      expect(convert(1, 'lb', 'oz')).toBeCloseTo(16, 0);
    });

    it('oz → lb', () => {
      expect(convert(16, 'oz', 'lb')).toBeCloseTo(1, 1);
    });

    it('kg → g', () => {
      expect(convert(1, 'kg', 'g')).toBe(1000);
    });
  });

  // Volume conversions
  describe('volume↔volume', () => {
    it('cup → ml', () => {
      expect(convert(1, 'cup', 'ml')).toBeCloseTo(236.59, 0);
    });

    it('ml → cup', () => {
      expect(convert(236.588, 'ml', 'cup')).toBeCloseTo(1, 1);
    });

    it('tsp → tbsp', () => {
      expect(convert(3, 'tsp', 'tbsp')).toBeCloseTo(1, 1);
    });

    it('tbsp → tsp', () => {
      expect(convert(1, 'tbsp', 'tsp')).toBeCloseTo(3, 1);
    });

    it('cup → tbsp', () => {
      expect(convert(1, 'cup', 'tbsp')).toBeCloseTo(16, 0);
    });

    it('fl oz → ml', () => {
      expect(convert(1, 'fl oz', 'ml')).toBeCloseTo(29.57, 1);
    });

    it('quart → cup', () => {
      expect(convert(1, 'quart', 'cup')).toBeCloseTo(4, 0);
    });

    it('gallon → quart', () => {
      expect(convert(1, 'gallon', 'quart')).toBeCloseTo(4, 0);
    });

    it('liter → ml', () => {
      expect(convert(1, 'liter', 'ml')).toBe(1000);
    });

    it('cup → fl oz', () => {
      expect(convert(1, 'cup', 'fl oz')).toBeCloseTo(8, 0);
    });
  });

  // Count conversions
  describe('count↔count', () => {
    it('dozen → each', () => {
      expect(convert(1, 'dozen', 'each')).toBe(12);
    });

    it('each → dozen', () => {
      expect(convert(12, 'each', 'dozen')).toBe(1);
    });

    it('each → dozen (partial)', () => {
      expect(convert(6, 'each', 'dozen')).toBeCloseTo(0.5, 1);
    });
  });

  // Identity conversions
  describe('identity (same unit)', () => {
    it('g → g returns same amount', () => {
      expect(convert(500, 'g', 'g')).toBe(500);
    });

    it('cup → cup returns same amount', () => {
      expect(convert(2.5, 'cup', 'cup')).toBe(2.5);
    });
  });

  // Edge cases
  describe('edge cases', () => {
    it('zero amount returns 0', () => {
      expect(convert(0, 'g', 'oz')).toBe(0);
      expect(convert(0, 'cup', 'ml')).toBe(0);
    });

    it('negative amount throws RangeError', () => {
      expect(() => convert(-1, 'g', 'oz')).toThrow(RangeError);
    });

    it('case-insensitive unit input', () => {
      expect(convert(1, 'Cup', 'ML')).toBeCloseTo(236.59, 0);
      expect(convert(1, 'G', 'OZ')).toBeCloseTo(0.04, 1);
    });

    it('throws when converting across categories without density', () => {
      expect(() => convert(1, 'g', 'cup')).toThrow(RangeError);
    });
  });
});

// ---------------------------------------------------------------------------
// convertCrossCategory (weight↔volume)
// ---------------------------------------------------------------------------

describe('convertCrossCategory', () => {
  // Key acceptance criterion: 1 cup flour ≈ 120g (±2g)
  it('1 cup all-purpose-flour → g ≈ 120g', () => {
    const result = convertCrossCategory(1, 'cup', 'g', 'all-purpose-flour');
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(120, 0);
    expect(Math.abs(result! - 120)).toBeLessThanOrEqual(2);
  });

  it('120g all-purpose-flour → cup ≈ 1 cup', () => {
    const result = convertCrossCategory(120, 'g', 'cup', 'all-purpose-flour');
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(1, 1);
  });

  // Test every ingredient in the density table for cup→g roundtrip
  describe('all 20 ingredients: cup→g matches density table', () => {
    for (const ingredient of DENSITY_TABLE) {
      it(`${ingredient.name}: 1 cup → ${ingredient.density.g_per_cup}g`, () => {
        const result = convertCrossCategory(1, 'cup', 'g', ingredient.id);
        expect(result).not.toBeNull();
        // g_per_cup is derived via g_per_ml * 236.588; allow ±3g tolerance
        expect(Math.abs(result! - ingredient.density.g_per_cup)).toBeLessThanOrEqual(3);
      });
    }
  });

  it('unknown ingredient returns null', () => {
    const result = convertCrossCategory(1, 'cup', 'g', 'unicorn-tears');
    expect(result).toBeNull();
  });

  it('zero amount returns 0', () => {
    expect(convertCrossCategory(0, 'cup', 'g', 'all-purpose-flour')).toBe(0);
  });

  it('negative amount throws RangeError', () => {
    expect(() => convertCrossCategory(-1, 'cup', 'g', 'all-purpose-flour')).toThrow(
      RangeError,
    );
  });

  it('count ↔ weight throws RangeError', () => {
    expect(() => convertCrossCategory(1, 'each', 'g', 'eggs')).toThrow(RangeError);
  });

  it('same-category delegates to convert()', () => {
    // Should work even through convertCrossCategory
    const result = convertCrossCategory(1, 'kg', 'g', 'water');
    expect(result).toBe(1000);
  });

  it('case-insensitive for cross-category', () => {
    const result = convertCrossCategory(1, 'Cup', 'G', 'butter');
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(227, 0);
  });

  // Additional cross-category tests with specific ingredients
  it('1 cup sugar → g ≈ 198g', () => {
    const result = convertCrossCategory(1, 'cup', 'g', 'sugar');
    expect(result).not.toBeNull();
    expect(Math.abs(result! - 198)).toBeLessThanOrEqual(3);
  });

  it('1 cup honey → g ≈ 336g', () => {
    const result = convertCrossCategory(1, 'cup', 'g', 'honey');
    expect(result).not.toBeNull();
    expect(Math.abs(result! - 336)).toBeLessThanOrEqual(3);
  });

  it('1 tbsp butter → g ≈ 14.2g', () => {
    const result = convertCrossCategory(1, 'tbsp', 'g', 'butter');
    expect(result).not.toBeNull();
    // 1 tbsp = 14.7868 ml * 0.959 g/ml ≈ 14.2g
    expect(result!).toBeCloseTo(14.2, 0);
  });

  it('100g water → ml ≈ 100ml', () => {
    const result = convertCrossCategory(100, 'g', 'ml', 'water');
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(100, 0);
  });
});

// ---------------------------------------------------------------------------
// Density data integrity
// ---------------------------------------------------------------------------

describe('density data', () => {
  it('has exactly 20 ingredients', () => {
    expect(DENSITY_TABLE).toHaveLength(20);
  });

  it('every ingredient has required fields', () => {
    for (const entry of DENSITY_TABLE) {
      expect(entry.id).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(entry.density.g_per_ml).toBeGreaterThan(0);
      expect(entry.density.g_per_cup).toBeGreaterThan(0);
      expect(entry.source).toBeTruthy();
    }
  });

  it('all IDs are unique', () => {
    const ids = DENSITY_TABLE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every ingredient has a source citation', () => {
    for (const entry of DENSITY_TABLE) {
      // Must mention at least one known source
      const hasKnownSource =
        entry.source.includes('King Arthur') ||
        entry.source.includes('USDA') ||
        entry.source.includes('Standard');
      expect(hasKnownSource).toBe(true);
    }
  });
});
