import crypto from 'crypto';
import { config } from '../config/environment';
import { sessionsCollection, UserDocument, usersCollection } from '../config/database';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

// Users and sessions are stored in MongoDB (see config/database.ts), so
// accounts and logins survive server restarts. Passwords are stored only as
// scrypt hashes with a per-user salt; session tokens only as SHA-256 hashes.

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** One normalization for storage and lookup: " User@Example.com " -> "user@example.com". */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function httpError(statusCode: number, code: string, message: string): Error {
  return Object.assign(new Error(message), { statusCode, code });
}

/**
 * Runs a database operation; a database that can't be reached is reported
 * as "account service unavailable" (503), never as bad credentials.
 */
async function withDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err: any) {
    if (err?.statusCode) throw err;
    if (err?.code === 11000) throw err; // duplicate key - handled by the caller
    console.error('[AuthService] Account storage unavailable:', err?.code || err?.name || 'error', err?.message ? `- ${err.message}` : '');
    throw httpError(503, 'ACCOUNT_SERVICE_UNAVAILABLE', 'The account service is temporarily unavailable. Please try again.');
  }
}

export class AuthService {
  public async register(name: string, email: string, password: string): Promise<{ token: string; user: PublicUser }> {
    const normalizedEmail = normalizeEmail(email);
    const salt = crypto.randomBytes(16).toString('hex');
    const now = new Date();
    const user: UserDocument = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(password, salt),
      salt,
      createdAt: now,
      updatedAt: now,
    };

    await withDatabase(async () => {
      try {
        await (await usersCollection()).insertOne(user);
      } catch (err: any) {
        // The unique email index is the single source of truth, so two
        // concurrent sign-ups with one email can't both succeed.
        if (err?.code === 11000) throw httpError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');
        throw err;
      }
    });

    return { token: await this.createSession(user.id), user: this.toPublicUser(user) };
  }

  public async login(email: string, password: string): Promise<{ token: string; user: PublicUser }> {
    const user = await withDatabase(async () => (await usersCollection()).findOne({ email: normalizeEmail(email) }));

    // Same message for unknown email and wrong password.
    if (!user || !this.verifyPassword(password, user)) {
      throw httpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    return { token: await this.createSession(user.id), user: this.toPublicUser(user) };
  }

  /** Ends this session only - the account itself is never touched. */
  public async logout(token: string): Promise<void> {
    await withDatabase(async () => {
      await (await sessionsCollection()).deleteOne({ tokenHash: hashToken(token) });
    });
  }

  public async getUserByToken(token: string): Promise<PublicUser | null> {
    return withDatabase(async () => {
      const session = await (await sessionsCollection()).findOne({ tokenHash: hashToken(token) });
      // The TTL index removes expired sessions, but only periodically.
      if (!session || session.expiresAt.getTime() <= Date.now()) return null;
      const user = await (await usersCollection()).findOne({ id: session.userId });
      return user ? this.toPublicUser(user) : null;
    });
  }

  private async createSession(userId: string): Promise<string> {
    const token = createToken();
    const now = new Date();
    await withDatabase(async () => {
      await (await sessionsCollection()).insertOne({
        tokenHash: hashToken(token),
        userId,
        createdAt: now,
        expiresAt: new Date(now.getTime() + config.sessionTtlDays * 24 * 60 * 60 * 1000),
      });
    });
    return token;
  }

  private verifyPassword(password: string, user: UserDocument): boolean {
    const candidateHash = Buffer.from(hashPassword(password, user.salt));
    const storedHash = Buffer.from(user.passwordHash);
    if (candidateHash.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(candidateHash, storedHash);
  }

  private toPublicUser(user: UserDocument): PublicUser {
    return { id: user.id, name: user.name, email: user.email };
  }
}

export const authService = new AuthService();
