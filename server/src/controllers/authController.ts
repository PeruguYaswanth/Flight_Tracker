import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { getSessionToken } from '../middleware/requireAuth';
import { clearSessionCookie, setSessionCookie } from '../utils/sessionCookie';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthController {
  /**
   * POST /api/auth/register
   */
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password } = req.body || {};

      if (!name || !String(name).trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Full name is required.' },
        });
        return;
      }
      if (!email || !EMAIL_REGEX.test(String(email).trim())) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'A valid email address is required.' },
        });
        return;
      }
      if (!password || String(password).length < 8) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters.' },
        });
        return;
      }

      const { token, user } = await authService.register(String(name), String(email), String(password));
      // The token goes only into the HttpOnly cookie, never the response body.
      setSessionCookie(res, token);
      res.status(201).json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   */
  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body || {};

      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' },
        });
        return;
      }

      const { token, user } = await authService.login(String(email), String(password));
      setSessionCookie(res, token);
      res.json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   */
  public static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = getSessionToken(req);
      const user = session ? await authService.getUserByToken(session.token) : null;

      if (!user) {
        // A stale cookie is removed so the browser stops sending it.
        if (session?.via === 'cookie') clearSessionCookie(res);
        res.status(401).json({
          success: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated.' },
        });
        return;
      }

      // A session presented as a Bearer token by an older app version (saved
      // in localStorage) moves into the HttpOnly cookie; the client then
      // deletes its stored copy.
      if (session?.via === 'bearer') setSessionCookie(res, session.token);
      res.json({ success: true, data: { user } });
    } catch (error) {
      // e.g. 503 when account storage is unreachable - not "logged out".
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   */
  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = getSessionToken(req);
      if (session) {
        await authService.logout(session.token);
      }
      clearSessionCookie(res);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}
