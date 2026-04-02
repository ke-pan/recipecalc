/**
 * Server-side session tokens using HMAC-SHA256 (Web Crypto API).
 *
 * Token format: base64url(payload).base64url(signature)
 * Stored in an HttpOnly cookie — cannot be read or tampered with from JS.
 */

export const COOKIE_NAME = 'rc_session';
export const MAX_AGE = 365 * 24 * 60 * 60; // 1 year (one-time purchase)

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

export interface SessionPayload {
  /** License key */
  key: string;
  /** LemonSqueezy instance ID */
  iid: string;
  /** Issued-at (unix seconds) */
  iat: number;
  /** Expiry (unix seconds) */
  exp: number;
}

// ---------------------------------------------------------------------------
// Base64url helpers
// ---------------------------------------------------------------------------

function toBase64Url(data: Uint8Array): string {
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ---------------------------------------------------------------------------
// HMAC key
// ---------------------------------------------------------------------------

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createSessionToken(
  licenseKey: string,
  instanceId: string,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    key: licenseKey,
    iid: instanceId,
    iat: now,
    exp: now + MAX_AGE,
  };

  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const hmacKey = await getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(payloadB64));

  return `${payloadB64}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  const dot = token.indexOf('.');
  if (dot < 0) return null;

  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  try {
    const hmacKey = await getHmacKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      hmacKey,
      fromBase64Url(sigB64),
      new TextEncoder().encode(payloadB64),
    );
    if (!valid) return null;

    const payload: SessionPayload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payloadB64)),
    );

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
