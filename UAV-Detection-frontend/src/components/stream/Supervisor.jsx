import { useState, useEffect, useMemo } from 'react';
import { useWebSocket } from '../../context/useWebSocket';
import { useAuth } from '../../context/useAuth';
import { Joystick } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { getUsersByIds } from '../../services/userApi';

function Supervisor( {cameraId} ) {
    const { statusUpdate } = useWebSocket();
    const { user } = useAuth();
    const [controllingUsers, setControllingUsers] = useState([]);
    const onControlCameras = statusUpdate?.onControlCameras;

    const userIds = useMemo(() => {
        if (onControlCameras && Array.isArray(onControlCameras)) {
            const ids = onControlCameras
                .filter((u) => u.cameraId === cameraId || u.cameraId === `camera${cameraId}`)
                .map((u) => u.controller?.userId)
                .filter(id => id != null);
            return ids.length > 0 ? ids : null;
        }
        return null;
    }, [onControlCameras, cameraId]);

    useEffect(() => {
        if (!userIds || !user?.token) {
            const resetTimeout = setTimeout(() => setControllingUsers([]), 0);
            return () => clearTimeout(resetTimeout);
        }

        const fetchControllingUsers = async () => {
            try {
                const data = await getUsersByIds(userIds, user.token);
                setControllingUsers(data.success ? (data.data || []) : []);
            } catch (error) {
                console.error('Error fetching controlling users:', error);
                setControllingUsers([]);
            }
        };

        fetchControllingUsers();
    }, [userIds, user?.token]);

    return (
        <>
            <div className="flex items-center gap-2">
                <Joystick className="w-5 h-5 text-blue-400" />
                {controllingUsers?.length > 0 ? (
                    <>
                        {controllingUsers.map((u) => (
                            <img
                                key={u.user_id}
                                src={u.profile_image ? `${API_BASE_URL}/uploads/user_profile/${u.profile_image}` : "account.png"}
                                alt={u.username}
                                title={`${u.username} ควบคุมอยู่`}
                                className="w-7 h-7 rounded-full border-2 border-blue-500 object-cover"
                            />
                        ))}
                    </>
                ) : (
                    <span className="text-[11px] text-blue-400">ไม่มีผู้ควบคุม</span>
                )}
            </div>
        </>
    );
}

export { Supervisor };