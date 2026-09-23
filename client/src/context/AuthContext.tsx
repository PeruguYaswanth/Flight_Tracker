import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '../types/auth';
import { AuthApiClient } from '../services/authApi';

const TOKEN_STORAGE_KEY = 'aerotrack_auth_token';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // localStorage may be unavailable (private browsing, etc.) - auth still
    // works for the current page load, it just won't persist across reloads.
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const storedToken = readStoredToken();
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    AuthApiClient.me(storedToken)
      .then((fetchedUser) => {
        setUser(fetchedUser);
        setToken(storedToken);
      })
      .catch(() => {
        storeToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token: newToken, user: loggedInUser } = await AuthApiClient.login(email, password);
    storeToken(newToken);
    setToken(newToken);
    setUser(loggedInUser);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const { token: newToken, user: newUser } = await AuthApiClient.register(name, email, password);
    storeToken(newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    if (token) {
      AuthApiClient.logout(token).catch(() => {
        // best-effort - clear local state regardless
      });
    }
    storeToken(null);
    setToken(null);
    setUser(null);
  }, [token]);

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
