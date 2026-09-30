import { Request, Response } from 'express';
import { config } from '../config/environment';

/**
 * Session transport. The session token lives only in an HttpOnly cookie, so
 * page scripts (and therefore XSS) can't read it. The server-side session is
 * unchanged: MongoDB stores only the token's SHA-256 hash.
 */
export const SESSION_COOKIE = 'aerotrack_session';

function cookieAttributes(maxAgeSeconds: number): string {
  const parts = [`Path=/api`, `Max-Age=${maxAgeSeconds}`, 'HttpOnly', `SameSite=${config.cookieSameSite}`];
  // SameSite=None is only accepted by browsers on Secure cookies.
  if (config.cookieSecure || config.cookieSameSite === 'None') parts.push('Secure');
  return parts.join('; ');
}

export function setSessionCookie(res: Response, token: string): void {
  res.append('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieAttributes(config.sessionTtlDays * 86_400)}`);
}

export function clearSessionCookie(res: Response): void {
  res.append('Set-Cookie', `${SESSION_COOKIE}=; ${cookieAttributes(0)}`);
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim()) || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}
