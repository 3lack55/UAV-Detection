import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useEffect } from "react";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <p className="text-slate-400">กำลังโหลด...</p>
    </div>
  );
}

export function PrivateRoute({ children }) {
  const { user, loading, saveRedirectUrl } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user && !loading) {
      saveRedirectUrl(location.pathname);
    }
  }, [user, loading, location.pathname, saveRedirectUrl]);

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;

  return children;
}

export function AdminPrivateRoute({ children }) {
  const { user, loading, clearRedirectUrl } = useAuth();

  if (loading) return <LoadingScreen />;

  if (user?.role !== "admin") {
    clearRedirectUrl();
    return <Navigate to="/" />;
  }

  return children;
}
