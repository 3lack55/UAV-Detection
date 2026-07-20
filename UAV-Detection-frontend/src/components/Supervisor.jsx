import { useState, useEffect, useMemo } from 'react';
import { useWebSocket } from '../context/WebsocketContext';
import { useAuth } from '../context/AuthContext';
import { Joystick } from 'lucide-react';

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";
const API_BASE_URL = `${PROTOCOL}://${HOST}:${HOST_PORT}`;

function Supervisor() {
    const { statusUpdate } = useWebSocket();
    const { user } = useAuth();
    const [controllingUsers, setControllingUsers] = useState([]);

    const userIds = useMemo(() => {
        if (statusUpdate?.onControlCameras && Array.isArray(statusUpdate.onControlCameras)) {
            const ids = statusUpdate.onControlCameras
                .map((u) => u.controller?.userId)
                .filter(id => id != null);
            return ids.length > 0 ? ids : null;
        }
        return null;
    }, [statusUpdate?.onControlCameras]);

    useEffect(() => {
        if (!userIds || !user?.token) {
            setControllingUsers([]);
            return;
        }

        const fetchControllingUsers = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/userQuery`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user.token}`
                    },
                    body: JSON.stringify({ userIds })
                });

                const data = await response.json();
                setControllingUsers(data.success ? (data.data || []) : []);
            } catch (error) {
                console.error('Error fetching controlling users:', error);
                setControllingUsers([]);
            }
        };

        fetchControllingUsers();
    }, [userIds, user?.token]);

    console.log(statusUpdate?.onControlCameras, controllingUsers);

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
                                title={u.username}
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