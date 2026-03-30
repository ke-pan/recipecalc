/**
 * LemonSqueezy License API client.
 *
 * Calls the public License API endpoints (no API key required — safe for
 * client-side use). Uses form-encoded bodies per LemonSqueezy docs.
 *
 * @see https://docs.lemonsqueezy.com/api/license-api
 */

const API_BASE = 'https://api.lemonsqueezy.com/v1/licenses';
const INSTANCE_NAME = 'recipecalc-web';

// ---------------------------------------------------------------------------
// Environment variable helpers
// ---------------------------------------------------------------------------

// Vite/Astro expose env vars on import.meta.env. The PUBLIC_ prefix makes
// them available client-side. Exported for testability.

/** @internal — exported for testing only */
export const _env = {
  get storeId(): string {
    return String(import.meta.env.PUBLIC_LS_STORE_ID ?? '');
  },
  get productId(): string {
    return String(import.meta.env.PUBLIC_LS_PRODUCT_ID ?? '');
  },
};

// ---------------------------------------------------------------------------
// Result types
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

export type ValidateResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'wrong_product' | 'network' };

// ---------------------------------------------------------------------------
// API response shapes (partial — only what we need)
// ---------------------------------------------------------------------------

interface LicenseApiResponse {
  valid: boolean;
  error?: string;
  license_key?: {
    id: number;
    status: string;
    key: string;
    activation_limit: number;
    activation_usage: number;
  };
  instance?: {
    id: string;
    created_at: string;
  };
  meta?: {
    store_id: number;
    product_id: number;
    variant_id: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function verifyProduct(meta: LicenseApiResponse['meta']): boolean {
  if (!meta) return false;
  return (
    String(meta.store_id) === _env.storeId &&
    String(meta.product_id) === _env.productId
  );
}

function mapErrorReason(
  response: LicenseApiResponse,
): 'invalid' | 'limit_reached' {
  // LemonSqueezy returns specific error strings when limits are reached
  if (
    response.error?.toLowerCase().includes('limit') ||
    (response.license_key &&
      response.license_key.activation_usage >= response.license_key.activation_limit &&
      response.license_key.activation_limit > 0)
  ) {
    return 'limit_reached';
  }
  return 'invalid';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Activate a license key. Creates a new instance on success.
 *
 * Uses form-encoded body (not JSON) per LemonSqueezy docs.
 */
export async function activateLicense(key: string): Promise<ActivateResult> {
  try {
    const body = new URLSearchParams({
      license_key: key,
      instance_name: INSTANCE_NAME,
    });

    const response = await fetch(`${API_BASE}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data: LicenseApiResponse = await response.json();

    if (!data.valid || !response.ok) {
      return { ok: false, reason: mapErrorReason(data) };
    }

    if (!verifyProduct(data.meta)) {
      return { ok: false, reason: 'wrong_product' };
    }

    return {
      ok: true,
      instanceId: data.instance?.id ?? '',
      activatedAt: data.instance?.created_at ?? new Date().toISOString(),
    };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/**
 * Validate an already-activated license key + instance.
 *
 * Uses form-encoded body (not JSON) per LemonSqueezy docs.
 */
export async function validateLicense(
  key: string,
  instanceId: string,
): Promise<ValidateResult> {
  try {
    const body = new URLSearchParams({
      license_key: key,
      instance_id: instanceId,
    });

    const response = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data: LicenseApiResponse = await response.json();

    if (!data.valid || !response.ok) {
      return { ok: false, reason: 'invalid' };
    }

    if (!verifyProduct(data.meta)) {
      return { ok: false, reason: 'wrong_product' };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
