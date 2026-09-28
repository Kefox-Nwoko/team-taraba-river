import { config } from './config';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** True when a Cloudflare Turnstile secret is set (TURNSTILE_SECRET_KEY). */
export function isHumanVerificationConfigured(): boolean {
  return !!config.turnstileSecretKey;
}

/**
 * Confirms a Cloudflare Turnstile token came from a real browser challenge
 * that a person passed. Tokens are single-use and expire after a few minutes,
 * so Cloudflare rejects replays. Fails closed: a missing/oversized token, a
 * rejected token, or Cloudflare being unreachable all return false.
 */
export async function verifyHuman(token: unknown, ip?: string): Promise<boolean> {
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;

  const body = new URLSearchParams({ secret: config.turnstileSecretKey, response: token });
  if (ip) body.set('remoteip', ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
