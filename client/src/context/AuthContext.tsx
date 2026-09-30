import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '../types/auth';
import { AuthApiClient } from '../services/authApi';

// Older app versions kept the session token here. It is read once, moved
// into the server's HttpOnly cookie, and deleted - never written again.
const LEGACY_TOKEN_STORAGE_KEY = 'aerotrack_auth_token';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function takeLegacyToken(): string | null {
  try {
    return localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function dropLegacyToken(): void {
  try {
    localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  } catch {
    // storage unavailable - nothing stored there anyway
  }
}

/**
 * Sessions are held in an HttpOnly cookie set by the server: page scripts
 * never see the token. The client only knows who is signed in (from
 * /auth/me), which is re-checked on every page load.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    const legacyToken = takeLegacyToken();
    AuthApiClient.me(legacyToken)
      .then((fetchedUser) => {
        if (legacyToken) dropLegacyToken(); // now in the cookie
        if (!cancelled) setUser(fetchedUser);
      })
      .catch((err: { status?: number }) => {
        // Only a server-confirmed invalid session drops the legacy token; an
        // unreachable/restarting backend keeps it for the next attempt.
        if (err?.status === 401 && legacyToken) dropLegacyToken();
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: loggedInUser } = await AuthApiClient.login(email, password);
    setUser(loggedInUser);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const { user: newUser } = await AuthApiClient.register(name, email, password);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    AuthApiClient.logout().catch(() => {
      // best-effort - clear local state regardless
    });
    dropLegacyToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    signup,
    logout,
  }), [user, isLoading, login, signup, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
