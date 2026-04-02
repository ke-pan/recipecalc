import { useState, useCallback, type FormEvent } from 'react';
import { LicenseProvider, useLicense, type ActivateResult } from '../../contexts/LicenseContext.js';
import { trackEvent, EVENTS } from '../../lib/analytics';
import './activate.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivateState =
  | { phase: 'idle' }
  | { phase: 'validating' }
  | { phase: 'success' }
  | { phase: 'error'; reason: 'invalid' | 'wrong_product' | 'limit_reached' | 'network' };

// ---------------------------------------------------------------------------
// Error messages — 4 types per RFC 5.3
// ---------------------------------------------------------------------------

const ERROR_MESSAGES: Record<string, string> = {
  invalid: 'Invalid key. Double-check your purchase email.',
  wrong_product: 'This key is for a different product.',
  limit_reached: 'This key has reached its activation limit. Contact support.',
  network: 'Connection error. Please try again.',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---------------------------------------------------------------------------
// Confetti — pure CSS, respects prefers-reduced-motion
// ---------------------------------------------------------------------------

function Confetti() {
  if (prefersReducedMotion()) return null;

  return (
    <div className="activate__confetti" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="activate__confetti-piece" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner component (needs LicenseContext)
// ---------------------------------------------------------------------------

function ActivateForm() {
  const { isUnlocked, license, activate } = useLicense();
  const [key, setKey] = useState('');
  const [state, setState] = useState<ActivateState>({ phase: 'idle' });

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = key.trim();
      if (!trimmed) return;

      setState({ phase: 'validating' });

      const result: ActivateResult = await activate(trimmed);

      if (result.ok) {
        trackEvent(EVENTS.ACTIVATE_SUCCESS, { channel: 'manual' });
        setState({ phase: 'success' });
      } else {
        trackEvent(EVENTS.ACTIVATE_FAIL, { reason: result.reason });
        setState({ phase: 'error', reason: result.reason });
      }
    },
    [key, activate],
  );

  const handleRetry = useCallback(() => {
    setState({ phase: 'idle' });
  }, []);

  // ---- Already activated (page refresh / returning user) ----
  if (isUnlocked && state.phase !== 'success') {
    return (
      <div className="activate__activated" data-testid="already-activated">
        <div className="activate__activated-badge" aria-hidden="true">
          &#x2714;
        </div>
        <h2 className="activate__activated-title">Already activated</h2>
        <p className="activate__activated-subtitle">
          Your license is active. You have full access.
        </p>
        {license?.keyPrefix && (
          <span className="activate__activated-key">
            {license.keyPrefix}...
          </span>
        )}
        <a href="/calculator" className="activate__btn activate__btn--success">
          Go to calculator
        </a>
      </div>
    );
  }

  // ---- SUCCESS state ----
  if (state.phase === 'success') {
    return (
      <div className="activate__success" data-testid="success-state">
        <Confetti />
        <div className="activate__checkmark" aria-hidden="true">
          &#x2714;
        </div>
        <h2 className="activate__success-title">You're unlocked!</h2>
        <p className="activate__success-subtitle">
          All paid features are now available.
        </p>
        <a href="/calculator" className="activate__btn activate__btn--success">
          Start calculating &rarr;
        </a>
      </div>
    );
  }

  // ---- IDLE / VALIDATING / ERROR states ----
  const isValidating = state.phase === 'validating';

  return (
    <>
      <h1 className="activate__title">Activate your license</h1>
      <p className="activate__subtitle">
        Enter the license key from your purchase email
      </p>

      <form className="activate__form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="activate__input"
          placeholder="Paste your license key"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            // Clear error when user types
            if (state.phase === 'error') setState({ phase: 'idle' });
          }}
          disabled={isValidating}
          autoFocus
          aria-label="License key"
        />

        <button
          type="submit"
          className="activate__btn"
          disabled={!key.trim() || isValidating}
        >
          {isValidating && <span className="activate__spinner" aria-hidden="true" />}
          {isValidating ? 'Activating...' : 'Activate'}
        </button>
      </form>

      <div aria-live="polite" data-testid="activate-status">
        {isValidating && (
          <span className="sr-only">Validating your license key...</span>
        )}
        {state.phase === 'error' && (
          <div className="activate__error" role="alert" data-testid="error-message">
            <span className="activate__error-icon" aria-hidden="true">&#x26A0;</span>
            <span className="activate__error-text">
              {ERROR_MESSAGES[state.reason]}
              {' '}
              <button
                type="button"
                onClick={handleRetry}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Try again
              </button>
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported component — wraps with LicenseProvider
// ---------------------------------------------------------------------------

export default function ActivatePage() {
  return (
    <LicenseProvider>
      <div className="activate">
        <div className="activate__card">
          <a href="/" className="activate__logo">
            RecipeCalc
          </a>
          <ActivateForm />
        </div>
      </div>
    </LicenseProvider>
  );
}
