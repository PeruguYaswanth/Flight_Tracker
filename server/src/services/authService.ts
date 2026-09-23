import crypto from 'crypto';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

// In-memory only by design (no database per project constraints): the user
// list and sessions reset on server restart. Suitable for a demo product,
// not for production persistence.
const usersByEmail = new Map<string, StoredUser>();
const sessions = new Map<string, string>(); // token -> email

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export class AuthService {
  public register(name: string, email: string, password: string): { token: string; user: PublicUser } {
    const normalizedEmail = email.trim().toLowerCase();

    if (usersByEmail.has(normalizedEmail)) {
      const error: any = new Error('An account with this email already exists.');
      error.statusCode = 409;
      error.code = 'EMAIL_ALREADY_EXISTS';
      throw error;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const user: StoredUser = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(password, salt),
      salt,
    };
    usersByEmail.set(normalizedEmail, user);

    const token = createToken();
    sessions.set(token, normalizedEmail);

    return { token, user: this.toPublicUser(user) };
  }

  public login(email: string, password: string): { token: string; user: PublicUser } {
    const normalizedEmail = email.trim().toLowerCase();
    const user = usersByEmail.get(normalizedEmail);

    if (!user || !this.verifyPassword(password, user)) {
      const error: any = new Error('Invalid email or password.');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const token = createToken();
    sessions.set(token, normalizedEmail);

    return { token, user: this.toPublicUser(user) };
  }

  public logout(token: string): void {
    sessions.delete(token);
  }

  public getUserByToken(token: string): PublicUser | null {
    const email = sessions.get(token);
    if (!email) return null;
    const user = usersByEmail.get(email);
    return user ? this.toPublicUser(user) : null;
  }

  private verifyPassword(password: string, user: StoredUser): boolean {
    const candidateHash = Buffer.from(hashPassword(password, user.salt));
    const storedHash = Buffer.from(user.passwordHash);
    if (candidateHash.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(candidateHash, storedHash);
  }

  private toPublicUser(user: StoredUser): PublicUser {
    return { id: user.id, name: user.name, email: user.email };
  }
}

export const authService = new AuthService();
