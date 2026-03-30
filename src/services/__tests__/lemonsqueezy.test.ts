import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { activateLicense, validateLicense, _env } from '../lemonsqueezy.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeActivateResponse(overrides: Record<string, unknown> = {}) {
  return {
    valid: true,
    license_key: {
      id: 1,
      status: 'active',
      key: 'test-key-123',
      activation_limit: 5,
      activation_usage: 1,
    },
    instance: {
      id: 'instance-abc',
      created_at: '2026-03-30T12:00:00.000Z',
    },
    meta: {
      store_id: 12345,
      product_id: 67890,
      variant_id: 99,
    },
    ...overrides,
  };
}

function makeValidateResponse(overrides: Record<string, unknown> = {}) {
  return {
    valid: true,
    license_key: {
      id: 1,
      status: 'active',
      key: 'test-key-123',
      activation_limit: 5,
      activation_usage: 1,
    },
    meta: {
      store_id: 12345,
      product_id: 67890,
      variant_id: 99,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fetch mock
// ---------------------------------------------------------------------------

const fetchMock = vi.fn();

let envSpy: { storeId: string; productId: string };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // Spy on _env getters to return test values
  envSpy = { storeId: '12345', productId: '67890' };
  vi.spyOn(_env, 'storeId', 'get').mockImplementation(() => envSpy.storeId);
  vi.spyOn(_env, 'productId', 'get').mockImplementation(() => envSpy.productId);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// activateLicense
// ---------------------------------------------------------------------------

describe('activateLicense', () => {
  it('sends form-encoded POST to /v1/licenses/activate', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeActivateResponse()),
    });

    await activateLicense('my-key');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.lemonsqueezy.com/v1/licenses/activate');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    // Verify form-encoded body
    const params = new URLSearchParams(opts.body);
    expect(params.get('license_key')).toBe('my-key');
    expect(params.get('instance_name')).toBe('recipecalc-web');
  });

  it('returns ok:true with instanceId and activatedAt on success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeActivateResponse()),
    });

    const result = await activateLicense('my-key');

    expect(result).toEqual({
      ok: true,
      instanceId: 'instance-abc',
      activatedAt: '2026-03-30T12:00:00.000Z',
    });
  });

  it('returns reason "invalid" when API says key is not valid', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          valid: false,
          error: 'license_key is invalid',
        }),
    });

    const result = await activateLicense('bad-key');

    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('returns reason "wrong_product" when store_id does not match', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(
          makeActivateResponse({
            meta: { store_id: 99999, product_id: 67890, variant_id: 1 },
          }),
        ),
    });

    const result = await activateLicense('wrong-store-key');

    expect(result).toEqual({ ok: false, reason: 'wrong_product' });
  });

  it('returns reason "wrong_product" when product_id does not match', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(
          makeActivateResponse({
            meta: { store_id: 12345, product_id: 11111, variant_id: 1 },
          }),
        ),
    });

    const result = await activateLicense('wrong-product-key');

    expect(result).toEqual({ ok: false, reason: 'wrong_product' });
  });

  it('returns reason "limit_reached" when activation limit is hit', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          valid: false,
          error: 'This license key has reached its activation limit',
          license_key: {
            id: 1,
            status: 'active',
            key: 'maxed-key',
            activation_limit: 5,
            activation_usage: 5,
          },
        }),
    });

    const result = await activateLicense('maxed-key');

    expect(result).toEqual({ ok: false, reason: 'limit_reached' });
  });

  it('returns reason "network" when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await activateLicense('any-key');

    expect(result).toEqual({ ok: false, reason: 'network' });
  });

  it('returns reason "network" when response.json() throws', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    });

    const result = await activateLicense('any-key');

    expect(result).toEqual({ ok: false, reason: 'network' });
  });
});

// ---------------------------------------------------------------------------
// validateLicense
// ---------------------------------------------------------------------------

describe('validateLicense', () => {
  it('sends form-encoded POST to /v1/licenses/validate', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeValidateResponse()),
    });

    await validateLicense('my-key', 'my-instance');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.lemonsqueezy.com/v1/licenses/validate');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    const params = new URLSearchParams(opts.body);
    expect(params.get('license_key')).toBe('my-key');
    expect(params.get('instance_id')).toBe('my-instance');
  });

  it('returns ok:true on successful validation with matching product', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeValidateResponse()),
    });

    const result = await validateLicense('my-key', 'my-instance');

    expect(result).toEqual({ ok: true });
  });

  it('returns reason "invalid" when validation fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ valid: false, error: 'not found' }),
    });

    const result = await validateLicense('bad-key', 'bad-instance');

    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('returns reason "wrong_product" when product does not match', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(
          makeValidateResponse({
            meta: { store_id: 99999, product_id: 99999, variant_id: 1 },
          }),
        ),
    });

    const result = await validateLicense('key', 'instance');

    expect(result).toEqual({ ok: false, reason: 'wrong_product' });
  });

  it('returns reason "network" when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await validateLicense('key', 'instance');

    expect(result).toEqual({ ok: false, reason: 'network' });
  });
});
