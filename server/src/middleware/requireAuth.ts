import { Request, Response, NextFunction } from 'express';
import { authService, PublicUser } from '../services/authService';

export function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

/**
 * Rejects the request with 401 unless it carries a valid session token.
 * The authenticated user is exposed as `res.locals.user`.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  const user = token ? authService.getUserByToken(token) : null;

  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'Please sign in to use flight notifications.' },
    });
    return;
  }

  res.locals.user = user;
  next();
}

export function getAuthUser(res: Response): PublicUser {
  return res.locals.user as PublicUser;
}
