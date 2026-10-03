import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/auth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './components/LoginPage';

// Paginile se incarca la cerere, ca login-ul sa nu descarce calendarul, rapoartele etc.
const Dashboard = lazy(() => import('./components/Dashboard'));
const UserManagementPage = lazy(() => import('./components/UserManagementPage'));
const CalendarPage = lazy(() => import('./components/CalendarPage'));
const AccountPage = lazy(() => import('./components/AccountPage'));
const RemindersPage = lazy(() => import('./components/RemindersPage'));
const ReportsPage = lazy(() => import('./components/ReportsPage'));
const PublicBookingPage = lazy(() => import('./components/PublicBookingPage'));

// Adminul nu are statie proprie, asa ca pagina lui de start e lista de manageri
function Home() {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? <Navigate to="/users" replace /> : <Dashboard />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Pagina publica de programare: fara login si fara meniul aplicatiei */}
          <Route
            path="/programare/:slug"
            element={
              <Suspense fallback={null}>
                <PublicBookingPage />
              </Suspense>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Home />} />
            <Route
              path="calendar"
              element={
                <ProtectedRoute requiredRole="MANAGER">
                  <CalendarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="reminders"
              element={
                <ProtectedRoute requiredRole="MANAGER">
                  <RemindersPage />
                </ProtectedRoute>
              }
            />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route
              path="users"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <UserManagementPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App
