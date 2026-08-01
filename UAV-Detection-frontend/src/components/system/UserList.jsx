import { useState, useEffect, useMemo } from "react"
import { Loader2, ChevronDown, UserPlus, Copy, CopyCheck } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { useWebSocket } from "../../context/useWebSocket";
import { API_BASE_URL } from "../../config/api";
import { createUser, deleteUser, getAllUsers, changeUserRole } from "../../services/systemUserApi";

const PAGE_SIZE = 15;

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

function ProfileModal({ user: targetUser, open, onClose, apiBase }) {
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

function AddUserModal({ open, onClose, onCreated, token }) {
    const [username, setUsername] = useState("");
    const [role, setRole] = useState("user");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    useEffect(() => {
        if (open) {
            setUsername("");
            setRole("user");
            setFormError("");
        }
    }, [open]);

    if (!open) return null;

    const handleSubmit = async () => {
        if (!username.trim()) {
            setFormError("กรุณาระบุชื่อผู้ใช้");
            return;
        }
        setSubmitting(true);
        setFormError("");
        try {
            const result = await createUser(username.trim(), role, token);
            if (result.success) {
                onCreated(result.data);
            } else {
                setFormError(result.message || "สร้างผู้ใช้ไม่สำเร็จ");
            }
        } catch (error) {
            setFormError("เกิดข้อผิดพลาดในการเชื่อมต่อ: " + (error.message || ""));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className={`modal-box add-user-modal ${formError ? "add-user-modal-error" : ""}`} onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose} aria-label="ปิด">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>
                <h3 className="modal-title">เพิ่มผู้ใช้ใหม่</h3>

                <div className="mt-4 space-y-4 text-left">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">ชื่อผู้ใช้ <span className="add-user-required">*</span></label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => {
                                setUsername(e.target.value);
                                if (formError) setFormError("");
                            }}
                            placeholder="เช่น operator1"
                            className={`w-full px-3 py-2 rounded-lg bg-slate-800 border text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 ${formError && !username.trim() ? "add-user-input-invalid border-rose-400" : "border-slate-700"}`}
                            aria-invalid={Boolean(formError && !username.trim())}
                            required
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                        >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <p className="text-[11px] text-slate-500">
                        ระบบจะสุ่มรหัสผ่านชั่วคราวให้อัตโนมัติ และแสดงให้คัดลอกเพียงครั้งเดียวหลังสร้างเสร็จ
                    </p>
                    {formError && (
                        <div className="mb-4">
                            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2 mb-4">{formError}</p>
                        </div>
                    )}
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={onClose} disabled={submitting}>ยกเลิก</button>
                    <button className="btn-confirm confirm" onClick={handleSubmit} disabled={submitting}>
                        {submitting ? "กำลังสร้าง..." : "สร้างผู้ใช้"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function TempPasswordModal({ result, onClose }) {
    const [copied, setCopied] = useState(false);
    if (!result) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(result.tempPassword);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {}
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <h3 className="modal-title">สร้างผู้ใช้ "{result.username}" สำเร็จ</h3>
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2 mt-3">
                    รหัสผ่านนี้จะแสดง "ครั้งเดียว" เท่านั้น กรุณาคัดลอกและส่งให้ผู้ใช้ทันที ระบบจะไม่สามารถเรียกดูรหัสผ่านนี้ได้อีกในภายหลัง
                </p>
                <div className="my-4 flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-emerald-400 font-mono tracking-wide select-all">
                        {result.tempPassword}
                    </code>
                    <button
                        onClick={handleCopy}
                        className="px-3 py-2 rounded-lg bg-slate-400/10 hover:bg-slate-400/20 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                        title={copied ? "คัดลอกแล้ว" : "คัดลอกไปยังคลิปบอร์ด"}
                    >
                        {copied ? <CopyCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                </div>
                <div className="modal-actions">
                    <button className="btn-confirm confirm" onClick={onClose}>เสร็จสิ้น</button>
                </div>
            </div>
        </div>
    );
}

export default function UserList({ search, setSearch, roleFilter, setRoleFilter, onStatsUpdate }) {
    const { user } = useAuth();
    const { systemEvent } = useWebSocket();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [profileUser, setProfileUser] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);
    const [toastMsg, setToastMsg] = useState(null);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [addUserModal, setAddUserModal] = useState(false);
    const [newUserResult, setNewUserResult] = useState(null);

    const apiBase = API_BASE_URL;

    const showToast = (msg, type = "success") => {
        setToastMsg({ msg, type });
        setTimeout(() => setToastMsg(null), 3000);
    };

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const result = await getAllUsers(user.token);
                if (result.success) setUsers(result.data);
                else setError("ไม่สามารถโหลดข้อมูลได้");
            } catch {
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
        if (!user?.token || !systemEvent) return;
        const shouldRefresh = ["role_changed", "user_deleted", "permission_changed", "camera_changed"].includes(systemEvent.event);
        if (shouldRefresh) {
            setLoading(true);
            getAllUsers(user.token)
                .then(result => {
                    if (result.success) setUsers(result.data);
                })
                .catch(() => setError("เกิดข้อผิดพลาดในการเชื่อมต่อ"))
                .finally(() => setLoading(false));
        }
    }, [systemEvent, user?.token]);

    const filtered = useMemo(() => {
        return users.filter(u => {
            const matchSearch = u.username.toLowerCase().includes(search.toLowerCase());
            const matchRole = roleFilter === "all" || u.role === roleFilter;
            return matchSearch && matchRole;
        });
    }, [users, search, roleFilter]);

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [search, roleFilter, users.length]);

    const visibleUsers = filtered.filter(u => !u.deleted).slice(0, visibleCount);
    const hasMoreUsers = filtered.filter(u => !u.deleted).length > visibleCount;

    const stats = useMemo(() => ({
        total: users.filter(u => u.deleted !== 1).length,
        admin: users.filter(u => u.role === "admin").length,
        banned: users.filter(u => u.role === "banned" && u.deleted !== 1).length,
    }), [users]);

    useEffect(() => {
        onStatsUpdate(stats)
    }, [stats, onStatsUpdate])

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
                    const result = await changeUserRole(targetUser.user_id, newRole, user.token);
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
                    const result = await changeUserRole(targetUser.user_id, newRole, user.token);
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
                    const result = await deleteUser(targetUser.user_id, user.token);
                    if (result === null || result?.success) {
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

    const handleUserCreated = (data) => {
        setUsers(prev => [...prev, {
            user_id: data.user_id,
            username: data.username,
            role: data.role,
            profile_image: null,
            deleted: 0,
            created_at: new Date().toISOString(),
        }]);
        setAddUserModal(false);
        setNewUserResult(data);
    };

    if (loading) {
        return (
            <div className="ul-loading flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
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

                <div>
                    {user?.role === "admin" && (
                        <div className="flex items-center justify-between mb-5">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                ผู้ใช้งานทั้งหมด ({stats.total})
                            </span>
                            <button
                                onClick={() => setAddUserModal(true)}
                                className="add-btn"
                            >
                                <UserPlus size={14} /> เพิ่มผู้ใช้
                            </button>
                        </div>
                    )}
                </div>

                {/* User list */}
                {users.filter(u => !u.deleted).length === 0 ? (
                    <div className="ul-empty">ยังไม่มีผู้ใช้ในระบบ</div>
                ) : filtered.length === 0 ? (
                    <div className="ul-empty">ไม่พบผู้ใช้ที่ตรงกับการค้นหา</div>
                ) : (
                    visibleUsers.map((u) => {
                        const imgPath = u.profile_image
                            ? `${apiBase}/uploads/user_profile/${u.profile_image}`
                            : null;
                        const avatarStyle = getAvatarColor(u.role);
                        const isBanned = u.role === "banned";
                        const isSelf = String(u.user_id) === String(user?.user_id);
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
                                    <div className="ul-username">
                                        {u.username}
                                        {isSelf && (
                                            <span className="ml-2 text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded px-1.5 py-0.5 align-middle">
                                                คุณ
                                            </span>
                                        )}
                                    </div>
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
                                        title={isSelf ? "ไม่สามารถเปลี่ยน Role ของตัวเองได้" : (u.role === "admin" ? "เปลี่ยนเป็น User" : "เปลี่ยนเป็น Admin")}
                                        onClick={() => handleChangeRole(u)}
                                        disabled={isBanned || isSelf}
                                        style={(isBanned || isSelf) ? { opacity: 0.3, cursor: "not-allowed" } : {}}
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
                                        title={isSelf ? "ไม่สามารถ Suspend ตัวเองได้" : (isBanned ? "ปลด Ban" : "Suspend")}
                                        onClick={() => handleBanToggle(u)}
                                        disabled={isSelf}
                                        style={isSelf ? { opacity: 0.3, cursor: "not-allowed" } : {}}
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
                                        title={isSelf ? "ไม่สามารถลบบัญชีตัวเองได้" : "ลบ User"}
                                        onClick={() => handleDelete(u)}
                                        disabled={isSelf}
                                        style={isSelf ? { opacity: 0.3, cursor: "not-allowed" } : {}}
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

                {filtered.length > 0 && (
                    <div className="flex flex-col items-center gap-1.5 pt-2">
                        {hasMoreUsers && (
                            <button
                                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-slate-700 rounded-lg px-3 py-1.5 transition-colors"
                            >
                                <ChevronDown size={13} />
                                โหลดเพิ่มเติม
                            </button>
                        )}
                        <span className="text-[10px] text-slate-600">
                            แสดง {visibleUsers.length} จาก {filtered.filter(u => u.deleted !== 1).length} รายการ
                        </span>
                    </div>
                )}
            </div>

            {/* Profile Modal */}
            <ProfileModal
                user={profileUser}
                open={!!profileUser}
                onClose={() => setProfileUser(null)}
                apiBase={apiBase}
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

            {/* Add User Modal */}
            <AddUserModal
                open={addUserModal}
                onClose={() => setAddUserModal(false)}
                onCreated={handleUserCreated}
                token={user.token}
            />

            <TempPasswordModal
                result={newUserResult}
                onClose={() => setNewUserResult(null)}
            />

            {/* Toast */}
            {toastMsg && (
                <div className={`ul-toast ${toastMsg.type === "error" ? "toast-error" : toastMsg.type === "warn" ? "toast-warn" : ""}`}>
                    {toastMsg.msg}
                </div>
            )}
        </>
    );
}