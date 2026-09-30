import { ApiResponse } from '../types/flight';
import { AuthResponse, User } from '../types/auth';
import { API_BASE_URL } from './apiBase';
import { fetchWithTimeout } from './http';

const BASE_URL = API_BASE_URL;

async function parseOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data: ApiResponse<T> | null = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    // The HTTP status lets callers tell "session invalid" (401) from
    // "server unreachable/unavailable".
    throw Object.assign(new Error(data?.error?.message || fallbackMessage), { status: response.status });
  }
  return data.data as T;
}

export class AuthApiClient {
  public static async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const response = await fetchWithTimeout(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    return parseOrThrow<AuthResponse>(response, 'Unable to create account. Please try again.');
  }

  public static async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetchWithTimeout(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return parseOrThrow<AuthResponse>(response, 'Unable to log in. Please try again.');
  }

  /**
   * The signed-in user, from the session cookie. `legacyToken` (a token an
   * older app version saved) is sent once so the server can move it into
   * the cookie.
   */
  public static async me(legacyToken?: string | null): Promise<User> {
    const response = await fetchWithTimeout(`${BASE_URL}/auth/me`, {
      headers: legacyToken ? { Authorization: `Bearer ${legacyToken}` } : undefined,
    });
    const data = await parseOrThrow<{ user: User }>(response, 'Not authenticated.');
    return data.user;
  }

  public static async logout(): Promise<void> {
    await fetchWithTimeout(`${BASE_URL}/auth/logout`, { method: 'POST' });
  }
}
