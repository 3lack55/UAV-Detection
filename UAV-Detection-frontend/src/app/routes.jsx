import { Route, Routes } from "react-router-dom";
import Account from "../pages/account/Account";
import Dashboard from "../pages/dashboard/Dashboard";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import SystemControl from "../pages/admin/SystemControl";
import { AdminPrivateRoute, PrivateRoute } from "./guards/PrivateRoute";

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/account"
        element={
          <PrivateRoute>
            <Account />
          </PrivateRoute>
        }
      />
      <Route
        path="/system-control"
        element={
          <PrivateRoute>
            <AdminPrivateRoute>
              <SystemControl />
            </AdminPrivateRoute>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
