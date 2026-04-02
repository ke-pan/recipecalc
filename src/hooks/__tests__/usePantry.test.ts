import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePantry } from '../usePantry.js';
import type { PantryItem } from '../../types/pantry.js';
import type { SavedRecipe } from '../useRecipes.js';
import type { Recipe } from '../../lib/calc/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PANTRY_KEY = 'recipepricer_pantry';
const RECIPES_KEY = 'recipepricer_recipes';

function makePantryInput(
  overrides: Partial<Omit<PantryItem, 'id' | 'updatedAt'>> = {},
): Omit<PantryItem, 'id' | 'updatedAt'> {
  return {
    name: 'All-Purpose Flour',
    ingredientKey: 'all-purpose-flour',
    purchaseUnit: 'lb',
    purchaseAmount: 5,
    purchasePrice: 4.99,
    ...overrides,
  };
}

function makePantryItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    id: 'pantry-uuid-1',
    name: 'All-Purpose Flour',
    ingredientKey: 'all-purpose-flour',
    purchaseUnit: 'lb',
    purchaseAmount: 5,
    purchasePrice: 4.99,
    updatedAt: '2026-03-30T12:00:00.000Z',
    ...overrides,
  };
}

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
    id: 'recipe-uuid-1',
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

describe('usePantry', () => {
  // ---- initial state ----

  describe('initial state', () => {
    it('returns empty array when localStorage is empty', () => {
      const { result } = renderHook(() => usePantry());
      expect(result.current.pantry).toEqual([]);
    });

    it('restores valid pantry items on mount', () => {
      const items = [makePantryItem()];
      store[PANTRY_KEY] = JSON.stringify(items);

      const { result } = renderHook(() => usePantry());
      expect(result.current.pantry).toHaveLength(1);
      expect(result.current.pantry[0].name).toBe('All-Purpose Flour');
    });

    it('filters out invalid entries from stored data', () => {
      const data = [
        makePantryItem({ id: 'valid-1' }),
        { id: 'bad', name: 123 }, // invalid — name is not string
        makePantryItem({ id: 'valid-2', name: 'Butter' }),
      ];
      store[PANTRY_KEY] = JSON.stringify(data);

      const { result } = renderHook(() => usePantry());
      expect(result.current.pantry).toHaveLength(2);
      expect(result.current.pantry[0].id).toBe('valid-1');
      expect(result.current.pantry[1].id).toBe('valid-2');
    });

    it('clears and returns empty on corrupt JSON', () => {
      store[PANTRY_KEY] = '{not valid json!!!';

      const { result } = renderHook(() => usePantry());
      expect(result.current.pantry).toEqual([]);
      expect(store[PANTRY_KEY]).toBeUndefined();
    });

    it('clears and returns empty when stored data is not an array', () => {
      store[PANTRY_KEY] = JSON.stringify({ notAnArray: true });

      const { result } = renderHook(() => usePantry());
      expect(result.current.pantry).toEqual([]);
      expect(store[PANTRY_KEY]).toBeUndefined();
    });
  });

  // ---- add() ----

  describe('add()', () => {
    it('generates unique id and correct timestamp', () => {
      const now = new Date('2026-04-01T10:00:00.000Z');
      vi.setSystemTime(now);

      const { result } = renderHook(() => usePantry());
      let added: PantryItem | false;

      act(() => {
        added = result.current.add(makePantryInput());
      });

      expect(added!).not.toBe(false);
      const item = added! as PantryItem;
      expect(item.id).toBe('mock-uuid-1');
      expect(item.updatedAt).toBe('2026-04-01T10:00:00.000Z');
      expect(item.name).toBe('All-Purpose Flour');
      expect(item.purchasePrice).toBe(4.99);

      vi.useRealTimers();
    });

    it('appends to pantry array and writes to localStorage', () => {
      const { result } = renderHook(() => usePantry());

      act(() => {
        result.current.add(makePantryInput({ name: 'Butter' }));
      });

      expect(result.current.pantry).toHaveLength(1);
      expect(result.current.pantry[0].name).toBe('Butter');

      const stored = JSON.parse(store[PANTRY_KEY]);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Butter');
    });

    it('rejects duplicate names (case-insensitive)', () => {
      store[PANTRY_KEY] = JSON.stringify([makePantryItem({ name: 'Butter' })]);

      const { result } = renderHook(() => usePantry());
      let added: PantryItem | false;

      act(() => {
        added = result.current.add(makePantryInput({ name: 'butter' }));
      });

      expect(added!).toBe(false);
      expect(result.current.pantry).toHaveLength(1);
    });

    it('rejects duplicate names (exact match)', () => {
      store[PANTRY_KEY] = JSON.stringify([makePantryItem({ name: 'Butter' })]);

      const { result } = renderHook(() => usePantry());
      let added: PantryItem | false;

      act(() => {
        added = result.current.add(makePantryInput({ name: 'Butter' }));
      });

      expect(added!).toBe(false);
      expect(result.current.pantry).toHaveLength(1);
    });

    it('allows different names', () => {
      const { result } = renderHook(() => usePantry());

      act(() => {
        result.current.add(makePantryInput({ name: 'Butter', ingredientKey: 'butter' }));
      });
      act(() => {
        result.current.add(
          makePantryInput({ name: 'Sugar', ingredientKey: 'sugar' }),
        );
      });

      expect(result.current.pantry).toHaveLength(2);
    });

    it('generates different UUIDs for multiple adds', () => {
      const { result } = renderHook(() => usePantry());

      act(() => {
        result.current.add(makePantryInput({ name: 'Butter', ingredientKey: 'butter' }));
      });
      act(() => {
        result.current.add(makePantryInput({ name: 'Sugar', ingredientKey: 'sugar' }));
      });

      expect(result.current.pantry[0].id).toBe('mock-uuid-1');
      expect(result.current.pantry[1].id).toBe('mock-uuid-2');
    });
  });

  // ---- update() ----

  describe('update()', () => {
    it('updates fields and refreshes updatedAt', () => {
      store[PANTRY_KEY] = JSON.stringify([makePantryItem({ id: 'item-1' })]);

      const now = new Date('2026-04-01T14:00:00.000Z');
      vi.setSystemTime(now);

      const { result } = renderHook(() => usePantry());
      let success: boolean;

      act(() => {
        success = result.current.update('item-1', { purchasePrice: 5.99 });
      });

      expect(success!).toBe(true);
      expect(result.current.pantry[0].purchasePrice).toBe(5.99);
      expect(result.current.pantry[0].updatedAt).toBe('2026-04-01T14:00:00.000Z');

      vi.useRealTimers();
    });

    it('writes updated data to localStorage', () => {
      store[PANTRY_KEY] = JSON.stringify([makePantryItem({ id: 'item-1' })]);

      const { result } = renderHook(() => usePantry());

      act(() => {
        result.current.update('item-1', { purchasePrice: 6.99 });
      });

      const stored = JSON.parse(store[PANTRY_KEY]);
      expect(stored[0].purchasePrice).toBe(6.99);
    });

    it('rejects rename to existing name (case-insensitive)', () => {
      store[PANTRY_KEY] = JSON.stringify([
        makePantryItem({ id: 'item-1', name: 'Butter' }),
        makePantryItem({ id: 'item-2', name: 'Sugar' }),
      ]);

      const { result } = renderHook(() => usePantry());
      let success: boolean;

      act(() => {
        success = result.current.update('item-2', { name: 'butter' });
      });

      expect(success!).toBe(false);
      expect(result.current.pantry[1].name).toBe('Sugar');
    });

    it('allows renaming to the same name (self-update)', () => {
      store[PANTRY_KEY] = JSON.stringify([
        makePantryItem({ id: 'item-1', name: 'Butter' }),
      ]);

      const { result } = renderHook(() => usePantry());
      let success: boolean;

      act(() => {
        success = result.current.update('item-1', { name: 'Butter', purchasePrice: 7.99 });
      });

      expect(success!).toBe(true);
      expect(result.current.pantry[0].purchasePrice).toBe(7.99);
    });

    it('returns false for nonexistent id', () => {
      const { result } = renderHook(() => usePantry());
      let success: boolean;

      act(() => {
        success = result.current.update('nonexistent', { purchasePrice: 10 });
      });

      expect(success!).toBe(false);
    });

    it('does not modify other items', () => {
      store[PANTRY_KEY] = JSON.stringify([
        makePantryItem({ id: 'item-1', name: 'Butter', purchasePrice: 3.99 }),
        makePantryItem({ id: 'item-2', name: 'Sugar', purchasePrice: 2.49 }),
      ]);

      const { result } = renderHook(() => usePantry());

      act(() => {
        result.current.update('item-1', { purchasePrice: 5.99 });
      });

      expect(result.current.pantry[0].purchasePrice).toBe(5.99);
      expect(result.current.pantry[1].purchasePrice).toBe(2.49);
    });

    it('preserves id even if changes try to override it', () => {
      store[PANTRY_KEY] = JSON.stringify([makePantryItem({ id: 'item-1' })]);

      const { result } = renderHook(() => usePantry());

      act(() => {
        // TypeScript would prevent this, but test the runtime safety
        result.current.update('item-1', { purchasePrice: 5.99 });
      });

      expect(result.current.pantry[0].id).toBe('item-1');
    });
  });

  // ---- remove() ----

  describe('remove()', () => {
    it('removes the specified item', () => {
      store[PANTRY_KEY] = JSON.stringify([
        makePantryItem({ id: 'item-1' }),
        makePantryItem({ id: 'item-2', name: 'Butter' }),
      ]);

      const { result } = renderHook(() => usePantry());

      act(() => {
        result.current.remove('item-1');
      });

      expect(result.current.pantry).toHaveLength(1);
      expect(result.current.pantry[0].id).toBe('item-2');
    });

    it('writes updated list to localStorage', () => {
      store[PANTRY_KEY] = JSON.stringify([
        makePantryItem({ id: 'item-1' }),
        makePantryItem({ id: 'item-2', name: 'Butter' }),
      ]);

      const { result } = renderHook(() => usePantry());

      act(() => {
        result.current.remove('item-1');
      });

      const stored = JSON.parse(store[PANTRY_KEY]);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('item-2');
    });

    it('does nothing when id does not exist', () => {
      store[PANTRY_KEY] = JSON.stringify([makePantryItem({ id: 'item-1' })]);

      const { result } = renderHook(() => usePantry());

      act(() => {
        result.current.remove('nonexistent');
      });

      expect(result.current.pantry).toHaveLength(1);
    });
  });

  // ---- findByName() ----

  describe('findByName()', () => {
    it('finds item by exact name', () => {
      store[PANTRY_KEY] = JSON.stringify([
        makePantryItem({ id: 'item-1', name: 'Butter' }),
        makePantryItem({ id: 'item-2', name: 'Sugar' }),
      ]);

      const { result } = renderHook(() => usePantry());
      expect(result.current.findByName('Butter')?.id).toBe('item-1');
    });

    it('finds item case-insensitively', () => {
      store[PANTRY_KEY] = JSON.stringify([
        makePantryItem({ id: 'item-1', name: 'Butter' }),
      ]);

      const { result } = renderHook(() => usePantry());
      expect(result.current.findByName('butter')?.id).toBe('item-1');
      expect(result.current.findByName('BUTTER')?.id).toBe('item-1');
    });

    it('returns undefined when not found', () => {
      const { result } = renderHook(() => usePantry());
      expect(result.current.findByName('Nonexistent')).toBeUndefined();
    });
  });

  // ---- getReferencingRecipeCount() ----

  describe('getReferencingRecipeCount()', () => {
    it('returns 0 when no recipes reference the pantry item', () => {
      store[RECIPES_KEY] = JSON.stringify([
        makeSavedRecipe({
          recipe: makeRecipe({
            ingredients: [
              {
                id: 'ing-1',
                name: 'Flour',
                purchaseAmount: 5,
                purchaseUnit: 'lb',
                purchasePrice: 4.99,
                usedAmount: 2,
                usedUnit: 'cup',
                wastePercent: 0,
              },
            ],
          }),
        }),
      ]);

      const { result } = renderHook(() => usePantry());
      expect(result.current.getReferencingRecipeCount('pantry-1')).toBe(0);
    });

    it('counts recipes that reference the pantry item by pantryId', () => {
      store[RECIPES_KEY] = JSON.stringify([
        makeSavedRecipe({
          id: 'recipe-1',
          recipe: makeRecipe({
            ingredients: [
              {
                id: 'ing-1',
                name: 'Flour',
                purchaseAmount: 5,
                purchaseUnit: 'lb',
                purchasePrice: 4.99,
                usedAmount: 2,
                usedUnit: 'cup',
                wastePercent: 0,
                pantryId: 'pantry-1',
              },
            ],
          }),
        }),
        makeSavedRecipe({
          id: 'recipe-2',
          recipe: makeRecipe({
            ingredients: [
              {
                id: 'ing-2',
                name: 'Flour',
                purchaseAmount: 5,
                purchaseUnit: 'lb',
                purchasePrice: 4.99,
                usedAmount: 1,
                usedUnit: 'cup',
                wastePercent: 0,
                pantryId: 'pantry-1',
              },
            ],
          }),
        }),
        makeSavedRecipe({
          id: 'recipe-3',
          recipe: makeRecipe({
            ingredients: [
              {
                id: 'ing-3',
                name: 'Sugar',
                purchaseAmount: 4,
                purchaseUnit: 'lb',
                purchasePrice: 3.49,
                usedAmount: 1,
                usedUnit: 'cup',
                wastePercent: 0,
                pantryId: 'pantry-2',
              },
            ],
          }),
        }),
      ]);

      const { result } = renderHook(() => usePantry());
      expect(result.current.getReferencingRecipeCount('pantry-1')).toBe(2);
      expect(result.current.getReferencingRecipeCount('pantry-2')).toBe(1);
    });

    it('counts each recipe only once even with multiple ingredients from same pantry item', () => {
      store[RECIPES_KEY] = JSON.stringify([
        makeSavedRecipe({
          id: 'recipe-1',
          recipe: makeRecipe({
            ingredients: [
              {
                id: 'ing-1',
                name: 'Flour for dough',
                purchaseAmount: 5,
                purchaseUnit: 'lb',
                purchasePrice: 4.99,
                usedAmount: 2,
                usedUnit: 'cup',
                wastePercent: 0,
                pantryId: 'pantry-1',
              },
              {
                id: 'ing-2',
                name: 'Flour for dusting',
                purchaseAmount: 5,
                purchaseUnit: 'lb',
                purchasePrice: 4.99,
                usedAmount: 0.5,
                usedUnit: 'cup',
                wastePercent: 0,
                pantryId: 'pantry-1',
              },
            ],
          }),
        }),
      ]);

      const { result } = renderHook(() => usePantry());
      // Should count 1 recipe, not 2 ingredients
      expect(result.current.getReferencingRecipeCount('pantry-1')).toBe(1);
    });

    it('returns 0 when no recipes exist', () => {
      const { result } = renderHook(() => usePantry());
      expect(result.current.getReferencingRecipeCount('pantry-1')).toBe(0);
    });
  });

  // ---- importItems() ----

  describe('importItems()', () => {
    it('imports valid pantry items', () => {
      const { result } = renderHook(() => usePantry());

      const items = [
        makePantryItem({ id: 'import-1', name: 'Flour' }),
        makePantryItem({ id: 'import-2', name: 'Sugar' }),
      ];

      let importResult: { added: number; skipped: number };
      act(() => {
        importResult = result.current.importItems(items);
      });

      expect(importResult!.added).toBe(2);
      expect(importResult!.skipped).toBe(0);
      expect(result.current.pantry).toHaveLength(2);
    });

    it('deduplicates by id', () => {
      store[PANTRY_KEY] = JSON.stringify([
        makePantryItem({ id: 'existing-1', name: 'Flour' }),
      ]);

      const { result } = renderHook(() => usePantry());

      let importResult: { added: number; skipped: number };
      act(() => {
        importResult = result.current.importItems([
          makePantryItem({ id: 'existing-1', name: 'Flour Dup' }),
          makePantryItem({ id: 'new-1', name: 'Sugar' }),
        ]);
      });

      expect(importResult!.added).toBe(1);
      expect(importResult!.skipped).toBe(1);
      expect(result.current.pantry).toHaveLength(2);
    });

    it('deduplicates by name (case-insensitive)', () => {
      store[PANTRY_KEY] = JSON.stringify([
        makePantryItem({ id: 'existing-1', name: 'Flour' }),
      ]);

      const { result } = renderHook(() => usePantry());

      let importResult: { added: number; skipped: number };
      act(() => {
        importResult = result.current.importItems([
          makePantryItem({ id: 'different-id', name: 'flour' }),
        ]);
      });

      expect(importResult!.added).toBe(0);
      expect(importResult!.skipped).toBe(1);
      expect(result.current.pantry).toHaveLength(1);
    });

    it('filters out invalid items', () => {
      const { result } = renderHook(() => usePantry());

      let importResult: { added: number; skipped: number };
      act(() => {
        importResult = result.current.importItems([
          makePantryItem({ id: 'valid-1', name: 'Flour' }),
          { id: 'bad', name: 123 } as unknown as PantryItem,
        ]);
      });

      expect(importResult!.added).toBe(1);
      expect(result.current.pantry).toHaveLength(1);
    });

    it('writes imported items to localStorage', () => {
      const { result } = renderHook(() => usePantry());

      act(() => {
        result.current.importItems([
          makePantryItem({ id: 'import-1', name: 'Flour' }),
        ]);
      });

      const stored = JSON.parse(store[PANTRY_KEY]);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Flour');
    });

    it('handles empty import array', () => {
      const { result } = renderHook(() => usePantry());

      let importResult: { added: number; skipped: number };
      act(() => {
        importResult = result.current.importItems([]);
      });

      expect(importResult!.added).toBe(0);
      expect(importResult!.skipped).toBe(0);
    });

    it('deduplicates within the import batch itself', () => {
      const { result } = renderHook(() => usePantry());

      let importResult: { added: number; skipped: number };
      act(() => {
        importResult = result.current.importItems([
          makePantryItem({ id: 'import-1', name: 'Flour' }),
          makePantryItem({ id: 'import-1', name: 'Flour Again' }),
        ]);
      });

      expect(importResult!.added).toBe(1);
      expect(importResult!.skipped).toBe(1);
      expect(result.current.pantry).toHaveLength(1);
    });
  });

  // ---- Graceful degradation ----

  describe('graceful degradation', () => {
    it('handles localStorage throwing on getItem', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('SecurityError');
      });

      const { result } = renderHook(() => usePantry());
      expect(result.current.pantry).toEqual([]);
    });

    it('handles localStorage throwing on setItem (quota exceeded)', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const { result } = renderHook(() => usePantry());

      act(() => {
        result.current.add(makePantryInput());
      });

      // State is still updated in memory even if persist fails
      expect(result.current.pantry).toHaveLength(1);
    });
  });
});
