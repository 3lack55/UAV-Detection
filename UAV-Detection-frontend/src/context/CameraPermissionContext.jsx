import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { useWebSocket } from "./useWebSocket";
import { getAllCameras, getCameraPermissions } from "../services/cameraApi";
import { CameraPermissionContext } from "./camera-permission-context-definition";

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
                const data = await getCameraPermissions(user.user_id, user.token);
                setPermissions(data?.data || []);
            } catch (err) {
                console.error("Error fetching camera permissions:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPermissions();
    }, [user]);

    useEffect(() => {
        if (!user || !systemEvent) return;
        const shouldRefresh = ["permission_changed", "camera_changed", "role_changed"].includes(systemEvent.event);
        if (shouldRefresh) {
            const targetUser = systemEvent.data?.userId;
            if (!targetUser || String(targetUser) === String(user.user_id)) {
                setLoading(true);
                getCameraPermissions(user.user_id, user.token)
                    .then(data => setPermissions(data?.data || []))
                    .catch(err => console.error("Error refreshing camera permissions:", err))
                    .finally(() => setLoading(false));
            }
        }
    }, [systemEvent, user]);

    useEffect(() => {
        if (!connected) return;
        if (systemEvent && systemEvent.event !== "camera_changed") return;

        const fetchCameras = async () => {
            try {
                const data = await getAllCameras();
                if (data.success) {
                    setCameraList(data.data);
                    setBasePosition(cameraPositions(data.data.filter(d => d.deleted !== 1)));
                }
            } catch (err) {
                console.error("Error fetching cameras:", err);
            }
        };
        fetchCameras();
    }, [connected, systemEvent]);

    return (
        <CameraPermissionContext.Provider value={{ permissions, loading, basePosition, cameraList }}>
            {children}
        </CameraPermissionContext.Provider>
    );
}