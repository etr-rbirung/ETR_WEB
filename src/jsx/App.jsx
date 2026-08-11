import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import LoginPage from './Login.jsx';
import DashboardPage from './Dashboard.jsx';
import appLogo from '../assets/branding/etr-logo.png';
import { clearAuth, getToken, getUser, isTokenExpired } from '../services/authStorage';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

function buildApiUrl(path) {
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}

function getStoredUser() {
  if (isTokenExpired()) {
    clearAuth();
    return null;
  }

  return getUser();
}

function App() {
  const [sessionUser, setSessionUser] = useState(getStoredUser);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'ETR-WEB';

    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.setAttribute('rel', 'icon');
      document.head.appendChild(favicon);
    }

    favicon.setAttribute('type', 'image/png');
    favicon.setAttribute('href', appLogo);
  }, []);

  const confirmLogout = async () => {
    const token = getToken();

    try {
      if (token) {
        await fetch(buildApiUrl('/login/logout'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // Local logout should still succeed even if the API is unavailable.
    } finally {
      setIsLogoutConfirmOpen(false);
      clearAuth();
      setSessionUser(null);
      navigate('/login', { replace: true });
    }
  };

  const handleLoginSuccess = (user) => {
    setSessionUser(user);
    const redirectPath = location.state?.from?.pathname || '/dashboard';
    navigate(redirectPath, { replace: true });
  };

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={
            sessionUser
              ? <Navigate to="/dashboard" replace />
              : <LoginPage onLoginSuccess={handleLoginSuccess} />
          }
        />
        <Route
          path="/dashboard"
          element={
            sessionUser
              ? <DashboardPage user={sessionUser} onLogout={() => setIsLogoutConfirmOpen(true)} />
              : <Navigate to="/login" replace state={{ from: location }} />
          }
        />
        <Route
          path="/dashboard/:moduleId"
          element={
            sessionUser
              ? <DashboardPage user={sessionUser} onLogout={() => setIsLogoutConfirmOpen(true)} />
              : <Navigate to="/login" replace state={{ from: location }} />
          }
        />
        <Route path="/" element={<Navigate to={sessionUser ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={sessionUser ? '/dashboard' : '/login'} replace />} />
      </Routes>

      {isLogoutConfirmOpen ? (
        <div className="etr-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
          <div className="etr-confirm-modal">
            <h2 id="logout-confirm-title">Confirm Logout</h2>
            <p>Are you sure you want to log out?</p>
            <div className="etr-confirm-actions">
              <button type="button" className="etr-confirm-secondary" onClick={() => setIsLogoutConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="etr-confirm-primary" onClick={confirmLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default App;
