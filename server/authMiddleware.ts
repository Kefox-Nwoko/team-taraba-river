import { Request, Response, NextFunction } from 'express';
import { adminAuth, db } from './firebaseAdmin';
import { config, isAdminEmail, isDeveloperAdminEmail } from './config';

// A valid Firebase login proves nothing about membership — anyone (or any
// script) can mint a Google account. Membership means a members/{uid} doc,
// which only the server creates (POST /api/members, or the email-match
// migration in /api/auth/verify). Positive lookups are cached briefly so this
// isn't a Firestore read on every request; a removed member loses access
// within the TTL.
const ROSTER_CACHE_MS = 60_000;
const rosterCache = new Map<string, number>();

export async function isRosterMember(uid: string): Promise<boolean> {
  const cachedUntil = rosterCache.get(uid);
  if (cachedUntil && cachedUntil > Date.now()) return true;
  const snap = await db.collection('members').doc(uid).get();
  if (!snap.exists) {
    rosterCache.delete(uid);
    return false;
  }
  rosterCache.set(uid, Date.now() + ROSTER_CACHE_MS);
  return true;
}

export function forgetRosterMember(uid: string): void {
  rosterCache.delete(uid);
}

/**
 * Decoded user attached to the Express request after token verification.
 */
export interface AuthenticatedUser {
  uid: string;
  email: string | undefined;
  role: 'admin' | 'member';
}

// Extend Express Request to include the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware: Verify Firebase ID Token.
 *
 * Reads the `Authorization: Bearer <idToken>` header, verifies it using
 * Firebase Admin SDK, and attaches the decoded user to `req.user`.
 * Returns 401 if the token is missing or invalid.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Provide a valid Bearer token.' });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const emailStr = decodedToken.email || '';
    const role = (decodedToken.role === 'admin' || isAdminEmail(emailStr)) ? 'admin' : 'member';

    if (role !== 'admin' && !(await isRosterMember(decodedToken.uid))) {
      res.status(403).json({ error: 'This account is not a registered member.', code: 'NOT_REGISTERED' });
      return;
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role,
    };

    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
    return;
  }
}

/**
 * Middleware: Require Admin Role.
 *
 * Must be used AFTER `authMiddleware`. Checks that `req.user.role === 'admin'`.
 * Returns 403 Forbidden if the user is not an admin.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden. Administrator access required.' });
    return;
  }

  next();
}

/**
 * Middleware: Require Developer-Admin (the single account authorized to
 * restore or permanently purge recycle-bin items).
 *
 * Must be used AFTER `authMiddleware`. Stricter than `requireAdmin` — every
 * admin passes `requireAdmin`, but only `config.developerAdminEmail` passes
 * this. Returns 403 Forbidden otherwise.
 */
export function requireDeveloperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  if (!isDeveloperAdminEmail(req.user.email)) {
    res.status(403).json({ error: 'Forbidden. Developer administrator access required.' });
    return;
  }

  next();
}
