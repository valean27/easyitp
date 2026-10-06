import { useState, useCallback, type ReactNode } from 'react';
import { login as loginApi, signup as signupApi, type SignupData } from '../api/authApi';
import type { UserRole } from '../types';
import { AuthContext, type AuthUser } from './auth';

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

  const start = useCallback((data: { email: string; token: string; role: string; stationName: string | null }) => {
    const authUser: AuthUser = {
      email: data.email,
      token: data.token,
      role: data.role as UserRole,
      stationName: data.stationName,
    };
    setUser(authUser);
    localStorage.setItem('auth_user', JSON.stringify(authUser));
  }, []);

  const login = useCallback(async (email: string, password: string) => start(await loginApi(email, password)), [start]);

  const signup = useCallback(
    async (form: SignupData) => {
      const data = await signupApi(form);
      if (data) start(data);
    },
    [start],
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('auth_user');
  }, []);

  const updateUser = useCallback((changes: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...changes };
      localStorage.setItem('auth_user', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
