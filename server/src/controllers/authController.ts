import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

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

      const { token, user } = authService.register(String(name), String(email), String(password));
      res.status(201).json({ success: true, data: { token, user } });
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

      const { token, user } = authService.login(String(email), String(password));
      res.json({ success: true, data: { token, user } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   */
  public static async me(req: Request, res: Response): Promise<void> {
    const token = getToken(req);
    const user = token ? authService.getUserByToken(token) : null;

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated.' },
      });
      return;
    }

    res.json({ success: true, data: { user } });
  }

  /**
   * POST /api/auth/logout
   */
  public static async logout(req: Request, res: Response): Promise<void> {
    const token = getToken(req);
    if (token) {
      authService.logout(token);
    }
    res.json({ success: true });
  }
}
