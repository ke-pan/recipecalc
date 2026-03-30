/**
 * Lemon.js integration — checkout overlay + auto-activation.
 *
 * Uses the Lemon.js script (loaded via BaseLayout.astro) to open an in-page
 * checkout overlay. On successful purchase, extracts the license key from the
 * `Checkout.Success` event and passes it to the provided callback.
 *
 * The key stays in memory — never touches the URL, browser history, or
 * Referer headers.
 *
 * @see https://docs.lemonsqueezy.com/help/lemonjs/handling-events
 */

// ---------------------------------------------------------------------------
// Types for the global LemonSqueezy object injected by lemon.js
// ---------------------------------------------------------------------------

interface LemonSqueezyEventData {
  order: {
    first_order_item: {
      license_key: string;
    };
  };
}

interface LemonSqueezyEvent {
  event: string;
  data: LemonSqueezyEventData;
}

type LemonSqueezyEventHandler = (payload: LemonSqueezyEvent) => void;

interface LemonSqueezyGlobal {
  Setup: (config: { eventHandler: LemonSqueezyEventHandler }) => void;
  Url: {
    Open: (url: string) => void;
  };
}

declare global {
  interface Window {
    LemonSqueezy: LemonSqueezyGlobal;
    createLemonSqueezy?: () => void;
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let isSetup = false;
let onActivateCallback: ((licenseKey: string) => void) | null = null;

// ---------------------------------------------------------------------------
// Event handler
// ---------------------------------------------------------------------------

function handleEvent({ event, data }: LemonSqueezyEvent): void {
  if (event === 'Checkout.Success') {
    const licenseKey = data?.order?.first_order_item?.license_key;
    if (licenseKey && onActivateCallback) {
      onActivateCallback(licenseKey);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize LemonSqueezy with an event handler.
 *
 * @param onActivate — called with the license key when checkout succeeds.
 *   Typically wired to `LicenseContext.activate()`.
 */
export function setupLemonSqueezy(
  onActivate: (licenseKey: string) => void,
): void {
  onActivateCallback = onActivate;

  if (isSetup) return;

  // lemon.js may expose a createLemonSqueezy helper; call it if available
  if (typeof window !== 'undefined' && window.createLemonSqueezy) {
    window.createLemonSqueezy();
  }

  if (typeof window !== 'undefined' && window.LemonSqueezy) {
    window.LemonSqueezy.Setup({ eventHandler: handleEvent });
    isSetup = true;
  }
}

/**
 * Open the LemonSqueezy checkout overlay for the given URL.
 *
 * The overlay stays in-page — no navigation, no URL change.
 */
export function openCheckout(checkoutUrl: string): void {
  if (typeof window === 'undefined' || !window.LemonSqueezy) {
    throw new Error(
      'LemonSqueezy is not loaded. Ensure lemon.js script is included in the page.',
    );
  }

  window.LemonSqueezy.Url.Open(checkoutUrl);
}

/**
 * Reset internal state. Exported for testing only.
 * @internal
 */
export function _reset(): void {
  isSetup = false;
  onActivateCallback = null;
}
