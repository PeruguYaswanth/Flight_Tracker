import { Request, Response, NextFunction } from 'express';
import { authService, PublicUser } from '../services/authService';
import { readCookie, SESSION_COOKIE } from '../utils/sessionCookie';

export function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

/**
 * The request's session token: the HttpOnly session cookie (browsers), or
 * an Authorization: Bearer header (non-browser API clients, and the one-time
 * migration of sessions saved by older app versions).
 */
export function getSessionToken(req: Request): { token: string; via: 'cookie' | 'bearer' } | null {
  const cookie = readCookie(req, SESSION_COOKIE);
  if (cookie) return { token: cookie, via: 'cookie' };
  const bearer = getBearerToken(req);
  return bearer ? { token: bearer, via: 'bearer' } : null;
}

/**
 * Rejects the request with 401 unless it carries a valid session token.
 * The authenticated user is exposed as `res.locals.user`.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = getSessionToken(req);
    const user = session ? await authService.getUserByToken(session.token) : null;

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Please sign in to use flight notifications.' },
      });
      return;
    }

    res.locals.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function getAuthUser(res: Response): PublicUser {
  return res.locals.user as PublicUser;
}
