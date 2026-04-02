import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';
import { _resetSessionCache } from '../contexts/LicenseContext';

const HINT_KEY = 'recipecalc_license_hint';
const OLD_KEY = 'recipecalc_license';

beforeEach(() => {
  // Clean slate for every test (try-catch: some tests override localStorage with mocks)
  try { localStorage.clear(); } catch {}
  _resetSessionCache();

  // Mock fetch for server API routes
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url === '/api/session') {
      const hasHint = !!localStorage.getItem(HINT_KEY);
      const hasOld = !!localStorage.getItem(OLD_KEY);
      const unlocked = hasHint || hasOld;
      return new Response(
        JSON.stringify({ unlocked, keyPrefix: unlocked ? 'test-key' : undefined }),
      );
    }

    if (url === '/api/activate') {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(
        JSON.stringify({
          ok: true,
          instanceId: 'test-instance-id',
          activatedAt: new Date().toISOString(),
          keyPrefix: (body.key ?? '').slice(0, 8),
        }),
      );
    }

    if (url === '/api/deactivate') {
      return new Response(JSON.stringify({ ok: true }));
    }

    // Default: return empty JSON (other URLs)
    return new Response(JSON.stringify({}));
  }) as typeof fetch;
});
