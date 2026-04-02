import { useState, useCallback } from 'react';
import type { Recipe } from '../lib/calc/types.js';
import type { PantryItem } from '../types/pantry.js';

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

/** v2 export format — includes pantry alongside recipes. */
export interface ExportDataV2 {
  version: 2;
  exportedAt: string;
  pantry: PantryItem[];
  recipes: SavedRecipe[];
}

/** Import result with recipe and pantry counts. */
export interface ImportResult {
  added: number;
  skipped: number;
  pantryAdded: number;
  pantrySkipped: number;
}

export interface UseRecipesReturn {
  recipes: SavedRecipe[];
  save: (recipe: Recipe, targetCostRatio: number) => SavedRecipe;
  update: (id: string, recipe: Recipe, targetCostRatio: number) => void;
  remove: (id: string) => void;
  exportAll: (pantry: PantryItem[]) => string;
  importRecipes: (json: string, importPantryItems?: (items: PantryItem[]) => { added: number; skipped: number }) => ImportResult;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'recipepricer_recipes';
const CURRENT_VERSION = 1;

function migrateStorageKey() {
  try {
    const old = localStorage.getItem('recipecalc_recipes');
    if (old && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, old);
      localStorage.removeItem('recipecalc_recipes');
    }
  } catch {}
}
migrateStorageKey();

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

  const exportAll = useCallback((pantry: PantryItem[]): string => {
    // Read fresh from localStorage to ensure we export the latest data.
    // Explicitly exclude any license key data — only recipe + pantry data is exported.
    const current = readRecipes();
    const data: ExportDataV2 = {
      version: 2,
      exportedAt: new Date().toISOString(),
      pantry,
      recipes: current,
    };
    return JSON.stringify(data, null, 2);
  }, []);

  const importRecipes = useCallback((
    json: string,
    importPantryItems?: (items: PantryItem[]) => { added: number; skipped: number },
  ): ImportResult => {
    let incoming: unknown;
    try {
      incoming = JSON.parse(json);
    } catch {
      return { added: 0, skipped: 0, pantryAdded: 0, pantrySkipped: 0 };
    }

    // Detect v1 (array of recipes) vs v2 (object with version: 2)
    let recipesData: unknown[];
    let pantryData: PantryItem[] = [];

    if (Array.isArray(incoming)) {
      // v1 format: plain array of SavedRecipe[]
      recipesData = incoming;
    } else if (
      incoming &&
      typeof incoming === 'object' &&
      (incoming as Record<string, unknown>).version === 2
    ) {
      // v2 format: { version: 2, exportedAt, pantry, recipes }
      const v2 = incoming as Record<string, unknown>;
      recipesData = Array.isArray(v2.recipes) ? v2.recipes : [];
      pantryData = Array.isArray(v2.pantry) ? v2.pantry : [];
    } else {
      return { added: 0, skipped: 0, pantryAdded: 0, pantrySkipped: 0 };
    }

    // Import pantry items if a handler is provided and we have pantry data
    let pantryAdded = 0;
    let pantrySkipped = 0;
    if (importPantryItems && pantryData.length > 0) {
      const pantryResult = importPantryItems(pantryData);
      pantryAdded = pantryResult.added;
      pantrySkipped = pantryResult.skipped;
    }

    // Import recipes
    const validEntries = recipesData.filter(isValidSavedRecipe);
    if (validEntries.length === 0) {
      return {
        added: 0,
        skipped: validEntries.length === 0 ? recipesData.length : 0,
        pantryAdded,
        pantrySkipped,
      };
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

    return { added, skipped, pantryAdded, pantrySkipped };
  }, []);

  return { recipes, save, update, remove, exportAll, importRecipes };
}
