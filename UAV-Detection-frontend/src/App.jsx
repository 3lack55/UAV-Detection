import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CameraPermissionProvider } from "./context/CameraPermissionContext";
import { useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Account from "./pages/account";
import SystemControl from "./pages/SystemControl";
import { WebSocketProvider, useWebSocket } from "./context/WebsocketContext";

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

function AuthRequiredModal() {
  const { authRequired, clearAuthRequired } = useWebSocket();
  const { logout } = useAuth();

  if (!authRequired) return null;

  const handleLogout = () => {
    clearAuthRequired();
    logout();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-xl bg-slate-900 p-6 text-center shadow-2xl border border-slate-700">
        <h3 className="text-xl font-semibold text-white">การยืนยันตัวตนล้มเหลว</h3>
        <p className="mt-3 text-sm text-slate-300">
          เซสชันของคุณถูกยกเลิกโดยเซิร์ฟเวอร์ กรุณากดปุ่มด้านล่างเพื่อออกจากระบบด้วยตนเอง
        </p>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <CameraPermissionProvider>
          <Router>
            <AuthRequiredModal />
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