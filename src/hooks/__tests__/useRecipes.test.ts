import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecipes } from '../useRecipes.js';
import type { Recipe } from '../../lib/calc/types.js';
import type { SavedRecipe } from '../useRecipes.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'recipecalc_recipes';

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    name: 'Chocolate Chip Cookies',
    quantity: 24,
    quantityUnit: 'cookies',
    batchTimeHours: 2.5,
    ingredients: [],
    laborAndOverhead: {
      hourlyRate: 15,
      packaging: 4,
      overhead: 2.5,
      platformFees: 0,
    },
    ...overrides,
  };
}

function makeSavedRecipe(overrides: Partial<SavedRecipe> = {}): SavedRecipe {
  return {
    id: 'test-uuid-1',
    version: 1,
    savedAt: '2026-03-30T12:00:00.000Z',
    updatedAt: '2026-03-30T12:00:00.000Z',
    recipe: makeRecipe(),
    targetCostRatio: 0.3,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

let store: Record<string, string> = {};

const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
};

// ---------------------------------------------------------------------------
// crypto.randomUUID mock
// ---------------------------------------------------------------------------

let uuidCounter = 0;

beforeEach(() => {
  store = {};
  uuidCounter = 0;
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });
  mockLocalStorage.getItem.mockImplementation((key: string) => store[key] ?? null);
  mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
    store[key] = value;
  });
  mockLocalStorage.removeItem.mockImplementation((key: string) => {
    delete store[key];
  });
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    uuidCounter++;
    return `mock-uuid-${uuidCounter}` as ReturnType<typeof crypto.randomUUID>;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRecipes', () => {
  // ---- getAll / initial state ----

  describe('initial state', () => {
    it('returns empty array when localStorage is empty', () => {
      const { result } = renderHook(() => useRecipes());
      expect(result.current.recipes).toEqual([]);
    });

    it('restores valid saved recipes on mount', () => {
      const saved = [makeSavedRecipe()];
      store[STORAGE_KEY] = JSON.stringify(saved);

      const { result } = renderHook(() => useRecipes());
      expect(result.current.recipes).toHaveLength(1);
      expect(result.current.recipes[0].id).toBe('test-uuid-1');
      expect(result.current.recipes[0].recipe.name).toBe('Chocolate Chip Cookies');
      expect(result.current.recipes[0].targetCostRatio).toBe(0.3);
    });

    it('filters out invalid entries from stored data', () => {
      const data = [
        makeSavedRecipe({ id: 'valid-1' }),
        { id: 'bad', version: 99 }, // wrong version
        makeSavedRecipe({ id: 'valid-2', recipe: makeRecipe({ name: 'Brownies' }) }),
      ];
      store[STORAGE_KEY] = JSON.stringify(data);

      const { result } = renderHook(() => useRecipes());
      expect(result.current.recipes).toHaveLength(2);
      expect(result.current.recipes[0].id).toBe('valid-1');
      expect(result.current.recipes[1].id).toBe('valid-2');
    });

    it('clears and returns empty on corrupt JSON', () => {
      store[STORAGE_KEY] = '{not valid json!!!';

      const { result } = renderHook(() => useRecipes());
      expect(result.current.recipes).toEqual([]);
      expect(store[STORAGE_KEY]).toBeUndefined();
    });

    it('clears and returns empty when stored data is not an array', () => {
      store[STORAGE_KEY] = JSON.stringify({ notAnArray: true });

      const { result } = renderHook(() => useRecipes());
      expect(result.current.recipes).toEqual([]);
      expect(store[STORAGE_KEY]).toBeUndefined();
    });
  });

  // ---- save() ----

  describe('save()', () => {
    it('generates unique id and correct timestamps', () => {
      const now = new Date('2026-04-01T10:00:00.000Z');
      vi.setSystemTime(now);

      const { result } = renderHook(() => useRecipes());
      let saved: SavedRecipe;

      act(() => {
        saved = result.current.save(makeRecipe(), 0.3);
      });

      expect(saved!.id).toBe('mock-uuid-1');
      expect(saved!.version).toBe(1);
      expect(saved!.savedAt).toBe('2026-04-01T10:00:00.000Z');
      expect(saved!.updatedAt).toBe('2026-04-01T10:00:00.000Z');
      expect(saved!.targetCostRatio).toBe(0.3);

      vi.useRealTimers();
    });

    it('appends to recipes array and writes to localStorage', () => {
      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.save(makeRecipe({ name: 'Brownies' }), 0.25);
      });

      expect(result.current.recipes).toHaveLength(1);
      expect(result.current.recipes[0].recipe.name).toBe('Brownies');
      expect(result.current.recipes[0].targetCostRatio).toBe(0.25);

      // Verify localStorage was updated
      const stored = JSON.parse(store[STORAGE_KEY]);
      expect(stored).toHaveLength(1);
      expect(stored[0].recipe.name).toBe('Brownies');
    });

    it('generates different UUIDs for multiple saves', () => {
      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.save(makeRecipe({ name: 'Recipe A' }), 0.3);
      });
      act(() => {
        result.current.save(makeRecipe({ name: 'Recipe B' }), 0.35);
      });

      expect(result.current.recipes).toHaveLength(2);
      expect(result.current.recipes[0].id).toBe('mock-uuid-1');
      expect(result.current.recipes[1].id).toBe('mock-uuid-2');
    });

    it('preserves existing recipes when saving a new one', () => {
      store[STORAGE_KEY] = JSON.stringify([makeSavedRecipe({ id: 'existing-1' })]);

      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.save(makeRecipe({ name: 'New Recipe' }), 0.4);
      });

      expect(result.current.recipes).toHaveLength(2);
      expect(result.current.recipes[0].id).toBe('existing-1');
      expect(result.current.recipes[1].recipe.name).toBe('New Recipe');
    });
  });

  // ---- update() ----

  describe('update()', () => {
    it('updates recipe data and updatedAt, preserves savedAt', () => {
      const originalSavedAt = '2026-03-01T10:00:00.000Z';
      store[STORAGE_KEY] = JSON.stringify([
        makeSavedRecipe({
          id: 'recipe-1',
          savedAt: originalSavedAt,
          updatedAt: originalSavedAt,
        }),
      ]);

      const now = new Date('2026-04-01T14:00:00.000Z');
      vi.setSystemTime(now);

      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.update('recipe-1', makeRecipe({ name: 'Updated Cookies' }), 0.35);
      });

      const updated = result.current.recipes[0];
      expect(updated.recipe.name).toBe('Updated Cookies');
      expect(updated.targetCostRatio).toBe(0.35);
      expect(updated.savedAt).toBe(originalSavedAt); // preserved!
      expect(updated.updatedAt).toBe('2026-04-01T14:00:00.000Z'); // updated!

      vi.useRealTimers();
    });

    it('writes updated data to localStorage', () => {
      store[STORAGE_KEY] = JSON.stringify([makeSavedRecipe({ id: 'recipe-1' })]);

      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.update('recipe-1', makeRecipe({ name: 'Updated' }), 0.4);
      });

      const stored = JSON.parse(store[STORAGE_KEY]);
      expect(stored[0].recipe.name).toBe('Updated');
      expect(stored[0].targetCostRatio).toBe(0.4);
    });

    it('does not modify other recipes', () => {
      store[STORAGE_KEY] = JSON.stringify([
        makeSavedRecipe({ id: 'recipe-1', recipe: makeRecipe({ name: 'Original A' }) }),
        makeSavedRecipe({ id: 'recipe-2', recipe: makeRecipe({ name: 'Original B' }) }),
      ]);

      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.update('recipe-1', makeRecipe({ name: 'Updated A' }), 0.5);
      });

      expect(result.current.recipes[0].recipe.name).toBe('Updated A');
      expect(result.current.recipes[1].recipe.name).toBe('Original B');
    });

    it('preserves version on update', () => {
      store[STORAGE_KEY] = JSON.stringify([makeSavedRecipe({ id: 'recipe-1' })]);

      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.update('recipe-1', makeRecipe(), 0.5);
      });

      expect(result.current.recipes[0].version).toBe(1);
    });
  });

  // ---- remove() ----

  describe('remove()', () => {
    it('removes the specified recipe', () => {
      store[STORAGE_KEY] = JSON.stringify([
        makeSavedRecipe({ id: 'recipe-1' }),
        makeSavedRecipe({ id: 'recipe-2' }),
      ]);

      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.remove('recipe-1');
      });

      expect(result.current.recipes).toHaveLength(1);
      expect(result.current.recipes[0].id).toBe('recipe-2');
    });

    it('writes updated list to localStorage', () => {
      store[STORAGE_KEY] = JSON.stringify([
        makeSavedRecipe({ id: 'recipe-1' }),
        makeSavedRecipe({ id: 'recipe-2' }),
      ]);

      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.remove('recipe-1');
      });

      const stored = JSON.parse(store[STORAGE_KEY]);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('recipe-2');
    });

    it('does nothing when id does not exist', () => {
      store[STORAGE_KEY] = JSON.stringify([makeSavedRecipe({ id: 'recipe-1' })]);

      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.remove('nonexistent');
      });

      expect(result.current.recipes).toHaveLength(1);
    });
  });

  // ---- exportAll() ----

  describe('exportAll()', () => {
    it('returns JSON string of all recipes', () => {
      const recipes = [
        makeSavedRecipe({ id: 'r1', recipe: makeRecipe({ name: 'Cookies' }) }),
        makeSavedRecipe({ id: 'r2', recipe: makeRecipe({ name: 'Brownies' }) }),
      ];
      store[STORAGE_KEY] = JSON.stringify(recipes);

      const { result } = renderHook(() => useRecipes());
      let exported: string;

      act(() => {
        exported = result.current.exportAll();
      });

      const parsed = JSON.parse(exported!);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('r1');
      expect(parsed[1].id).toBe('r2');
    });

    it('does not include license key data', () => {
      // Simulate license key in a different localStorage key
      store['recipecalc_license'] = JSON.stringify({
        key: 'secret-license-key',
        instanceId: 'inst-123',
      });
      store[STORAGE_KEY] = JSON.stringify([makeSavedRecipe()]);

      const { result } = renderHook(() => useRecipes());
      let exported: string;

      act(() => {
        exported = result.current.exportAll();
      });

      // Exported JSON should not contain license data
      expect(exported!).not.toContain('secret-license-key');
      expect(exported!).not.toContain('inst-123');
      expect(exported!).not.toContain('recipecalc_license');
    });

    it('returns empty array JSON when no recipes exist', () => {
      const { result } = renderHook(() => useRecipes());
      let exported: string;

      act(() => {
        exported = result.current.exportAll();
      });

      expect(JSON.parse(exported!)).toEqual([]);
    });
  });

  // ---- importRecipes() ----

  describe('importRecipes()', () => {
    it('imports valid recipes and deduplicates by id', () => {
      store[STORAGE_KEY] = JSON.stringify([
        makeSavedRecipe({ id: 'existing-1', recipe: makeRecipe({ name: 'Existing' }) }),
      ]);

      const incoming = JSON.stringify([
        makeSavedRecipe({ id: 'existing-1', recipe: makeRecipe({ name: 'Duplicate' }) }),
        makeSavedRecipe({ id: 'new-1', recipe: makeRecipe({ name: 'New Recipe' }) }),
      ]);

      const { result } = renderHook(() => useRecipes());
      let importResult: { added: number; skipped: number };

      act(() => {
        importResult = result.current.importRecipes(incoming);
      });

      expect(importResult!.added).toBe(1);
      expect(importResult!.skipped).toBe(1);
      expect(result.current.recipes).toHaveLength(2);
      // Existing recipe should NOT be overwritten
      expect(result.current.recipes[0].recipe.name).toBe('Existing');
      expect(result.current.recipes[1].id).toBe('new-1');
    });

    it('does not overwrite existing recipes with imported ones', () => {
      const original = makeSavedRecipe({
        id: 'recipe-1',
        recipe: makeRecipe({ name: 'Original' }),
        targetCostRatio: 0.3,
      });
      store[STORAGE_KEY] = JSON.stringify([original]);

      const incoming = JSON.stringify([
        makeSavedRecipe({
          id: 'recipe-1',
          recipe: makeRecipe({ name: 'Import Override Attempt' }),
          targetCostRatio: 0.5,
        }),
      ]);

      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.importRecipes(incoming);
      });

      expect(result.current.recipes).toHaveLength(1);
      expect(result.current.recipes[0].recipe.name).toBe('Original');
      expect(result.current.recipes[0].targetCostRatio).toBe(0.3);
    });

    it('writes merged data to localStorage', () => {
      store[STORAGE_KEY] = JSON.stringify([makeSavedRecipe({ id: 'existing-1' })]);

      const incoming = JSON.stringify([
        makeSavedRecipe({ id: 'new-1', recipe: makeRecipe({ name: 'Imported' }) }),
      ]);

      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.importRecipes(incoming);
      });

      const stored = JSON.parse(store[STORAGE_KEY]);
      expect(stored).toHaveLength(2);
    });

    it('handles invalid JSON gracefully', () => {
      const { result } = renderHook(() => useRecipes());
      let importResult: { added: number; skipped: number };

      act(() => {
        importResult = result.current.importRecipes('{not valid json');
      });

      expect(importResult!.added).toBe(0);
      expect(importResult!.skipped).toBe(0);
      expect(result.current.recipes).toEqual([]);
    });

    it('handles non-array JSON gracefully', () => {
      const { result } = renderHook(() => useRecipes());
      let importResult: { added: number; skipped: number };

      act(() => {
        importResult = result.current.importRecipes(JSON.stringify({ not: 'array' }));
      });

      expect(importResult!.added).toBe(0);
      expect(importResult!.skipped).toBe(0);
    });

    it('filters out invalid entries from import data', () => {
      const incoming = JSON.stringify([
        makeSavedRecipe({ id: 'valid-1' }),
        { id: 'bad', version: 99 }, // invalid
        { id: 'also-bad' }, // missing fields
      ]);

      const { result } = renderHook(() => useRecipes());
      let importResult: { added: number; skipped: number };

      act(() => {
        importResult = result.current.importRecipes(incoming);
      });

      expect(importResult!.added).toBe(1);
      expect(result.current.recipes).toHaveLength(1);
      expect(result.current.recipes[0].id).toBe('valid-1');
    });

    it('imports into empty list successfully', () => {
      const incoming = JSON.stringify([
        makeSavedRecipe({ id: 'import-1' }),
        makeSavedRecipe({ id: 'import-2', recipe: makeRecipe({ name: 'Brownies' }) }),
      ]);

      const { result } = renderHook(() => useRecipes());
      let importResult: { added: number; skipped: number };

      act(() => {
        importResult = result.current.importRecipes(incoming);
      });

      expect(importResult!.added).toBe(2);
      expect(importResult!.skipped).toBe(0);
      expect(result.current.recipes).toHaveLength(2);
    });
  });

  // ---- Graceful degradation ----

  describe('graceful degradation', () => {
    it('handles localStorage throwing on getItem', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('SecurityError');
      });

      const { result } = renderHook(() => useRecipes());
      expect(result.current.recipes).toEqual([]);
    });

    it('handles localStorage throwing on setItem (quota exceeded)', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const { result } = renderHook(() => useRecipes());

      // save should not throw
      act(() => {
        result.current.save(makeRecipe(), 0.3);
      });

      // State is still updated in memory even if persist fails
      expect(result.current.recipes).toHaveLength(1);
    });
  });

  // ---- Roundtrip ----

  describe('roundtrip', () => {
    it('save → export → import into fresh state preserves data', () => {
      // Save some recipes
      const { result: r1 } = renderHook(() => useRecipes());

      act(() => {
        r1.current.save(makeRecipe({ name: 'Sourdough' }), 0.3);
      });
      act(() => {
        r1.current.save(makeRecipe({ name: 'Brownies' }), 0.25);
      });

      // Export
      let exported: string;
      act(() => {
        exported = r1.current.exportAll();
      });

      // Clear localStorage to simulate fresh browser
      store = {};

      // Import into fresh state
      const { result: r2 } = renderHook(() => useRecipes());
      expect(r2.current.recipes).toEqual([]);

      act(() => {
        r2.current.importRecipes(exported!);
      });

      expect(r2.current.recipes).toHaveLength(2);
      expect(r2.current.recipes[0].recipe.name).toBe('Sourdough');
      expect(r2.current.recipes[0].targetCostRatio).toBe(0.3);
      expect(r2.current.recipes[1].recipe.name).toBe('Brownies');
      expect(r2.current.recipes[1].targetCostRatio).toBe(0.25);
    });

    it('uses laborAndOverhead naming (not hiddenCosts)', () => {
      const { result } = renderHook(() => useRecipes());

      act(() => {
        result.current.save(makeRecipe(), 0.3);
      });

      const stored = JSON.parse(store[STORAGE_KEY]);
      expect(stored[0].recipe.laborAndOverhead).toBeDefined();
      expect(stored[0].recipe.hiddenCosts).toBeUndefined();
    });
  });
});
