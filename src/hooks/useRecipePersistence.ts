import { useState, useCallback, useRef, useEffect } from 'react';
import type { Recipe } from '../lib/calc/types.js';

export interface PersistedData {
  version: 1;
  step: number;
  recipe: Recipe;
}

export interface UseRecipePersistenceReturn {
  savedData: PersistedData | null;
  save: (step: number, recipe: Recipe) => void;
  clear: () => void;
  dismiss: () => void;
  showResume: boolean;
}

const STORAGE_KEY = 'recipecalc_current';
const DEBOUNCE_MS = 500;
const CURRENT_VERSION = 1;

/** Safely run a localStorage operation, returning undefined on failure. */
function safeStorage<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function isValidPersistedData(data: unknown): data is PersistedData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.version === CURRENT_VERSION &&
    typeof d.step === 'number' &&
    typeof d.recipe === 'object' &&
    d.recipe !== null &&
    typeof (d.recipe as Record<string, unknown>).name === 'string'
  );
}

function readPersistedData(): PersistedData | null {
  const raw = safeStorage(() => localStorage.getItem(STORAGE_KEY));
  if (!raw) return null;

  const parsed = safeStorage(() => JSON.parse(raw));
  if (isValidPersistedData(parsed)) return parsed;

  safeStorage(() => localStorage.removeItem(STORAGE_KEY));
  return null;
}

function writePersistedData(data: PersistedData): void {
  safeStorage(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)));
}

function clearPersistedData(): void {
  safeStorage(() => localStorage.removeItem(STORAGE_KEY));
}

export function useRecipePersistence(): UseRecipePersistenceReturn {
  const [savedData] = useState<PersistedData | null>(() => readPersistedData());
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const save = useCallback((step: number, recipe: Recipe) => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
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

  const dismiss = useCallback(() => setDismissed(true), []);

  const showResume = savedData !== null && !dismissed;

  return { savedData, save, clear, dismiss, showResume };
}
