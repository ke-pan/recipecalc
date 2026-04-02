/**
 * POST /api/activate — server-side license activation.
 *
 * Receives a license key, validates with LemonSqueezy server-side,
 * and sets an HttpOnly signed session cookie on success.
 */

import type { APIRoute } from 'astro';
import { createSessionToken, COOKIE_NAME, MAX_AGE } from '../../lib/server/session';
import { getEnv, jsonResponse } from '../../lib/server/env';

export const prerender = false;

const LS_API = 'https://api.lemonsqueezy.com/v1/licenses/activate';
const INSTANCE_NAME = 'recipecalc-web';
const MAX_KEY_LENGTH = 256;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  // Parse request body
  let key: string;
  try {
    const body = await request.json();
    key = typeof body.key === 'string' ? body.key.trim() : '';
  } catch {
    return jsonResponse({ ok: false, reason: 'invalid' }, 400);
  }
  if (!key || key.length > MAX_KEY_LENGTH) {
    return jsonResponse({ ok: false, reason: 'invalid' }, 400);
  }

  // Fail fast if env vars are missing
  const storeId = getEnv(locals, 'PUBLIC_LS_STORE_ID');
  const productId = getEnv(locals, 'PUBLIC_LS_PRODUCT_ID');
  const secret = getEnv(locals, 'SESSION_SECRET');
  if (!storeId || !productId) {
    console.error('[activate] PUBLIC_LS_STORE_ID or PUBLIC_LS_PRODUCT_ID not configured');
    return jsonResponse({ ok: false, reason: 'network' }, 500);
  }
  if (!secret) {
    console.error('[activate] SESSION_SECRET not configured');
    return jsonResponse({ ok: false, reason: 'network' }, 500);
  }

  // Call LemonSqueezy server-side
  const lsBody = new URLSearchParams({ license_key: key, instance_name: INSTANCE_NAME });
  let lsData: Record<string, any>;
  try {
    const lsRes = await fetch(LS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: lsBody.toString(),
    });
    lsData = await lsRes.json();
    if (!lsData.valid || !lsRes.ok) {
      const reason =
        lsData.error?.toLowerCase().includes('limit') ||
        (lsData.license_key?.activation_usage >= lsData.license_key?.activation_limit &&
          lsData.license_key?.activation_limit > 0)
          ? 'limit_reached'
          : 'invalid';
      return jsonResponse({ ok: false, reason }, 401);
    }
  } catch {
    return jsonResponse({ ok: false, reason: 'network' }, 502);
  }

  // Verify product ownership
  if (
    String(lsData.meta?.store_id) !== storeId ||
    String(lsData.meta?.product_id) !== productId
  ) {
    return jsonResponse({ ok: false, reason: 'wrong_product' }, 401);
  }

  // Create signed session token (store only key prefix, not full key)
  const instanceId = lsData.instance?.id ?? '';
  const activatedAt = lsData.instance?.created_at ?? new Date().toISOString();
  const token = await createSessionToken(key.slice(0, 8), instanceId, secret);

  cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });

  return jsonResponse({ ok: true, instanceId, activatedAt });
};
