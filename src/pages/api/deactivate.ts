/**
 * POST /api/deactivate — clear session cookie.
 */

import type { APIRoute } from 'astro';
import { COOKIE_NAME } from '../../lib/server/session';
import { jsonResponse } from '../../lib/server/env';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete(COOKIE_NAME, { path: '/' });
  return jsonResponse({ ok: true });
};
