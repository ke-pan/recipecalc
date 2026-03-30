/**
 * React hook wrapping Lemon.js checkout overlay + auto-activation.
 *
 * Usage:
 *   const { openCheckout } = useLemonCheckout();
 *   <button onClick={() => openCheckout()}>Get Your Price</button>
 *
 * On mount, calls `setupLemonSqueezy()` with an activation callback wired
 * to `LicenseContext.activate()`. When the user completes checkout inside the
 * overlay, the `Checkout.Success` event fires, the license key is extracted
 * in memory, and `activate(key)` is called automatically.
 */

import { useEffect, useCallback, useRef } from 'react';
import {
  setupLemonSqueezy,
  openCheckout as lemonOpenCheckout,
} from '../lib/lemonjs.js';
import { useLicense } from '../contexts/LicenseContext.js';

const DEFAULT_CHECKOUT_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_LS_CHECKOUT_URL
    ? String(import.meta.env.PUBLIC_LS_CHECKOUT_URL)
    : '';

export interface UseLemonCheckoutReturn {
  /** Open the LemonSqueezy checkout overlay. */
  openCheckout: (checkoutUrl?: string) => void;
}

export function useLemonCheckout(): UseLemonCheckoutReturn {
  const { activate } = useLicense();

  // Keep a stable ref to activate so the setup callback always uses the
  // latest version without re-running the effect.
  const activateRef = useRef(activate);
  activateRef.current = activate;

  useEffect(() => {
    setupLemonSqueezy((licenseKey: string) => {
      activateRef.current(licenseKey);
    });
  }, []);

  const openCheckout = useCallback(
    (checkoutUrl?: string) => {
      const url = checkoutUrl || DEFAULT_CHECKOUT_URL;
      if (!url) {
        throw new Error(
          'No checkout URL provided. Set PUBLIC_LS_CHECKOUT_URL or pass a URL.',
        );
      }
      lemonOpenCheckout(url);
    },
    [],
  );

  return { openCheckout };
}
