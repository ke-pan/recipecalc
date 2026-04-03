import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createSessionToken,
  verifySessionToken,
  COOKIE_NAME,
  MAX_AGE,
} from '../session';

const SECRET = 'test-secret-key-for-hmac-signing';
const OTHER_SECRET = 'different-secret-key';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('session token', () => {
  // ---- Constants ----

  it('exports COOKIE_NAME as rc_session', () => {
    expect(COOKIE_NAME).toBe('rc_session');
  });

  it('exports MAX_AGE as 1 year in seconds', () => {
    expect(MAX_AGE).toBe(365 * 24 * 60 * 60);
  });

  // ---- Token format ----

  it('creates a token with two base64url parts separated by a dot', async () => {
    const token = await createSessionToken('mykey123', 'inst-456', SECRET);
    const parts = token.split('.');
    expect(parts).toHaveLength(2);
    // base64url: only [A-Za-z0-9_-]
    expect(parts[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parts[1]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  // ---- Round-trip ----

  it('verifySessionToken returns correct payload for a valid token', async () => {
    const token = await createSessionToken('ABCDEFGH', 'inst-123', SECRET);
    const payload = await verifySessionToken(token, SECRET);

    expect(payload).not.toBeNull();
    expect(payload!.key).toBe('ABCDEFGH');
    expect(payload!.iid).toBe('inst-123');
    expect(payload!.iat).toBeGreaterThan(0);
    expect(payload!.exp).toBe(payload!.iat + MAX_AGE);
  });

  // ---- Invalid tokens ----

  it('returns null for a token signed with a different secret', async () => {
    const token = await createSessionToken('key', 'inst', SECRET);
    const result = await verifySessionToken(token, OTHER_SECRET);
    expect(result).toBeNull();
  });

  it('returns null for a tampered payload', async () => {
    const token = await createSessionToken('key', 'inst', SECRET);
    const [, sig] = token.split('.');
    // Replace payload with a different one
    const fakePayload = btoa(JSON.stringify({ key: 'hacked', iid: 'x', iat: 0, exp: 99999999999 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const result = await verifySessionToken(`${fakePayload}.${sig}`, SECRET);
    expect(result).toBeNull();
  });

  it('returns null for a token without a dot separator', async () => {
    const result = await verifySessionToken('nodothere', SECRET);
    expect(result).toBeNull();
  });

  it('returns null for an empty string', async () => {
    const result = await verifySessionToken('', SECRET);
    expect(result).toBeNull();
  });

  it('returns null for garbage base64', async () => {
    const result = await verifySessionToken('not!valid.also!bad', SECRET);
    expect(result).toBeNull();
  });

  // ---- Expiry ----

  it('returns null for an expired token', async () => {
    // Mock Date.now to create a token in the past
    const pastTime = Date.now() - (MAX_AGE + 60) * 1000; // expired 60s ago
    vi.spyOn(Date, 'now').mockReturnValue(pastTime);
    const token = await createSessionToken('key', 'inst', SECRET);
    vi.restoreAllMocks(); // restore Date.now to "present"

    const result = await verifySessionToken(token, SECRET);
    expect(result).toBeNull();
  });

  it('accepts a token that has not yet expired', async () => {
    const token = await createSessionToken('key', 'inst', SECRET);
    // Verify immediately (well within MAX_AGE)
    const result = await verifySessionToken(token, SECRET);
    expect(result).not.toBeNull();
    expect(result!.key).toBe('key');
  });

  // ---- Determinism ----

  it('produces different tokens for different keys', async () => {
    const t1 = await createSessionToken('key1', 'inst', SECRET);
    const t2 = await createSessionToken('key2', 'inst', SECRET);
    expect(t1).not.toBe(t2);
  });

  it('produces different tokens for different secrets', async () => {
    const t1 = await createSessionToken('key', 'inst', SECRET);
    const t2 = await createSessionToken('key', 'inst', OTHER_SECRET);
    // Payloads are the same, but signatures differ
    const [p1, s1] = t1.split('.');
    const [p2, s2] = t2.split('.');
    expect(p1).toBe(p2); // same payload
    expect(s1).not.toBe(s2); // different signature
  });
});
