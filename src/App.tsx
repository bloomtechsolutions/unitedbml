import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ToastProvider } from './lib/ToastContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Placeholder } from './pages/Placeholder';
import { EventsPage } from './features/events/EventsPage';

function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!session) return <Login />;
  return <Layout />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<RequireAuth />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/tournaments" element={<Placeholder title="Tournaments" />} />
        <Route path="/finance" element={<Placeholder title="Finance" />} />
        <Route path="/reimbursements" element={<Placeholder title="Reimbursements" />} />
        <Route path="/meetings" element={<Placeholder title="Meetings" />} />
        <Route path="/committee" element={<Placeholder title="Committee" />} />
        <Route path="/leaderboard" element={<Placeholder title="Leaderboard" />} />
        <Route path="/communication" element={<Placeholder title="Communication" />} />
        <Route path="/documents" element={<Placeholder title="Documents" />} />
        <Route path="/reports" element={<Placeholder title="Reports" />} />
        <Route path="/staff-master" element={<Placeholder title="Staff Master" />} />
        <Route path="/staff-audience" element={<Placeholder title="Location Classification" />} />
        <Route path="/settings" element={<Placeholder title="Settings" />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
