import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { CameraPermissionProvider } from "../context/CameraPermissionContext";
import { WebSocketProvider } from "../context/WebSocketContext";
import AuthRequiredModal from "./components/AuthRequiredModal";
import AppRoutes from "./routes";

export default function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <CameraPermissionProvider>
          <BrowserRouter>
            <AuthRequiredModal />
            <AppRoutes />
          </BrowserRouter>
        </CameraPermissionProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}
