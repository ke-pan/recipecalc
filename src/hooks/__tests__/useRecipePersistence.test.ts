import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecipePersistence } from '../useRecipePersistence.js';
import type { Recipe } from '../../lib/calc/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'recipepricer_current';

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

function makePersistedJSON(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    step: 2,
    recipe: makeRecipe(),
    ...overrides,
  });
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

beforeEach(() => {
  store = {};
  vi.useFakeTimers();
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
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRecipePersistence', () => {
  // ---- Restore ----

  it('returns null savedData when localStorage is empty', () => {
    const { result } = renderHook(() => useRecipePersistence());
    expect(result.current.savedData).toBeNull();
    expect(result.current.showResume).toBe(false);
  });

  it('restores valid persisted data on mount', () => {
    store[STORAGE_KEY] = makePersistedJSON();
    const { result } = renderHook(() => useRecipePersistence());

    expect(result.current.savedData).not.toBeNull();
    expect(result.current.savedData!.version).toBe(1);
    expect(result.current.savedData!.step).toBe(2);
    expect(result.current.savedData!.recipe.name).toBe('Chocolate Chip Cookies');
    expect(result.current.showResume).toBe(true);
  });

  it('clears corrupt JSON and returns null', () => {
    store[STORAGE_KEY] = '{not valid json!!!';
    const { result } = renderHook(() => useRecipePersistence());

    expect(result.current.savedData).toBeNull();
    expect(result.current.showResume).toBe(false);
    // Should have cleaned up the corrupt data
    expect(store[STORAGE_KEY]).toBeUndefined();
  });

  it('clears data with wrong version and returns null', () => {
    store[STORAGE_KEY] = JSON.stringify({
      version: 99,
      step: 1,
      recipe: makeRecipe(),
    });
    const { result } = renderHook(() => useRecipePersistence());

    expect(result.current.savedData).toBeNull();
    expect(store[STORAGE_KEY]).toBeUndefined();
  });

  it('clears data with missing recipe name and returns null', () => {
    store[STORAGE_KEY] = JSON.stringify({
      version: 1,
      step: 0,
      recipe: { quantity: 5 },
    });
    const { result } = renderHook(() => useRecipePersistence());

    expect(result.current.savedData).toBeNull();
    expect(store[STORAGE_KEY]).toBeUndefined();
  });

  // ---- Save (debounced) ----

  it('debounces save calls by 500ms', () => {
    const { result } = renderHook(() => useRecipePersistence());
    const recipe = makeRecipe({ name: 'Brownies' });

    act(() => {
      result.current.save(1, recipe);
    });

    // Should NOT have written yet
    expect(store[STORAGE_KEY]).toBeUndefined();

    // Advance halfway — still nothing
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(store[STORAGE_KEY]).toBeUndefined();

    // Advance to 500ms — should flush
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(store[STORAGE_KEY]).toBeDefined();
    const saved = JSON.parse(store[STORAGE_KEY]);
    expect(saved.version).toBe(1);
    expect(saved.step).toBe(1);
    expect(saved.recipe.name).toBe('Brownies');
  });

  it('resets debounce timer on rapid save calls', () => {
    const { result } = renderHook(() => useRecipePersistence());
    const recipe1 = makeRecipe({ name: 'First' });
    const recipe2 = makeRecipe({ name: 'Second' });

    act(() => {
      result.current.save(0, recipe1);
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(store[STORAGE_KEY]).toBeUndefined();

    // New save resets the timer
    act(() => {
      result.current.save(1, recipe2);
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });
    // Still shouldn't have flushed (only 400ms since second call)
    expect(store[STORAGE_KEY]).toBeUndefined();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    // Now 500ms from second call — should have the second recipe
    const saved = JSON.parse(store[STORAGE_KEY]);
    expect(saved.recipe.name).toBe('Second');
    expect(saved.step).toBe(1);
  });

  // ---- Clear ----

  it('clear() removes stored data and cancels pending save', () => {
    store[STORAGE_KEY] = makePersistedJSON();
    const { result } = renderHook(() => useRecipePersistence());

    // Queue a save then clear
    act(() => {
      result.current.save(3, makeRecipe({ name: 'Pending' }));
    });

    act(() => {
      result.current.clear();
    });

    expect(store[STORAGE_KEY]).toBeUndefined();

    // Advance timer — the pending save should have been cancelled
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(store[STORAGE_KEY]).toBeUndefined();
  });

  // ---- Dismiss ----

  it('dismiss() sets showResume to false', () => {
    store[STORAGE_KEY] = makePersistedJSON();
    const { result } = renderHook(() => useRecipePersistence());

    expect(result.current.showResume).toBe(true);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.showResume).toBe(false);
    // savedData should still be available for the consumer to use
    expect(result.current.savedData).not.toBeNull();
  });

  // ---- Graceful degradation ----

  it('gracefully handles localStorage throwing on setItem (quota exceeded)', () => {
    mockLocalStorage.setItem.mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    const { result } = renderHook(() => useRecipePersistence());

    // save should not throw
    act(() => {
      result.current.save(0, makeRecipe());
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // No crash — verify hook still works
    expect(result.current.showResume).toBe(false);
  });

  it('gracefully handles localStorage being completely unavailable', () => {
    // Make the availability check throw
    mockLocalStorage.setItem.mockImplementation(() => {
      throw new Error('SecurityError');
    });
    mockLocalStorage.getItem.mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const { result } = renderHook(() => useRecipePersistence());

    expect(result.current.savedData).toBeNull();
    expect(result.current.showResume).toBe(false);

    // save and clear should not throw
    act(() => {
      result.current.save(0, makeRecipe());
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      result.current.clear();
    });
  });

  // ---- Roundtrip ----

  it('save → reload → restore produces identical data', () => {
    const recipe = makeRecipe({ name: 'Sourdough Loaf' });

    // First render: save data
    const { result: r1 } = renderHook(() => useRecipePersistence());
    act(() => {
      r1.current.save(2, recipe);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Second render: restore data (simulates page reload)
    const { result: r2 } = renderHook(() => useRecipePersistence());
    expect(r2.current.savedData).not.toBeNull();
    expect(r2.current.savedData!.version).toBe(1);
    expect(r2.current.savedData!.step).toBe(2);
    expect(r2.current.savedData!.recipe.name).toBe('Sourdough Loaf');
    expect(r2.current.savedData!.recipe.quantity).toBe(24);
    expect(r2.current.showResume).toBe(true);
  });
});
