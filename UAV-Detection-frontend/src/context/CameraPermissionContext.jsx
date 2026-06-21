import { useEffect, useContext, useState, createContext } from "react"; // ✅ ลบ use ออก
import { useAuth } from "./AuthContext";

const CameraPermissionContext = createContext();

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

export function CameraPermissionProvider({ children }) {
    const [permissions, setPermissions] = useState([]);
    const { user } = useAuth();
    const [loading, setLoading] = useState(true); 

    useEffect(() => {
        if (!user) return;

        const fetchPermissions = async () => {
            try {
                const response = await fetch(`${PROTOCOL}://${HOST}:${HOST_PORT}/api/camera/getCameraPermissionsByUser/${user.user_id}`, {
                    headers: {
                        Authorization: `Bearer ${user.token}`,
                    }
                });
                const data = await response.json();
                setPermissions(data);
            } catch (err) {
                console.error("Error fetching camera permissions:", err);
            }
        };

        fetchPermissions();
        setLoading(false);
    }, [user]);

    return (
        <CameraPermissionContext.Provider value={{ permissions, loading }}>
            {children}
        </CameraPermissionContext.Provider>
    );
}

export const useCameraPermissions = () => useContext(CameraPermissionContext);