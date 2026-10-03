import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import type { ReactNode } from 'react';
import type { UserRole } from '../types';

interface Props {
  children: ReactNode;
  // un rol sau mai multe roluri acceptate
  requiredRole?: UserRole | UserRole[];
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const allowed = Array.isArray(requiredRole) ? requiredRole : requiredRole ? [requiredRole] : null;
  if (allowed && (!user || !allowed.includes(user.role))) return <Navigate to="/" replace />;
  return <>{children}</>;
}
