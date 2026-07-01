import { useState, useEffect, useMemo } from "react"
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebsocketContext";

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

const ROLE_BADGE = {
    admin: { label: "admin", className: "badge-admin" },
    user: { label: "user", className: "badge-user" },
    banned: { label: "banned", className: "badge-banned" },
};

function getInitials(name = "") {
    return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(role) {
    if (role === "admin") return { bg: "#EEEDFE", color: "#3C3489" };
    if (role === "banned") return { bg: "#FCEBEB", color: "#791F1F" };
    return { bg: "#E1F5EE", color: "#085041" };
}

function ConfirmModal({ open, title, message, confirmLabel, confirmClass, onConfirm, onCancel }) {
    if (!open) return null;
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <h3 className="modal-title">{title}</h3>
                <p className="modal-message">{message}</p>
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={onCancel}>ยกเลิก</button>
                    <button className={`btn-confirm ${confirmClass}`} onClick={onConfirm}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}

function ProfileModal({ user: targetUser, open, onClose, apiBase, token }) {
    if (!open || !targetUser) return null;
    const imgPath = targetUser.profile_image
        ? `${apiBase}/uploads/user_profile/${targetUser.profile_image}`
        : null;
    const avatarStyle = getAvatarColor(targetUser.role);
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box profile-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose} aria-label="ปิด">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>
                <div className="profile-header">
                    {imgPath ? (
                        <img src={imgPath} alt={targetUser.username} className="profile-avatar-img" />
                    ) : (
                        <div className="profile-avatar-placeholder" style={{ background: avatarStyle.bg, color: avatarStyle.color }}>
                            {getInitials(targetUser.username)}
                        </div>
                    )}
                    <div>
                        <div className="profile-username">{targetUser.username}</div>
                        <span className={`badge ${ROLE_BADGE[targetUser.role]?.className || "badge-user"}`}>
                            {ROLE_BADGE[targetUser.role]?.label || targetUser.role}
                        </span>
                    </div>
                </div>
                <div className="profile-rows">
                    <div className="profile-row">
                        <span className="profile-row-label">User ID</span>
                        <span className="profile-row-value">{targetUser.user_id}</span>
                    </div>
                    {targetUser.created_at && (
                        <div className="profile-row">
                            <span className="profile-row-label">สมัครเมื่อ</span>
                            <span className="profile-row-value">
                                {new Date(targetUser.created_at).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function UserList({ search, setSearch, roleFilter, setRoleFilter, onStatsUpdate }) {
    const { user } = useAuth();
    const { realtimeEvent } = useWebSocket();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [profileUser, setProfileUser] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);
    const [toastMsg, setToastMsg] = useState(null);

    const apiBase = `${PROTOCOL}://${HOST}:${HOST_PORT}`;

    const showToast = (msg, type = "success") => {
        setToastMsg({ msg, type });
        setTimeout(() => setToastMsg(null), 3000);
    };

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch(`${apiBase}/api/systemControl/allUsers`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${user.token}`,
                    },
                });
                const result = await res.json();
                if (result.success) setUsers(result.data);
                else setError("ไม่สามารถโหลดข้อมูลได้");
            } catch (err) {
                setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
            } finally {
                setLoading(false);
            }
        };

        if (user?.token) {
            fetchUsers();
        }
    }, [user?.token]);

    useEffect(() => {
        if (!user?.token || !realtimeEvent) return;
        const shouldRefresh = ["role_changed", "user_deleted", "permission_changed", "camera_changed"].includes(realtimeEvent.event);
        if (shouldRefresh) {
            setLoading(true);
            fetch(`${apiBase}/api/systemControl/allUsers`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${user.token}`,
                },
            })
                .then(res => res.json())
                .then(result => {
                    if (result.success) setUsers(result.data);
                })
                .catch(() => setError("เกิดข้อผิดพลาดในการเชื่อมต่อ"))
                .finally(() => setLoading(false));
        }
    }, [realtimeEvent, user?.token]);

    const filtered = useMemo(() => {
        return users.filter(u => {
            const matchSearch = u.username.toLowerCase().includes(search.toLowerCase());
            const matchRole = roleFilter === "all" || u.role === roleFilter;
            return matchSearch && matchRole;
        });
    }, [users, search, roleFilter]);

    const stats = useMemo(() => ({
        total: users.filter(u => u.deleted !== 1).length,
        admin: users.filter(u => u.role === "admin").length,
        banned: users.filter(u => u.role === "banned" && u.deleted !== 1).length,
    }), [users]);

    useEffect(() => {
        onStatsUpdate(stats)
    }, [stats])

    // --- Actions ---
    const handleChangeRole = (targetUser) => {
        const newRole = targetUser.role === "admin" ? "user" : "admin";
        setConfirmModal({
            title: `เปลี่ยน Role เป็น "${newRole}"`,
            message: `ต้องการเปลี่ยน Role ของ "${targetUser.username}" จาก "${targetUser.role}" เป็น "${newRole}" ใช่ไหม?`,
            confirmLabel: "เปลี่ยน Role",
            confirmClass: "confirm-info",
            onConfirm: async () => {
                setConfirmModal(null);
                try {
                    const res = await fetch(`${apiBase}/api/systemControl/changeRole/${targetUser.user_id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
                        body: JSON.stringify({ role: newRole }),
                    });
                    const result = await res.json();
                    if (result.success) {
                        setUsers(prev => prev.map(u => u.user_id === targetUser.user_id ? { ...u, role: newRole } : u));
                        showToast(`เปลี่ยน Role ของ "${targetUser.username}" เป็น "${newRole}" แล้ว`);
                    } else {
                        showToast("เปลี่ยน Role ไม่สำเร็จ", "error");
                    }
                } catch {
                    showToast("เกิดข้อผิดพลาด", "error");
                }
            },
        });
    };

    const handleBanToggle = (targetUser) => {
        const isBanned = targetUser.role === "banned";
        setConfirmModal({
            title: isBanned ? `ปลด Ban "${targetUser.username}"` : `Suspend "${targetUser.username}"`,
            message: isBanned
                ? `ต้องการปลด Ban และคืนสิทธิ์ User ให้ "${targetUser.username}" ใช่ไหม?`
                : `ต้องการ Suspend "${targetUser.username}" ออกจากระบบชั่วคราวใช่ไหม? ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้`,
            confirmLabel: isBanned ? "ปลด Ban" : "Suspend",
            confirmClass: isBanned ? "confirm-success" : "confirm-warn",
            onConfirm: async () => {
                setConfirmModal(null);
                const newRole = isBanned ? "user" : "banned";
                try {
                    const res = await fetch(`${apiBase}/api/systemControl/changeRole/${targetUser.user_id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
                        body: JSON.stringify({ role: newRole }),
                    });
                    const result = await res.json();
                    if (result.success) {
                        setUsers(prev => prev.map(u => u.user_id === targetUser.user_id ? { ...u, role: newRole } : u));
                        showToast(isBanned ? `ปลด Ban "${targetUser.username}" แล้ว` : `Suspend "${targetUser.username}" แล้ว`, isBanned ? "success" : "warn");
                    } else {
                        showToast("ดำเนินการไม่สำเร็จ", "error");
                    }
                } catch {
                    showToast("เกิดข้อผิดพลาด", "error");
                }
            },
        });
    };

    const handleDelete = (targetUser) => {
        setConfirmModal({
            title: `ลบผู้ใช้ "${targetUser.username}"`,
            message: `การลบไม่สามารถย้อนกลับได้ ต้องการลบ "${targetUser.username}" ออกจากระบบถาวรใช่ไหม?`,
            confirmLabel: "ลบถาวร",
            confirmClass: "confirm-danger",
            onConfirm: async () => {
                setConfirmModal(null);
                try {
                    const res = await fetch(`${apiBase}/api/systemControl/deleteUser/${targetUser.user_id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${user.token}` },
                    });
                    if (res.ok && res.status === 204) {
                        setUsers(prev => prev.filter(u => u.user_id !== targetUser.user_id));
                        showToast(`ลบ "${targetUser.username}" ออกจากระบบแล้ว`, "error");
                    } else {
                        showToast("ลบไม่สำเร็จ", "error");
                    }
                } catch {
                    showToast("เกิดข้อผิดพลาด", "error");
                }
            },
        });
    };

    if (loading) {
        return (
            <div className="ul-loading">
                <p>กำลังโหลด...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ul-loading">
                <p className="ul-error">{error}</p>
            </div>
        );
    }

    return (
        <>
            <div className="ul-wrap">
                <div className="lg:hidden">
                    {/* Stats */}
                    <div className="ul-stats">
                        <div className="ul-stat">
                            <div className="ul-stat-label">ทั้งหมด</div>
                            <div className="ul-stat-val">{stats.total}</div>
                        </div>
                        <div className="ul-stat">
                            <div className="ul-stat-label">Admin</div>
                            <div className="ul-stat-val">{stats.admin}</div>
                        </div>
                        <div className="ul-stat">
                            <div className="ul-stat-label">Banned</div>
                            <div className="ul-stat-val">{stats.banned}</div>
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="ul-toolbar">
                        <div className="ul-search">
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                                <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อผู้ใช้..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <select
                            className="ul-filter"
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                        >
                            <option value="all">ทุก Role</option>
                            <option value="admin">Admin</option>
                            <option value="user">User</option>
                            <option value="banned">Banned</option>
                        </select>
                    </div>
                </div>

                {/* User list */}
                {filtered.length === 0 ? (
                    <div className="ul-empty">ไม่พบผู้ใช้ที่ตรงกับการค้นหา</div>
                ) : (
                    filtered.map((u) => {
                        if (u.deleted) return;
                        const imgPath = u.profile_image
                            ? `${apiBase}/uploads/user_profile/${u.profile_image}`
                            : null;
                        const avatarStyle = getAvatarColor(u.role);
                        const isBanned = u.role === "banned";
                        return (
                            <div key={u.user_id} className={`ul-card ${isBanned ? "is-banned" : ""}`}>
                                {imgPath ? (
                                    <img src={imgPath} alt={u.username} className="ul-avatar-img" />
                                ) : (
                                    <div className="ul-avatar" style={{ background: avatarStyle.bg, color: avatarStyle.color }}>
                                        {getInitials(u.username)}
                                    </div>
                                )}

                                <div className="ul-info">
                                    <div className="ul-username">{u.username}</div>
                                    <div className="ul-meta">
                                        <span className="ul-uid">#{u.user_id}</span>
                                        <span className={`badge ${ROLE_BADGE[u.role]?.className || "badge-user"}`}>
                                            {ROLE_BADGE[u.role]?.label || u.role}
                                        </span>
                                        {u.created_at && (
                                            <span className="ul-date">
                                                {new Date(u.created_at).toLocaleDateString("th-TH", { year: "2-digit", month: "short", day: "numeric" })}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="ul-actions">
                                    {/* ดู Profile */}
                                    <button
                                        className="ul-btn"
                                        title="ดู Profile"
                                        onClick={() => setProfileUser(u)}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                            <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                                            <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2" />
                                        </svg>
                                    </button>

                                    {/* เปลี่ยน Role */}
                                    <button
                                        className="ul-btn"
                                        title={u.role === "admin" ? "เปลี่ยนเป็น User" : "เปลี่ยนเป็น Admin"}
                                        onClick={() => handleChangeRole(u)}
                                        disabled={isBanned}
                                        style={isBanned ? { opacity: 0.3, cursor: "not-allowed" } : {}}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                            <path d="M7.5 1L9.5 4H5.5L7.5 1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                                            <path d="M7.5 14L5.5 11H9.5L7.5 14Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                                            <path d="M3.5 7.5H11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                        </svg>
                                    </button>

                                    <div className="ul-divider" />

                                    {/* Suspend / Unban */}
                                    <button
                                        className={`ul-btn ${isBanned ? "btn-unban" : "btn-warn"}`}
                                        title={isBanned ? "ปลด Ban" : "Suspend"}
                                        onClick={() => handleBanToggle(u)}
                                    >
                                        {isBanned ? (
                                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                                <path d="M3 7.5L6 10.5L12 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        ) : (
                                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                                <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                                                <path d="M4.5 4.5L10.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                            </svg>
                                        )}
                                    </button>

                                    {/* ลบ */}
                                    <button
                                        className="ul-btn btn-danger"
                                        title="ลบ User"
                                        onClick={() => handleDelete(u)}
                                    >
                                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                            <path d="M3 4H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                            <path d="M6 4V2.5H9V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M5 4L5.5 12H9.5L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Profile Modal */}
            <ProfileModal
                user={profileUser}
                open={!!profileUser}
                onClose={() => setProfileUser(null)}
                apiBase={apiBase}
                token={user.token}
            />

            {/* Confirm Modal */}
            {confirmModal && (
                <ConfirmModal
                    open={true}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmLabel={confirmModal.confirmLabel}
                    confirmClass={confirmModal.confirmClass}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}

            {/* Toast */}
            {toastMsg && (
                <div className={`ul-toast ${toastMsg.type === "error" ? "toast-error" : toastMsg.type === "warn" ? "toast-warn" : ""}`}>
                    {toastMsg.msg}
                </div>
            )}
        </>
    );
}