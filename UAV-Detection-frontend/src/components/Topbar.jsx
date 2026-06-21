import { useEffect, useRef, useState } from "react";
import { Activity, Wifi, WifiOff, WifiSync } from "lucide-react";
import Profile from "./Profile";
import Clock from "./Clock";
import { useWebSocket } from "../context/WebsocketContext";
import { useAuth } from "../context/AuthContext";

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

const MAX_VISIBLE_AVATARS = 3;

function Topbar() {
    const { connected, reconnecting, lastMessage } = useWebSocket();
    const [showConnected, setShowConnected] = useState(connected);
    const [onlineUsers, setOnlineUsers] = useState(null);
    const [showAllUsers, setShowAllUsers] = useState(false);
    const { user } = useAuth();
    const dropdownRef = useRef(null);

    const apiBaseUrl = `${PROTOCOL}://${HOST}:${HOST_PORT}`;

    useEffect(() => {
        if (!connected) return;
        const showTimer = setTimeout(() => {
            setShowConnected(true);
        }, 0);
        const hideTimer = setTimeout(() => {
            setShowConnected(false);
        }, 1500);
        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
        };
    }, [connected]);

    useEffect(() => {
        const fetchOnlineUsers = async (query) => {
            const response = await fetch(`${apiBaseUrl}/api/auth/userQuery`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({ query })
            });
            const data = await response.json();
            setOnlineUsers(data.data);
        };
        if (lastMessage && lastMessage.onlineUsers !== undefined && lastMessage.onlineUsers.length !== 0) {
            const users = lastMessage.onlineUsers;
            const query = "SELECT * FROM users WHERE user_id IN (" + users.map((u) => u.userId).join(',') + ")";
            fetchOnlineUsers(query);
        }
    }, [lastMessage]);

    // ปิด dropdown เมื่อคลิกข้างนอก
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowAllUsers(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getStatusIndicator = () => {
        if (connected && showConnected) {
            return (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-900/30 border border-green-500/50">
                    <Wifi className="w-4 h-4 text-green-400 animate-pulse" />
                    <span className="text-sm text-green-400 max-md:hidden">Connected</span>
                </div>
            );
        }

        if (connected && !showConnected) {
            const hasUsers = onlineUsers && onlineUsers.length > 0;
            const visibleUsers = hasUsers ? onlineUsers.slice(0, MAX_VISIBLE_AVATARS) : [];
            const extraCount = hasUsers ? onlineUsers.length - MAX_VISIBLE_AVATARS : 0;

            return (
                <div className="relative" ref={dropdownRef}>
                    <div
                        className={`flex items-center gap-2 p-1 pr-1.5 max-md:p-0 rounded-full bg-slate-700/30 border border-blue-500/50 ${hasUsers ? "cursor-pointer hover:bg-slate-700/50" : ""} transition-colors`}
                        onClick={() => hasUsers && setShowAllUsers((prev) => !prev)}
                    >
                        {hasUsers ? (
                            <>
                                <div className="flex items-center">
                                    {visibleUsers.map((u, index) => (
                                        <img
                                            key={u.user_id}
                                            src={u.profile_image ? `${apiBaseUrl}/uploads/user_profile/${u.profile_image}` : "account.png"}
                                            alt={u.username}
                                            title={u.username}
                                            className="w-7 h-7 rounded-full border-2 border-blue-500 object-cover"
                                            style={{
                                                marginLeft: index === 0 ? 0 : "-14px",
                                                zIndex: visibleUsers.length - index,
                                            }}
                                        />
                                    ))}
                                    {extraCount > 0 && (
                                        <div
                                            className="w-7 h-7 rounded-full border-2 border-blue-500 bg-blue-600 flex items-center justify-center text-[10px] font-semibold text-white"
                                            style={{ marginLeft: "4px", zIndex: 0 }}
                                        >
                                            +{extraCount}
                                        </div>
                                    )}
                                </div>
                                <span className="text-sm text-blue-300 max-md:hidden">
                                    {onlineUsers.length} online
                                </span>
                            </>
                        ) : (
                            <span className="text-sm text-slate-400">No Users Online</span>
                        )}
                    </div>

                    {showAllUsers && hasUsers && (
                        <div className="absolute right-0 mt-2 w-56 max-h-72 overflow-y-auto bg-slate-800 border border-blue-500 rounded-lg shadow-lg z-[1002]">
                            {onlineUsers.map((u) => (
                                <div
                                    key={u.user_id}
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700/50"
                                >
                                    <img
                                        src={u.profile_image ? `${apiBaseUrl}/uploads/user_profile/${u.profile_image}` : "account.png"}
                                        alt={u.username}
                                        className="w-6 h-6 rounded-full object-cover"
                                    />
                                    <span className="text-sm text-slate-200">{u.username}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        if (reconnecting) {
            return (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-900/30 border border-yellow-500/50">
                    <WifiSync className="w-4 h-4 text-yellow-400 animate-pulse" />
                    <span className="text-sm text-yellow-400 max-md:hidden">Reconnecting...</span>
                </div>
            );
        }
        return (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-900/30 border border-red-500/50">
                <WifiOff className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400 max-md:hidden">Disconnected</span>
            </div>
        );
    };

    return (
        <>
            <div className="flex items-center justify-between bg-slate-800 pl-6 py-3 border-b border-slate-700 h-full w-full">
                <div className="flex items-center gap-3">
                    <Activity className="w-6 h-6 text-blue-400" />
                    <div>
                        <h1 className="text-xl font-bold max-sm:hidden">Bobo's Command Center</h1>
                        <h1 className="text-xl font-bold sm:hidden">Command Center</h1>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div>
                        {getStatusIndicator()}
                    </div>
                    <div className="w-[2px] h-[25px] bg-white/20 rounded-full max-sm:hidden"></div>
                    <div className="text-right max-sm:hidden">
                        <Clock />
                    </div>
                    <div className="w-[2px] h-[25px] bg-white/20 rounded-full max-sm:hidden"></div>
                    <div className="hover:bg-white/10 rounded-[9999px_0_0_9999px] transition-colors">
                        <Profile />
                    </div>
                </div>
            </div>
        </>
    )
}

export default Topbar;