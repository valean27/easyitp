import { createContext, useContext } from 'react';
import type { UserRole } from '../types';

// Contextul si hook-ul stau separat de AuthProvider (fast refresh cere fisiere doar cu componente)
export interface AuthUser {
  email: string;
  token: string;
  role: UserRole;
  stationName?: string | null;
}

export interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (changes: Partial<Omit<AuthUser, 'token'>>) => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
