import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MonitorDetail from './pages/MonitorDetail';
import Settings from './pages/Settings';
import StatusPage from './pages/StatusPage';
import Login from './pages/Login';
import Setup from './pages/Setup';

const AppContent = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Setup Interceptor
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && window.location.pathname !== '/login' && window.location.pathname !== '/setup') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );

    const checkStatus = async () => {
      try {
        // Check if setup is required
        const setupRes = await axios.get('/api/setup/status');
        if (setupRes.data.required) {
          setSetupRequired(true);
        } else {
          // Initial Auth Check
          try {
            const res = await axios.get('/api/auth/me');
            setUser(res.data);
          } catch {
            setUser(null);
          }
        }
      } catch (e) {
        console.error("Failed to check status", e);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const isStatusPage = location.pathname.startsWith('/status/');
  const isLoginPage = location.pathname === '/login';
  const isSetupPage = location.pathname === '/setup';

  if (loading && !isStatusPage && !isLoginPage && !isSetupPage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (setupRequired && !isSetupPage) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <Routes>
      {/* Public Status Pages */}
      <Route path="/status/:slug" element={<StatusPage />} />

      {/* Setup Page */}
      <Route path="/setup" element={!setupRequired ? <Navigate to="/" replace /> : <Setup />} />

      {/* Login Page */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      {/* Protected Routes */}
      <Route path="*" element={
        !user ? <Navigate to="/login" state={{ from: location }} replace /> : (
          <Layout user={user}>
            <Routes>
              <Route path="/" element={<Dashboard user={user} />} />
              <Route path="/monitor/:id" element={<MonitorDetail user={user} />} />
              <Route
                path="/settings"
                element={user.role === 'admin' ? <Settings /> : <Navigate to="/" replace />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        )
      } />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
