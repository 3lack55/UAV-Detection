import { useState, useEffect, useMemo } from "react"
import { useAuth } from "../context/AuthContext";

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
        fetchUsers();
    }, []);

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
            <style>{`
                .ul-wrap { width: 100%; display: flex; flex-direction: column; gap: 0; font-family: inherit; }

                /* User card */
                .ul-card { background: rgba(255,255,255,0.03); border: 0.5px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 16px; margin-bottom: 8px; display: flex; align-items: center; gap: 14px; transition: border-color 0.15s, background 0.15s; }
                .ul-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.15); }
                .ul-card.is-banned { opacity: 0.6; }
                .ul-avatar-img { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #3b82f6; flex-shrink: 0; }
                .ul-avatar { width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: 500; font-size: 14px; border: 2px solid rgba(255,255,255,0.1); }
                .ul-info { flex: 1; min-width: 0; }
                .ul-username { font-size: 15px; font-weight: 500; color: #f1f5f9; margin-bottom: 4px; }
                .ul-card.is-banned .ul-username { text-decoration: line-through; color: #64748b; }
                .ul-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
                .ul-uid { font-size: 12px; color: #475569; font-family: ui-monospace, monospace; }
                .ul-date { font-size: 11px; color: #334155; }

                /* Badges */
                .badge { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 999px; letter-spacing: 0.02em; }
                .badge-admin { background: #EEEDFE; color: #3C3489; }
                .badge-user { background: #E1F5EE; color: #085041; }
                .badge-banned { background: #FCEBEB; color: #791F1F; }

                /* Actions */
                .ul-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
                .ul-divider { width: 1px; height: 18px; background: rgba(255,255,255,0.08); margin: 0 2px; }
                .ul-btn { width: 32px; height: 32px; border-radius: 8px; border: 0.5px solid rgba(255,255,255,0.08); background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: all 0.15s; }
                .ul-btn:hover { border-color: rgba(255,255,255,0.2); color: #f1f5f9; background: rgba(255,255,255,0.07); }
                .ul-btn.btn-danger:hover { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.4); color: #f87171; }
                .ul-btn.btn-warn:hover { background: rgba(234,179,8,0.1); border-color: rgba(234,179,8,0.3); color: #fbbf24; }
                .ul-btn.btn-unban:hover { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); color: #34d399; }
                .ul-btn svg { pointer-events: none; }

                /* Empty */
                .ul-empty { text-align: center; padding: 2.5rem 0; color: #475569; font-size: 14px; }

                /* Loading */
                .ul-loading { padding: 2rem; display: flex; justify-content: center; }
                .ul-loading p { font-size: 14px; color: #64748b; font-family: ui-monospace, monospace; }
                .ul-error { color: #f87171; }

                /* Modal */
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1rem; }
                .modal-box { background: #1e2433; border: 0.5px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 24px; width: 100%; max-width: 360px; position: relative; }
                .modal-title { font-size: 16px; font-weight: 500; color: #f1f5f9; margin-bottom: 10px; }
                .modal-message { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 20px; }
                .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
                .btn-cancel { height: 36px; padding: 0 16px; border-radius: 8px; border: 0.5px solid rgba(255,255,255,0.12); background: transparent; color: #94a3b8; font-size: 14px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
                .btn-cancel:hover { background: rgba(255,255,255,0.05); color: #f1f5f9; }
                .btn-confirm { height: 36px; padding: 0 16px; border-radius: 8px; border: none; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s; }
                .confirm-danger { background: #7f1d1d; color: #fca5a5; }
                .confirm-danger:hover { background: #991b1b; }
                .confirm-warn { background: #78350f; color: #fde68a; }
                .confirm-warn:hover { background: #92400e; }
                .confirm-info { background: #1e3a5f; color: #93c5fd; }
                .confirm-info:hover { background: #1e40af; }
                .confirm-success { background: #064e3b; color: #6ee7b7; }
                .confirm-success:hover { background: #065f46; }
                .modal-close-btn { position: absolute; top: 14px; right: 14px; width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color 0.15s; }
                .modal-close-btn:hover { color: #f1f5f9; }

                /* Profile modal */
                .profile-modal { max-width: 320px; }
                .profile-header { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
                .profile-avatar-img { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid #3b82f6; flex-shrink: 0; }
                .profile-avatar-placeholder { width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 500; flex-shrink: 0; }
                .profile-username { font-size: 16px; font-weight: 500; color: #f1f5f9; margin-bottom: 5px; }
                .profile-rows { border-top: 0.5px solid rgba(255,255,255,0.08); padding-top: 14px; display: flex; flex-direction: column; gap: 10px; }
                .profile-row { display: flex; justify-content: space-between; align-items: center; }
                .profile-row-label { font-size: 12px; color: #475569; }
                .profile-row-value { font-size: 13px; color: #94a3b8; font-family: ui-monospace, monospace; }

                /* Toast */
                .ul-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #1e2433; border: 0.5px solid rgba(255,255,255,0.15); border-radius: 999px; padding: 10px 20px; font-size: 13px; color: #f1f5f9; z-index: 200; white-space: nowrap; box-shadow: 0 4px 20px rgba(0,0,0,0.3); animation: fadeUp 0.2s ease; }
                .ul-toast.toast-error { border-color: rgba(239,68,68,0.3); color: #fca5a5; }
                .ul-toast.toast-warn { border-color: rgba(234,179,8,0.3); color: #fde68a; }
                @keyframes fadeUp { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
            `}</style>

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