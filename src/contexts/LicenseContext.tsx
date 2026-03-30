import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  activateLicense as apiActivate,
  _env as lsEnv,
  type ActivateResult,
} from '../services/lemonsqueezy.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LicenseData {
  key: string;
  instanceId: string;
  activatedAt: string;
  storeId: string;
  productId: string;
}

export interface LicenseState {
  isUnlocked: boolean;
  license: LicenseData | null;
}

export interface LicenseActions {
  activate: (key: string) => Promise<ActivateResult>;
  deactivate: () => void;
}

type LicenseContextValue = LicenseState & LicenseActions;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'recipecalc_license';

// ---------------------------------------------------------------------------
// localStorage helpers (mirror useRecipePersistence pattern)
// ---------------------------------------------------------------------------

function safeStorage<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function isValidLicenseData(data: unknown): data is LicenseData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.key === 'string' &&
    d.key.length > 0 &&
    typeof d.instanceId === 'string' &&
    typeof d.activatedAt === 'string' &&
    typeof d.storeId === 'string' &&
    typeof d.productId === 'string'
  );
}

function readLicense(): LicenseData | null {
  const raw = safeStorage(() => localStorage.getItem(STORAGE_KEY));
  if (!raw) return null;

  const parsed = safeStorage(() => JSON.parse(raw));
  if (isValidLicenseData(parsed)) return parsed;

  // Corrupt data — clean up
  safeStorage(() => localStorage.removeItem(STORAGE_KEY));
  return null;
}

function writeLicense(data: LicenseData): void {
  safeStorage(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)));
}

function clearLicense(): void {
  safeStorage(() => localStorage.removeItem(STORAGE_KEY));
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const LicenseContext = createContext<LicenseContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [license, setLicense] = useState<LicenseData | null>(() => readLicense());

  const activate = useCallback(async (key: string): Promise<ActivateResult> => {
    const result = await apiActivate(key);

    if (result.ok) {
      const data: LicenseData = {
        key,
        instanceId: result.instanceId,
        activatedAt: result.activatedAt,
        storeId: lsEnv.storeId,
        productId: lsEnv.productId,
      };
      writeLicense(data);
      setLicense(data);
    }

    return result;
  }, []);

  const deactivate = useCallback(() => {
    clearLicense();
    setLicense(null);
  }, []);

  const value: LicenseContextValue = {
    isUnlocked: license !== null,
    license,
    activate,
    deactivate,
  };

  return (
    <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLicense(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return ctx;
}
