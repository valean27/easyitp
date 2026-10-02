import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { login as loginApi } from '../api/authApi';
import type { UserRole } from '../types';

interface AuthUser {
  email: string;
  token: string;
  role: UserRole;
  stationName?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (changes: Partial<Omit<AuthUser, 'token'>>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('auth_user');
    if (!stored) return null;
    const parsed: AuthUser = JSON.parse(stored);
    if (isTokenExpired(parsed.token)) {
      localStorage.removeItem('auth_user');
      return null;
    }
    return parsed;
  });

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginApi(email, password);
    const authUser: AuthUser = {
      email: data.email,
      token: data.token,
      role: data.role as UserRole,
      stationName: data.stationName,
    };
    setUser(authUser);
    localStorage.setItem('auth_user', JSON.stringify(authUser));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('auth_user');
  }, []);

  const updateUser = useCallback((changes: Partial<Omit<AuthUser, 'token'>>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...changes };
      localStorage.setItem('auth_user', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
