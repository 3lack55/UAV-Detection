import { useEffect, useState, useMemo, useCallback } from "react";
import { Camera, Plus, Pencil, Users, X, MapPin, Loader2, ChevronDown, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebsocketContext";

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

const PAGE_SIZE = 15;
// Names that mean "this camera hasn't been properly configured yet"
const INCOMPLETE_NAME_VALUES = ["", "unknow", "unknown", "ยังไม่ตั้งชื่อ"];
const isIncompleteName = (name) => INCOMPLETE_NAME_VALUES.includes(String(name || "").trim().toLowerCase());

const PERMISSION_BADGE = {
    admin: { label: "admin", className: "badge-admin" },
    operator: { label: "operator", className: "badge-operator" },
    viewer: { label: "viewer", className: "badge-viewer" },
    unassigned: { label: "unassigned", className: "badge-unassigned" },
};

const EMPTY_FORM = {
    camera_id: null,
    camera_name: "",
    latitude: "",
    longitude: "",
    status: "active",
};

function CameraFormModal({ open, initial, onClose, onSave }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const isEdit = !!initial?.camera_id;

    useEffect(() => {
        if (open) {
            setForm(initial ? { ...initial } : EMPTY_FORM);
        }
    }, [open, initial]);

    if (!open) return null;

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = () => {
        onSave(form, isEdit);
    };

    return (
        <div className="cl-modal-overlay" onClick={onClose}>
            <div className="cl-modal-box" onClick={e => e.stopPropagation()}>
                <button className="cl-modal-close" onClick={onClose} aria-label="ปิด">
                    <X size={16} />
                </button>
                <h3 className="cl-modal-title">{isEdit ? "แก้ไขข้อมูลกล้อง" : "เพิ่มกล้องใหม่"}</h3>

                <div className="cl-form-group">
                    <label className="cl-label">ชื่อกล้อง / ตำแหน่งที่ติดตั้ง</label>
                    <input
                        type="text"
                        className="cl-input"
                        value={form.camera_name}
                        onChange={e => handleChange("camera_name", e.target.value)}
                        placeholder="เช่น สนามกีฬากลาง มทร."
                    />
                </div>

                <div className="cl-form-row">
                    <div className="cl-form-group">
                        <label className="cl-label">Latitude</label>
                        <input
                            type="text"
                            className="cl-input"
                            value={form.latitude}
                            onChange={e => handleChange("latitude", e.target.value)}
                            placeholder="14.98460000"
                        />
                    </div>
                    <div className="cl-form-group">
                        <label className="cl-label">Longitude</label>
                        <input
                            type="text"
                            className="cl-input"
                            value={form.longitude}
                            onChange={e => handleChange("longitude", e.target.value)}
                            placeholder="102.11890000"
                        />
                    </div>
                </div>

                <div className="cl-form-group">
                    <label className="cl-label">สถานะ</label>
                    <div className="cl-status-toggle">
                        <button
                            type="button"
                            className={`cl-status-btn ${form.status === "active" ? "is-active" : ""}`}
                            onClick={() => handleChange("status", "active")}
                        >
                            <span className="cl-status-dot dot-active" /> Active
                        </button>
                        <button
                            type="button"
                            className={`cl-status-btn ${form.status === "maintenance" ? "is-active" : ""}`}
                            onClick={() => handleChange("status", "maintenance")}
                        >
                            <span className="cl-status-dot dot-maintenance" /> Maintenance
                        </button>
                        <button
                            type="button"
                            className={`cl-status-btn ${form.status === "inactive" ? "is-active" : ""}`}
                            onClick={() => handleChange("status", "inactive")}
                        >
                            <span className="cl-status-dot dot-inactive" /> Inactive
                        </button>
                    </div>
                </div>

                <div className="cl-modal-actions">
                    <button className="cl-btn-cancel" onClick={onClose}>ยกเลิก</button>
                    <button
                        className="cl-btn-save"
                        onClick={handleSubmit}
                        disabled={!form.camera_name.trim()}
                    >
                        {isEdit ? "บันทึกการแก้ไข" : "เพิ่มกล้อง"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function AssignModal({ open, camera, users, onClose, onAssign, allPermissions }) {
    const [selectedUser, setSelectedUser] = useState("");
    const [permission, setPermission] = useState("viewer");

    useEffect(() => {
        if (open) {
            setSelectedUser("");
            setPermission("viewer");
        }
    }, [open]);

    if (!open || !camera) return null;

    const handleSubmit = () => {
        if (!selectedUser) return;
        onAssign(camera.camera_id, selectedUser, permission);
    };

    const getUserPermissionForCamera = (userId) => {
        const perm = allPermissions.find(
            p => p.user_id === userId && p.camera_id === camera.camera_id
        );
        return perm?.permission_level || null;
    };

    return (
        <div className="cl-modal-overlay" onClick={onClose}>
            <div className="cl-modal-box" onClick={e => e.stopPropagation()}>
                <button className="cl-modal-close" onClick={onClose} aria-label="ปิด">
                    <X size={16} />
                </button>
                <h3 className="cl-modal-title">Assign กล้อง</h3>
                <p className="cl-modal-subtitle">{camera.camera_name} <span className="cl-uid">#{camera.camera_id}</span></p>

                <div className="cl-form-group">
                    <label className="cl-label">ผู้ใช้งาน</label>
                    <div className="border rounded-md mb-2 max-h-56 overflow-y-auto min-h-[120px] custom-scrollbar border-slate-700/50">
                        {users.filter(u => u.deleted !== 1).map(u => {
                            const currentPermission = getUserPermissionForCamera(u.user_id);
                            return (
                                <div
                                    key={u.user_id}
                                    className="py-2 px-3 border-b border-slate-600/50 hover:bg-slate-700/30 flex items-center justify-between gap-2 text-sm"
                                    onClick={(() => setSelectedUser(u.user_id))}
                                >
                                    <div>
                                        <h2 className="mb-1">{u.username}</h2>
                                        <p className="text-slate-400">(User ID: {u.user_id})</p>
                                    </div>
                                    <div>
                                        {currentPermission ? (
                                            <span className={`badge badge-${currentPermission}`}>
                                                {PERMISSION_BADGE[currentPermission].label}
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 text-xs font-medium">ยังไม่กำหนด</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                        }
                    </div>
                    <select
                        className="cl-input"
                        value={selectedUser}
                        onChange={e => setSelectedUser(e.target.value)}
                    >
                        <option value="">เลือกผู้ใช้...</option>
                        {
                            users.filter(u => u.deleted !== 1).map(u => {
                                const currentPermission = getUserPermissionForCamera(u.user_id);
                                const permissionText = currentPermission
                                    ? ` - ${PERMISSION_BADGE[currentPermission].label}`
                                    : " - ยังไม่กำหนด";
                                return (
                                    <option key={u.user_id} value={u.user_id}>
                                        {u.username} (#{u.user_id}){permissionText}
                                    </option>
                                );
                            })
                        }
                    </select>
                </div>

                <div className="cl-form-group">
                    <label className="cl-label">Permission Level</label>
                    <div className="flex gap-2 flex-wrap">
                        {Object.entries(PERMISSION_BADGE).map(([key, val]) => (
                            <button
                                key={key}
                                type="button"
                                className={`cl-permission-btn ${permission === key ? "is-active" : ""}`}
                                onClick={() => setPermission(key)}
                            >
                                <span className={`badge ${val.className}`}>{val.label}</span>
                            </button>
                        ))}
                    </div>
                    <p className="cl-permission-hint">
                        {permission === "admin" && "ดดูสตรีม และแย่งการควบคุมกล้องจากผู้ที่กำลังควบคุมอยู่ได้"}
                        {permission === "operator" && "ดูสตรีม และควบคุมกล้องได้"}
                        {permission === "viewer" && "ดูสตรีมจากกล้องได้เท่านั้น"}
                        {permission === "unassigned" && "ยังไม่กำหนดสิทธิ์สำหรับผู้ใช้คนนี้"}
                    </p>
                </div>

                <div className="cl-modal-actions">
                    <button className="cl-btn-cancel" onClick={onClose}>ยกเลิก</button>
                    <button
                        className="cl-btn-save"
                        onClick={handleSubmit}
                        disabled={!selectedUser}
                    >
                        Assign
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function CameraList({ search = "", setSearch = () => { }, statusFilter = "all", setStatusFilter = () => { }, onStatsUpdate = () => { } }) {
    const { user } = useAuth();
    const { systemEvent } = useWebSocket();
    const [cameras, setCameras] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [formModal, setFormModal] = useState(null);
    const [assignModal, setAssignModal] = useState(null);
    const [toastMsg, setToastMsg] = useState(null);
    const [allPermissions, setAllPermissions] = useState([]);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const apiBase = `${PROTOCOL}://${HOST}:${HOST_PORT}`;
    const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user?.token}`,
    };

    const showToast = (msg, type = "success") => {
        setToastMsg({ msg, type });
        setTimeout(() => setToastMsg(null), 3000);
    };

    const fetchPermissions = useCallback(async () => {
        try {
            const respond = await fetch(`${PROTOCOL}://${HOST}:${HOST_PORT}/api/camera/getAllPermissions`, {
                headers: authHeaders,
            });
            const permissions = await respond.json();
            setAllPermissions(permissions.data || []);
        } catch (err) {
            console.log("Error fetching camera permissions:", err);
        }
    }, [user?.token]);

    useEffect(() => {
        const fetchAllCamera = async () => {
            try {
                const respond = await fetch(`${apiBase}/api/camera/getAllCameras`);
                const data = await respond.json();
                if (data.success) {
                    setCameras(data.data);
                } else {
                    setError("ไม่สามารถโหลดข้อมูลกล้องได้");
                }
            } catch (err) {
                setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
            } finally {
                setLoading(false);
            }
        };

        const fetchAllUsers = async () => {
            try {
                const respond = await fetch(`${apiBase}/api/systemControl/allUsers`, {
                    headers: authHeaders,
                });
                const data = await respond.json();
                if (data.success) setAllUsers(data.data);
            } catch (err) {
            }
        };

        fetchAllCamera();
        fetchAllUsers();
        fetchPermissions();
    }, [user?.token]);

    useEffect(() => {
        if (!systemEvent) return;
        const shouldRefresh = ["camera_changed", "permission_changed"].includes(systemEvent.event);
        if (!shouldRefresh) return;

        setLoading(true);
        fetch(`${apiBase}/api/camera/getAllCameras`)
            .then(res => res.json())
            .then(data => {
                if (data.success) setCameras(data.data);
            })
            .catch(() => setError("เกิดข้อผิดพลาดในการเชื่อมต่อ"))
            .finally(() => setLoading(false));

        if (user?.token) {
            fetch(`${apiBase}/api/systemControl/allUsers`, {
                headers: authHeaders,
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) setAllUsers(data.data);
                })
                .catch(() => { });
        }

        fetchPermissions();
    }, [systemEvent]);

    useEffect(() => {
        if (!assignModal) return;
        fetchPermissions();
    }, [assignModal]);

    // --- Add / Edit ---
    const handleSaveCamera = async (form, isEdit) => {
        const payload = {
            camera_name: form.camera_name,
            latitude: form.latitude,
            longitude: form.longitude,
            status: form.status,
        };

        try {
            const url = isEdit
                ? `${apiBase}/api/camera/updateCamera/${form.camera_id}`
                : `${apiBase}/api/camera/addCamera`;
            const res = await fetch(url, {
                method: isEdit ? "PATCH" : "POST",
                headers: authHeaders,
                body: JSON.stringify(payload),
            });
            const result = await res.json();

            if (result.success) {
                if (isEdit) {
                    setCameras(prev => prev.map(c => c.camera_id === form.camera_id ? { ...c, ...payload } : c));
                    showToast(`บันทึกการแก้ไข "${form.camera_name}" แล้ว`);
                } else {
                    const newCam = result.data || { ...payload, camera_id: Date.now() };
                    setCameras(prev => [...prev, newCam]);
                    showToast(`เพิ่มกล้อง "${form.camera_name}" แล้ว`);
                }
                setFormModal(null);
            } else {
                showToast(isEdit ? "แก้ไขไม่สำเร็จ" : "เพิ่มกล้องไม่สำเร็จ", "error");
            }
        } catch (err) {
            showToast("เกิดข้อผิดพลาด", "error");
        }
    };

    // --- Assign ---
    const handleAssign = async (cameraId, userId, permission) => {
        try {
            const res = await fetch(`${apiBase}/api/camera/assignCamera`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ camera_id: cameraId, user_id: userId, permission_level: permission }),
            });
            const result = await res.json();
            if (result.success) {
                const u = allUsers.find(u => String(u.user_id) === String(userId));
                showToast(`Assign "${u?.username || "ผู้ใช้"}" เป็น ${PERMISSION_BADGE[permission].label} แล้ว`);
                setAssignModal(null);
                fetchPermissions();
            } else {
                showToast("Assign ไม่สำเร็จ", "error");
            }
        } catch (err) {
            showToast("เกิดข้อผิดพลาด", "error");
        }
    };

    const filteredCameras = useMemo(() => {
        return cameras.filter(cam => {
            const matchSearch = (cam.camera_name || "").toLowerCase().includes(search.toLowerCase());
            const matchStatus = statusFilter === "all" || cam.status === statusFilter;
            return matchSearch && matchStatus;
        });
    }, [cameras, search, statusFilter]);

    const stats = useMemo(() => ({
        total: cameras.length,
        active: cameras.filter(c => c.status === "active").length,
        maintenance: cameras.filter(c => c.status === "maintenance").length,
    }), [cameras]);

    useEffect(() => {
        onStatsUpdate(stats);
    }, [stats]);

    // Reset to the first page whenever search/filter/data changes
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [search, statusFilter, cameras.length]);

    const visibleCameras = filteredCameras.slice(0, visibleCount);
    const hasMoreCameras = filteredCameras.length > visibleCount;

    const getAssignedCount = (cameraId) => {
        return allPermissions.filter(p => {
            const user = allUsers.find(u => u.user_id === p.user_id);

            return (
                p.camera_id === cameraId &&
                p.permission_level &&
                p.permission_level !== "unassigned" &&
                user && user.deleted !== 1
            );
        }).length;
    };

    if (loading) {
        return (
            <div className="cl-loading flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                <p>กำลังโหลด...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="cl-loading">
                <p className="cl-error">{error}</p>
            </div>
        );
    }

    return (
        <>
            <div className="cl-wrap">
                {/* Mobile-only stats + search + filter (desktop shows the equivalent in the page header) */}
                <div className="lg:hidden">
                    <div className="ul-stats">
                        <div className="ul-stat">
                            <div className="ul-stat-label">ทั้งหมด</div>
                            <div className="ul-stat-val">{stats.total}</div>
                        </div>
                        <div className="ul-stat">
                            <div className="ul-stat-label">Active</div>
                            <div className="ul-stat-val">{stats.active}</div>
                        </div>
                        <div className="ul-stat">
                            <div className="ul-stat-label">Maintenance</div>
                            <div className="ul-stat-val">{stats.maintenance}</div>
                        </div>
                    </div>

                    <div className="ul-toolbar">
                        <div className="ul-search">
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                                <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อกล้อง..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <select
                            className="ul-filter"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="all">ทุกสถานะ</option>
                            <option value="active">Active</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                <div className="cl-header">
                    <span className="cl-header-title">กล้องทั้งหมด ({cameras.length})</span>
                    <button className="cl-add-btn" onClick={() => setFormModal({ initial: null })}>
                        <Plus size={16} /> เพิ่มกล้อง
                    </button>
                </div>

                {cameras.length === 0 ? (
                    <div className="cl-empty">ยังไม่มีกล้องในระบบ</div>
                ) : filteredCameras.length === 0 ? (
                    <div className="cl-empty">ไม่พบกล้องที่ตรงกับการค้นหา</div>
                ) : (
                    <div className="cl-list">
                        {visibleCameras.map((cam) => {
                            const incompleteName = isIncompleteName(cam.camera_name);
                            const assignedCount = getAssignedCount(cam.camera_id);
                            return (
                                <div className="cl-card" key={cam.camera_id}>
                                    <div className="cl-icon-wrap">
                                        <Camera className="cl-cam-icon" />
                                        <span className={`cl-status-pip pip-${cam.status}`} />
                                    </div>

                                    <div className="cl-info">
                                        <h2 className="cl-name flex items-center gap-2 flex-wrap">
                                            {incompleteName ? "ยังไม่ตั้งชื่อ" : cam.camera_name}
                                            {incompleteName && (
                                                <span
                                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-500/30 rounded px-1.5 py-0.5"
                                                    title="กล้องนี้ยังตั้งค่าไม่ครบ กรุณากดแก้ไขข้อมูลเพื่อตั้งชื่อ"
                                                >
                                                    <AlertTriangle size={10} /> ต้องตั้งค่า
                                                </span>
                                            )}
                                        </h2>
                                        <div className="cl-meta">
                                            <span className="cl-uid">#{cam.camera_id}</span>
                                            <span className="cl-coords">
                                                <MapPin size={11} />
                                                {parseFloat(cam.latitude).toFixed(2)}, {parseFloat(cam.longitude).toFixed(2)}
                                            </span>
                                            <span className={`cl-status-text status-${cam.status}`}>
                                                {cam.status === "active" ? "Active" : cam.status === "maintenance" ? "Maintenance" : "Inactive"}
                                            </span>
                                            {assignedCount > 0 && (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                                    <Users size={10} /> {assignedCount} ผู้ใช้
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="cl-actions">
                                        <button
                                            className="cl-btn"
                                            title="Assign ผู้ใช้"
                                            onClick={() => setAssignModal(cam)}
                                        >
                                            <Users size={16} />
                                        </button>
                                        <button
                                            className="cl-btn"
                                            title="แก้ไขข้อมูล"
                                            onClick={() => setFormModal({ initial: cam })}
                                        >
                                            <Pencil size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {filteredCameras.length > 0 && (
                    <div className="flex flex-col items-center gap-1.5 pt-3">
                        {hasMoreCameras && (
                            <button
                                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-slate-700 rounded-lg px-3 py-1.5 transition-colors"
                            >
                                <ChevronDown size={13} />
                                โหลดเพิ่มเติม
                            </button>
                        )}
                        <span className="text-[10px] text-slate-600">
                            แสดง {visibleCameras.length} จาก {filteredCameras.length} รายการ
                        </span>
                    </div>
                )}
            </div>

            <CameraFormModal
                open={!!formModal}
                initial={formModal?.initial}
                onClose={() => setFormModal(null)}
                onSave={handleSaveCamera}
            />

            <AssignModal
                open={!!assignModal}
                camera={assignModal}
                users={allUsers}
                onClose={() => setAssignModal(null)}
                onAssign={handleAssign}
                allPermissions={allPermissions}
            />

            {toastMsg && (
                <div className={`cl-toast ${toastMsg.type === "error" ? "toast-error" : ""}`}>
                    {toastMsg.msg}
                </div>
            )}
        </>
    );
}