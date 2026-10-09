import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/auth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import OfflineBanner from './components/OfflineBanner';
import LoginPage from './components/LoginPage';
import ServerWakeBanner from './components/ServerWakeBanner';
import UndoToast from './components/UndoToast';

// Paginile se incarca la cerere, ca login-ul sa nu descarce calendarul, rapoartele etc.
const Dashboard = lazy(() => import('./components/Dashboard'));
const UserManagementPage = lazy(() => import('./components/UserManagementPage'));
const CalendarPage = lazy(() => import('./components/CalendarPage'));
const AccountPage = lazy(() => import('./components/AccountPage'));
const RemindersPage = lazy(() => import('./components/RemindersPage'));
const ReportsPage = lazy(() => import('./components/ReportsPage'));
const InspectorsPage = lazy(() => import('./components/InspectorsPage'));
const InspectorHomePage = lazy(() => import('./components/InspectorHomePage'));
const PublicBookingPage = lazy(() => import('./components/PublicBookingPage'));
const StopPage = lazy(() => import('./components/StopPage'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const LeadsPage = lazy(() => import('./components/LeadsPage'));
const AdminPaymentsPage = lazy(() => import('./components/AdminPaymentsPage'));
const StationsPage = lazy(() => import('./components/StationsPage'));
const LegalPage = lazy(() => import('./components/LegalPage'));
const ManageAppointmentPage = lazy(() => import('./components/ManageAppointmentPage'));
const FleetsPage = lazy(() => import('./components/FleetsPage'));
const ClientsPage = lazy(() => import('./components/ClientsPage'));
const HistoryPage = lazy(() => import('./components/HistoryPage'));
const FleetPortalPage = lazy(() => import('./components/FleetPortalPage'));
const PosterPage = lazy(() => import('./components/PosterPage'));
const ItpSheetPage = lazy(() => import('./components/ItpSheetPage'));
const SignupPage = lazy(() => import('./components/SignupPage'));
const PaymentResultPage = lazy(() => import('./components/PaymentResultPage'));
const GuidePage = lazy(() => import('./components/GuidePage'));
const ForgotPasswordPage = lazy(() => import('./components/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./components/VerifyEmailPage'));
const WithdrawalPage = lazy(() => import('./components/WithdrawalPage'));

// Adminul nu are statie proprie, asa ca pagina lui de start e lista de manageri; firmele vad portalul flotei
function Home() {
  const { user } = useAuth();
  if (user?.role === 'ADMIN') return <Navigate to="/users" replace />;
  if (user?.role === 'FLEET') return <FleetPortalPage />;
  if (user?.role === 'INSPECTOR') return <InspectorHomePage />;
  return <Dashboard />;
}

// Pe "/" vizitatorii nelogati vad pagina de prezentare; restul rutelor cer login
function RootGate() {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  if (!isAuthenticated && pathname === '/') {
    return (
      <Suspense fallback={null}>
        <LandingPage />
      </Suspense>
    );
  }
  return (
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  );
}

function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <ServerWakeBanner />
      <UndoToast />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Parola uitata, resetarea din email si confirmarea adresei: fara login */}
          <Route path="/parola-uitata" element={<Suspense fallback={null}><ForgotPasswordPage /></Suspense>} />
          <Route path="/resetare-parola" element={<Suspense fallback={null}><ResetPasswordPage /></Suspense>} />
          <Route path="/confirmare-email" element={<Suspense fallback={null}><VerifyEmailPage /></Suspense>} />
          {/* Inscrierea unei statii noi (proba Premium) */}
          <Route path="/inregistrare" element={<Suspense fallback={null}><SignupPage /></Suspense>} />
          {/* Pagina publica de programare: fara login si fara meniul aplicatiei */}
          {/* Pagini publice: lista statiilor pentru soferi si paginile legale */}
          <Route path="/statii" element={<Suspense fallback={null}><StationsPage /></Suspense>} />
          <Route path="/confidentialitate" element={<Suspense fallback={null}><LegalPage doc="privacy" /></Suspense>} />
          <Route path="/termeni" element={<Suspense fallback={null}><LegalPage doc="terms" /></Suspense>} />
          {/* Functia de retragere din contract (OUG 34/2014 art. 11^1), mereu accesibila din subsol */}
          <Route path="/retragere" element={<Suspense fallback={null}><WithdrawalPage /></Suspense>} />
          {/* Link-ul din SMS-ul de programare: anulare / mutare, fara login */}
          <Route path="/p/:token" element={<Suspense fallback={null}><ManageAppointmentPage /></Suspense>} />
          {/* Link-ul de dezabonare din mesaje: fara login */}
          <Route path="/s/:token" element={<Suspense fallback={null}><StopPage /></Suspense>} />
          <Route
            path="/stop/:token"
            element={
              <Suspense fallback={null}>
                <StopPage />
              </Suspense>
            }
          />
          <Route
            path="/programare/:slug"
            element={
              <Suspense fallback={null}>
                <PublicBookingPage />
              </Suspense>
            }
          />
          {/* Afisul A4 cu QR: fara meniul aplicatiei, ca sa se tipareasca curat */}
          <Route
            path="/afis"
            element={
              <ProtectedRoute requiredRole="MANAGER">
                <Suspense fallback={null}>
                  <PosterPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          {/* Fisa ITP pentru client, de tiparit */}
          <Route
            path="/fisa/:id"
            element={
              <ProtectedRoute requiredRole="MANAGER">
                <Suspense fallback={null}>
                  <ItpSheetPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<RootGate />}>
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
            <Route
              path="history"
              element={
                <ProtectedRoute requiredRole="MANAGER">
                  <HistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="clients"
              element={
                <ProtectedRoute requiredRole="MANAGER">
                  <ClientsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="fleets"
              element={
                <ProtectedRoute requiredRole="MANAGER">
                  <FleetsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute requiredRole={['ADMIN', 'MANAGER']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="inspectori"
              element={
                <ProtectedRoute requiredRole="MANAGER">
                  <InspectorsPage />
                </ProtectedRoute>
              }
            />
            <Route path="account" element={<AccountPage />} />
            {/* Ghidul de utilizare pentru statie */}
            <Route
              path="ghid"
              element={
                <ProtectedRoute requiredRole="MANAGER">
                  <GuidePage />
                </ProtectedRoute>
              }
            />
            {/* Intoarcerea din pagina de plata Netopia */}
            <Route
              path="plata"
              element={
                <ProtectedRoute requiredRole="MANAGER">
                  <PaymentResultPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <UserManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="leads"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <LeadsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="plati"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <AdminPaymentsPage />
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
