import { useState, useCallback } from 'react';
import type { UserDefaults } from '../types/pantry.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'recipepricer_defaults';

function migrateStorageKey() {
  try {
    const old = localStorage.getItem('recipecalc_defaults');
    if (old && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, old);
      localStorage.removeItem('recipecalc_defaults');
    }
  } catch {}
}
migrateStorageKey();

const DEFAULT_VALUES: UserDefaults = {
  hourlyRate: 0,
  packaging: 0,
  overhead: 0,
  platformFees: 0,
};

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

function isValidUserDefaults(data: unknown): data is UserDefaults {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.hourlyRate === 'number' &&
    typeof d.packaging === 'number' &&
    typeof d.overhead === 'number' &&
    typeof d.platformFees === 'number'
  );
}

function readDefaults(): UserDefaults {
  const raw = safeStorage(() => localStorage.getItem(STORAGE_KEY));
  if (!raw) return { ...DEFAULT_VALUES };

  const parsed = safeStorage(() => JSON.parse(raw));
  if (isValidUserDefaults(parsed)) return parsed;

  // Corrupt data — clear it and return defaults
  safeStorage(() => localStorage.removeItem(STORAGE_KEY));
  return { ...DEFAULT_VALUES };
}

function writeDefaults(defaults: UserDefaults): void {
  safeStorage(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults)));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseDefaultsReturn {
  defaults: UserDefaults;
  update: (changes: Partial<UserDefaults>) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDefaults(): UseDefaultsReturn {
  const [defaults, setDefaults] = useState<UserDefaults>(() => readDefaults());

  const update = useCallback((changes: Partial<UserDefaults>): void => {
    setDefaults((prev) => {
      const next = { ...prev, ...changes };
      writeDefaults(next);
      return next;
    });
  }, []);

  return { defaults, update };
}
