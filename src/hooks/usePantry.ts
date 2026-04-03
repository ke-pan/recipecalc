import { useState, useCallback } from 'react';
import type { PantryItem } from '../types/pantry.js';
import { readRecipes } from './useRecipes.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'recipepricer_pantry';

function migrateStorageKey() {
  try {
    const old = localStorage.getItem('recipecalc_pantry');
    if (old && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, old);
      localStorage.removeItem('recipecalc_pantry');
    }
  } catch {}
}
migrateStorageKey();

// ---------------------------------------------------------------------------
// Helpers (same safe-storage pattern as useRecipes)
// ---------------------------------------------------------------------------

/** Safely run a localStorage operation, returning undefined on failure. */
function safeStorage<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function isValidPantryItem(item: unknown): item is PantryItem {
  if (!item || typeof item !== 'object') return false;
  const d = item as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    typeof d.name === 'string' &&
    typeof d.ingredientKey === 'string' &&
    typeof d.purchaseUnit === 'string' &&
    typeof d.purchaseAmount === 'number' &&
    typeof d.purchasePrice === 'number' &&
    typeof d.updatedAt === 'string'
  );
}

export function readPantry(): PantryItem[] {
  const raw = safeStorage(() => localStorage.getItem(STORAGE_KEY));
  if (!raw) return [];

  const parsed = safeStorage(() => JSON.parse(raw));
  if (!Array.isArray(parsed)) {
    // Corrupt data — clear it
    safeStorage(() => localStorage.removeItem(STORAGE_KEY));
    return [];
  }

  // Filter to only valid entries (tolerant of partial corruption)
  return parsed.filter(isValidPantryItem);
}

function writePantry(items: PantryItem[]): void {
  safeStorage(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(items)));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePantryReturn {
  pantry: PantryItem[];
  add: (item: Omit<PantryItem, 'id' | 'updatedAt'>) => PantryItem | false;
  update: (id: string, changes: Partial<Omit<PantryItem, 'id' | 'updatedAt'>>) => boolean;
  remove: (id: string) => void;
  findByName: (name: string) => PantryItem | undefined;
  getReferencingRecipeCount: (id: string) => number;
  importItems: (items: PantryItem[]) => { added: number; skipped: number };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePantry(): UsePantryReturn {
  const [pantry, setPantry] = useState<PantryItem[]>(() => readPantry());

  const add = useCallback(
    (item: Omit<PantryItem, 'id' | 'updatedAt'>): PantryItem | false => {
      let result: PantryItem | false = false;
      setPantry((prev) => {
        // Name uniqueness check (case-insensitive)
        const duplicate = prev.some(
          (existing) => existing.name.toLowerCase() === item.name.toLowerCase(),
        );
        if (duplicate) {
          result = false;
          return prev;
        }

        const entry: PantryItem = {
          ...item,
          id: crypto.randomUUID(),
          updatedAt: new Date().toISOString(),
        };
        result = entry;
        const next = [...prev, entry];
        writePantry(next);
        return next;
      });
      return result;
    },
    [],
  );

  const update = useCallback(
    (id: string, changes: Partial<Omit<PantryItem, 'id' | 'updatedAt'>>): boolean => {
      let success = false;
      setPantry((prev) => {
        // If renaming, check for name uniqueness (case-insensitive)
        if (changes.name !== undefined) {
          const duplicate = prev.some(
            (existing) =>
              existing.id !== id &&
              existing.name.toLowerCase() === changes.name!.toLowerCase(),
          );
          if (duplicate) {
            success = false;
            return prev;
          }
        }

        const idx = prev.findIndex((item) => item.id === id);
        if (idx === -1) {
          success = false;
          return prev;
        }

        success = true;
        const next = prev.map((item) =>
          item.id === id
            ? { ...item, ...changes, id, updatedAt: new Date().toISOString() }
            : item,
        );
        writePantry(next);
        return next;
      });
      return success;
    },
    [],
  );

  const remove = useCallback((id: string): void => {
    setPantry((prev) => {
      const next = prev.filter((item) => item.id !== id);
      writePantry(next);
      return next;
    });
  }, []);

  const findByName = useCallback(
    (name: string): PantryItem | undefined => {
      return pantry.find(
        (item) => item.name.toLowerCase() === name.toLowerCase(),
      );
    },
    [pantry],
  );

  const getReferencingRecipeCount = useCallback((id: string): number => {
    // Read recipes from localStorage (fresh read, not stale state)
    const recipes = readRecipes();
    return recipes.filter((saved) =>
      saved.recipe.ingredients.some(
        (ing) => (ing as unknown as Record<string, unknown>).pantryId === id,
      ),
    ).length;
  }, []);

  const importItems = useCallback(
    (items: PantryItem[]): { added: number; skipped: number } => {
      const validItems = items.filter(isValidPantryItem);
      let added = 0;
      let skipped = 0;

      setPantry((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const existingNames = new Set(prev.map((p) => p.name.toLowerCase()));
        const newEntries: PantryItem[] = [];

        for (const item of validItems) {
          if (existingIds.has(item.id) || existingNames.has(item.name.toLowerCase())) {
            skipped++;
          } else {
            newEntries.push(item);
            existingIds.add(item.id);
            existingNames.add(item.name.toLowerCase());
            added++;
          }
        }

        const next = [...prev, ...newEntries];
        writePantry(next);
        return next;
      });

      return { added, skipped };
    },
    [],
  );

  return { pantry, add, update, remove, findByName, getReferencingRecipeCount, importItems };
}
