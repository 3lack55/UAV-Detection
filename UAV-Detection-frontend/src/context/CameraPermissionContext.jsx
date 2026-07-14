import { useEffect, useContext, useState, createContext } from "react";
import { useAuth } from "./AuthContext";
import { useWebSocket } from "./WebsocketContext";

const CameraPermissionContext = createContext();

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

const cameraPositions = (data) => {
    return data.map(cam => ({
        id: cam.camera_id,
        lat: parseFloat(cam.latitude),
        lng: parseFloat(cam.longitude),
        name: cam.camera_name,
        heading: cam.heading || 0,
        status: cam.status,
        last_update: cam.last_update || null,
    }));
};

export function CameraPermissionProvider({ children }) {
    const [permissions, setPermissions] = useState([]);
    const { user } = useAuth();
    const { systemEvent, connected } = useWebSocket();
    const [loading, setLoading] = useState(true);
    const [basePosition, setBasePosition] = useState([]);
    const [cameraList, setCameraList] = useState([]);

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
        if (!user || !systemEvent) return;
        const shouldRefresh = ["permission_changed", "camera_changed", "role_changed"].includes(systemEvent.event);
        if (shouldRefresh) {
            const targetUser = systemEvent.data?.userId;
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
    }, [systemEvent, user?.user_id, user?.token]);

    useEffect(() => {
        if (!connected) return;
        if (systemEvent && systemEvent.event !== "camera_changed") return;

        const fetchCameras = async () => {
            try {
                const response = await fetch(`${PROTOCOL}://${HOST}:${HOST_PORT}/api/camera/getAllCameras`);
                const data = await response.json();
                if (data.success) {
                    setCameraList(data.data);
                    setBasePosition(cameraPositions(data.data));
                }
            } catch (err) {
                console.error("Error fetching cameras:", err);
            }
        };
        fetchCameras();
    }, [connected, systemEvent?.event, systemEvent?.data?.timestamp]);

    return (
        <CameraPermissionContext.Provider value={{ permissions, loading, basePosition, cameraList }}>
            {children}
        </CameraPermissionContext.Provider>
    );
}

export const useCameraPermissions = () => useContext(CameraPermissionContext);