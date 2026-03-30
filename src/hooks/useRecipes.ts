import { useState, useCallback } from 'react';
import type { Recipe } from '../lib/calc/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SavedRecipe {
  id: string;
  version: 1;
  savedAt: string;
  updatedAt: string;
  recipe: Recipe;
  targetCostRatio: number;
}

export interface UseRecipesReturn {
  recipes: SavedRecipe[];
  save: (recipe: Recipe, targetCostRatio: number) => SavedRecipe;
  update: (id: string, recipe: Recipe, targetCostRatio: number) => void;
  remove: (id: string) => void;
  exportAll: () => string;
  importRecipes: (json: string) => { added: number; skipped: number };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'recipecalc_recipes';
const CURRENT_VERSION = 1;

// ---------------------------------------------------------------------------
// Helpers (same safe-storage pattern as useRecipePersistence)
// ---------------------------------------------------------------------------

/** Safely run a localStorage operation, returning undefined on failure. */
function safeStorage<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function isValidSavedRecipe(item: unknown): item is SavedRecipe {
  if (!item || typeof item !== 'object') return false;
  const d = item as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    d.version === CURRENT_VERSION &&
    typeof d.savedAt === 'string' &&
    typeof d.updatedAt === 'string' &&
    typeof d.targetCostRatio === 'number' &&
    typeof d.recipe === 'object' &&
    d.recipe !== null &&
    typeof (d.recipe as Record<string, unknown>).name === 'string'
  );
}

export function readRecipes(): SavedRecipe[] {
  const raw = safeStorage(() => localStorage.getItem(STORAGE_KEY));
  if (!raw) return [];

  const parsed = safeStorage(() => JSON.parse(raw));
  if (!Array.isArray(parsed)) {
    // Corrupt data — clear it
    safeStorage(() => localStorage.removeItem(STORAGE_KEY));
    return [];
  }

  // Filter to only valid entries (tolerant of partial corruption)
  return parsed.filter(isValidSavedRecipe);
}

function writeRecipes(recipes: SavedRecipe[]): void {
  safeStorage(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes)));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRecipes(): UseRecipesReturn {
  const [recipes, setRecipes] = useState<SavedRecipe[]>(() => readRecipes());

  const save = useCallback((recipe: Recipe, targetCostRatio: number): SavedRecipe => {
    const now = new Date().toISOString();
    const entry: SavedRecipe = {
      id: crypto.randomUUID(),
      version: CURRENT_VERSION,
      savedAt: now,
      updatedAt: now,
      recipe,
      targetCostRatio,
    };
    setRecipes((prev) => {
      const next = [...prev, entry];
      writeRecipes(next);
      return next;
    });
    return entry;
  }, []);

  const update = useCallback((id: string, recipe: Recipe, targetCostRatio: number): void => {
    setRecipes((prev) => {
      const next = prev.map((item) =>
        item.id === id
          ? {
              ...item,
              recipe,
              targetCostRatio,
              updatedAt: new Date().toISOString(),
            }
          : item,
      );
      writeRecipes(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string): void => {
    setRecipes((prev) => {
      const next = prev.filter((item) => item.id !== id);
      writeRecipes(next);
      return next;
    });
  }, []);

  const exportAll = useCallback((): string => {
    // Read fresh from localStorage to ensure we export the latest data.
    // Explicitly exclude any license key data — only recipe data is exported.
    const current = readRecipes();
    return JSON.stringify(current, null, 2);
  }, []);

  const importRecipes = useCallback((json: string): { added: number; skipped: number } => {
    let incoming: unknown;
    try {
      incoming = JSON.parse(json);
    } catch {
      return { added: 0, skipped: 0 };
    }

    if (!Array.isArray(incoming)) {
      return { added: 0, skipped: 0 };
    }

    const validEntries = incoming.filter(isValidSavedRecipe);
    if (validEntries.length === 0) {
      return { added: 0, skipped: validEntries.length === 0 ? incoming.length : 0 };
    }

    let added = 0;
    let skipped = 0;

    setRecipes((prev) => {
      const existingIds = new Set(prev.map((r) => r.id));
      const newEntries: SavedRecipe[] = [];

      for (const entry of validEntries) {
        if (existingIds.has(entry.id)) {
          skipped++;
        } else {
          newEntries.push(entry);
          added++;
        }
      }

      const next = [...prev, ...newEntries];
      writeRecipes(next);
      return next;
    });

    return { added, skipped };
  }, []);

  return { recipes, save, update, remove, exportAll, importRecipes };
}
