import { useEffect, useContext, useState, createContext } from "react";
import { useAuth } from "./AuthContext";
import { useWebSocket } from "./WebsocketContext";

const CameraPermissionContext = createContext();

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

export function CameraPermissionProvider({ children }) {
    const [permissions, setPermissions] = useState([]);
    const { user } = useAuth();
    const { realtimeEvent } = useWebSocket();
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
                setPermissions(data?.data || []);
            } catch (err) {
                console.error("Error fetching camera permissions:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPermissions();
    }, [user?.user_id, user?.token]);

    useEffect(() => {
        if (!user || !realtimeEvent) return;
        const shouldRefresh = ["permission_changed", "camera_changed", "role_changed"].includes(realtimeEvent.event);
        if (shouldRefresh) {
            const targetUser = realtimeEvent.data?.userId;
            if (!targetUser || String(targetUser) === String(user.user_id)) {
                setLoading(true);
                fetch(`${PROTOCOL}://${HOST}:${HOST_PORT}/api/camera/getCameraPermissionsByUser/${user.user_id}`, {
                    headers: { Authorization: `Bearer ${user.token}` }
                })
                    .then(res => res.json())
                    .then(data => setPermissions(data?.data || []))
                    .catch(err => console.error("Error refreshing camera permissions:", err))
                    .finally(() => setLoading(false));
            }
        }
    }, [realtimeEvent, user?.user_id, user?.token]);

    return (
        <CameraPermissionContext.Provider value={{ permissions, loading }}>
            {children}
        </CameraPermissionContext.Provider>
    );
}

export const useCameraPermissions = () => useContext(CameraPermissionContext);