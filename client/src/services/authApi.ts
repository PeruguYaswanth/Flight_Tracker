import { ApiResponse } from '../types/flight';
import { AuthResponse, User } from '../types/auth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function parseOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data: ApiResponse<T> = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || fallbackMessage);
  }
  return data.data as T;
}

export class AuthApiClient {
  public static async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    return parseOrThrow<AuthResponse>(response, 'Unable to create account. Please try again.');
  }

  public static async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return parseOrThrow<AuthResponse>(response, 'Unable to log in. Please try again.');
  }

  public static async me(token: string): Promise<User> {
    const response = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseOrThrow<{ user: User }>(response, 'Not authenticated.');
    return data.user;
  }

  public static async logout(token: string): Promise<void> {
    await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}
