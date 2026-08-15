import { Request, Response, NextFunction } from 'express';
import { adminAuth } from './firebaseAdmin';
import { config, isAdminEmail } from './config';

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
