/**
 * GET /api/session — check current session status.
 *
 * Returns { unlocked: boolean, keyPrefix?: string }.
 * Used by LicenseContext on mount to determine paid status.
 */

import type { APIRoute } from 'astro';
import { verifySessionToken, COOKIE_NAME } from '../../lib/server/session';
import { getEnv, jsonResponse } from '../../lib/server/env';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, locals }) => {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return jsonResponse({ unlocked: false });
  }

  const secret = getEnv(locals, 'SESSION_SECRET');
  if (!secret) {
    console.error('[session] SESSION_SECRET not configured');
    return jsonResponse({ unlocked: false });
  }

  const session = await verifySessionToken(token, secret);
  if (!session) {
    // Clear invalid/expired cookie to avoid repeated verification attempts
    cookies.delete(COOKIE_NAME, { path: '/' });
    return jsonResponse({ unlocked: false });
  }

  return jsonResponse({
    unlocked: true,
    keyPrefix: session.key.slice(0, 8),
  });
};
