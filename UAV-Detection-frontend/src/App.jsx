import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CameraPermissionProvider } from "./context/CameraPermissionContext";
import { useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Account from "./pages/account";
import SystemControl from "./pages/SystemControl";
import { WebSocketProvider } from "./context/WebsocketContext";

function PrivateRoute({ children }) {
  const { user, loading, saveRedirectUrl } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user && !loading) {
      saveRedirectUrl(location.pathname);
    }
  }, [user, loading, location.pathname, saveRedirectUrl]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <p className="text-slate-400">กำลังโหลด...</p>
    </div>
  );

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
}

function AdminPrivateRoute({ children }) {
  const { user, loading, clearRedirectUrl } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <p className="text-slate-400">กำลังโหลด...</p>
    </div>
  );

  if (user.role !== "admin") {
    clearRedirectUrl();
    return <Navigate to="/" />
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <CameraPermissionProvider>
          <Router>
            <Routes>
              <Route path="/" element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } />

              <Route path="/login" element={<Login />} />

              <Route path="/register" element={<Register />} />

              <Route path="/account" element={
                <PrivateRoute>
                  <Account />
                </PrivateRoute>
              } />

              <Route path="/system-control" element={
                <PrivateRoute>
                  <AdminPrivateRoute>
                    <SystemControl />
                  </AdminPrivateRoute>
                </PrivateRoute>
              } />
            </Routes>
          </Router>
        </CameraPermissionProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}