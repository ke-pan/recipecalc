/**
 * Server-side environment variable helper.
 *
 * Uses Cloudflare Workers env binding (Astro 6+ with @astrojs/cloudflare).
 * In dev mode, reads from .env / .dev.vars via the adapter's emulation.
 */

import { env } from 'cloudflare:workers';

export function getEnv(key: string): string {
  return String((env as Record<string, string>)[key] ?? '');
}

export function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
