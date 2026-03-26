import { useState, useCallback, useRef, useEffect } from 'react';
import type { Recipe } from '../lib/calc/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PersistedData {
  version: 1;
  step: number;
  recipe: Recipe;
}

export interface UseRecipePersistenceReturn {
  /** Restored data (null if nothing saved or data is corrupt) */
  savedData: PersistedData | null;
  /** Save current state (debounced 500ms) */
  save: (step: number, recipe: Recipe) => void;
  /** Clear saved data */
  clear: () => void;
  /** Mark resume as handled (user chose continue or start fresh) */
  dismiss: () => void;
  /** Whether to show the resume banner */
  showResume: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'recipecalc_current';
const DEBOUNCE_MS = 500;
const CURRENT_VERSION = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__recipecalc_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function readPersistedData(): PersistedData | null {
  if (!isLocalStorageAvailable()) return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // Validate structure
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.version === CURRENT_VERSION &&
      typeof parsed.step === 'number' &&
      parsed.recipe &&
      typeof parsed.recipe === 'object' &&
      typeof parsed.recipe.name === 'string'
    ) {
      return parsed as PersistedData;
    }

    // Invalid structure — clean up
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    // Corrupt JSON — clean up
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage might be totally broken — ignore
    }
    return null;
  }
}

function writePersistedData(data: PersistedData): void {
  if (!isLocalStorageAvailable()) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota exceeded or write failure — silently ignore
  }
}

function clearPersistedData(): void {
  if (!isLocalStorageAvailable()) return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRecipePersistence(): UseRecipePersistenceReturn {
  const [savedData] = useState<PersistedData | null>(() => readPersistedData());
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const save = useCallback((step: number, recipe: Recipe) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      writePersistedData({ version: CURRENT_VERSION, step, recipe });
      timerRef.current = null;
    }, DEBOUNCE_MS);
  }, []);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    clearPersistedData();
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const showResume = savedData !== null && !dismissed;

  return { savedData, save, clear, dismiss, showResume };
}
