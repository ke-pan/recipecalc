import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActivateSuccess = {
  ok: true;
  instanceId: string;
  activatedAt: string;
};

export type ActivateFailure = {
  ok: false;
  reason: 'invalid' | 'wrong_product' | 'limit_reached' | 'network';
};

export type ActivateResult = ActivateSuccess | ActivateFailure;

export interface LicenseInfo {
  keyPrefix: string;
}

export interface LicenseState {
  isUnlocked: boolean;
  isLoading: boolean;
  license: LicenseInfo | null;
}

export interface LicenseActions {
  activate: (key: string) => Promise<ActivateResult>;
  deactivate: () => void;
}

type LicenseContextValue = LicenseState & LicenseActions;

// ---------------------------------------------------------------------------
// localStorage hint (UI only — not a security boundary)
// ---------------------------------------------------------------------------

const HINT_KEY = 'recipecalc_license_hint';
const OLD_KEY = 'recipecalc_license';

function readHint(): { keyPrefix: string } | null {
  try {
    // New hint format
    const raw = localStorage.getItem(HINT_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (typeof data?.keyPrefix === 'string') return data;
    }

    // Legacy format: use as hint but don't delete until server confirms
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const data = JSON.parse(old);
      if (typeof data?.key === 'string') {
        return { keyPrefix: data.key.slice(0, 8) };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function writeHint(keyPrefix: string): void {
  try {
    localStorage.setItem(HINT_KEY, JSON.stringify({ keyPrefix }));
  } catch {}
}

function clearHint(): void {
  try {
    localStorage.removeItem(HINT_KEY);
  } catch {}
}

// ---------------------------------------------------------------------------
// Session check (deduplicated across multiple LicenseProvider instances)
// ---------------------------------------------------------------------------

interface SessionResponse {
  unlocked: boolean;
  keyPrefix?: string;
}

let sessionPromise: Promise<SessionResponse> | null = null;

function fetchSession(): Promise<SessionResponse> {
  if (!sessionPromise) {
    sessionPromise = fetch('/api/session')
      .then((r) => r.json() as Promise<SessionResponse>)
      .catch(() => ({ unlocked: false }));
  }
  return sessionPromise;
}

function invalidateSession(): void {
  sessionPromise = null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const LicenseContext = createContext<LicenseContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

// Temporary paywall bypass — set PUBLIC_FORCE_UNLOCK to "true" in wrangler.toml [vars].
// Remove this flag (and the checks below) once LemonSqueezy is configured.
const FORCE_UNLOCK = import.meta.env.PUBLIC_FORCE_UNLOCK === 'true';

export function LicenseProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage hint (prevents UI flicker for paid users)
  const [isUnlocked, setIsUnlocked] = useState(() => FORCE_UNLOCK || readHint() !== null);
  const [isLoading, setIsLoading] = useState(!FORCE_UNLOCK);
  const [license, setLicense] = useState<LicenseInfo | null>(() => FORCE_UNLOCK ? null : readHint());

  // Verify with server — server cookie is the real authority
  useEffect(() => {
    if (FORCE_UNLOCK) return;
    fetchSession().then((data) => {
      setIsUnlocked(data.unlocked);
      if (data.unlocked && data.keyPrefix) {
        setLicense({ keyPrefix: data.keyPrefix });
        writeHint(data.keyPrefix);
        // Clean up legacy key after server confirmation
        try { localStorage.removeItem(OLD_KEY); } catch {}
      } else {
        setLicense(null);
        clearHint();
      }
      setIsLoading(false);
    });
  }, []);

  const activate = useCallback(async (key: string): Promise<ActivateResult> => {
    try {
      const response = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const data = await response.json();

      if (data.ok) {
        invalidateSession();
        const prefix = key.slice(0, 8);
        writeHint(prefix);
        setIsUnlocked(true);
        setLicense({ keyPrefix: prefix });
        return {
          ok: true,
          instanceId: data.instanceId ?? '',
          activatedAt: data.activatedAt ?? new Date().toISOString(),
        };
      }
      return { ok: false, reason: data.reason };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }, []);

  const deactivate = useCallback(() => {
    fetch('/api/deactivate', { method: 'POST' }).catch(() => {});
    invalidateSession();
    clearHint();
    setIsUnlocked(false);
    setLicense(null);
  }, []);

  const value = useMemo<LicenseContextValue>(
    () => ({
      isUnlocked,
      isLoading,
      license,
      activate,
      deactivate,
    }),
    [isUnlocked, isLoading, license, activate, deactivate],
  );

  return (
    <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** @internal Reset session cache. Exported for testing only. */
export function _resetSessionCache(): void {
  invalidateSession();
}

export function useLicense(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return ctx;
}
