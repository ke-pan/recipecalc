/**
 * Server-side environment variable helper.
 *
 * Reads from Cloudflare Worker runtime env (production / wrangler dev)
 * with fallback to Astro import.meta.env (astro dev).
 */

export function getEnv(locals: App.Locals, key: string): string {
  const runtime = (locals as Record<string, any>).runtime;
  if (runtime?.env?.[key]) return String(runtime.env[key]);
  return String((import.meta.env as Record<string, any>)[key] ?? '');
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
