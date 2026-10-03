import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UserManagementPage from './components/UserManagementPage';
import LoginPage from './components/LoginPage';
import CalendarPage from './components/CalendarPage';
import AccountPage from './components/AccountPage';
import RemindersPage from './components/RemindersPage';
import ReportsPage from './components/ReportsPage';

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
