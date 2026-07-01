import { useEffect, useState } from "react";
import { Camera, Plus, Pencil, Users, X, MapPin } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebsocketContext";

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

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

    console.log("All Permissions:", allPermissions);

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
                    <div className="border rounded-md mb-2 max-h-32 overflow-y-auto min-h-[183px] custom-scrollbar border-slate-700/50">
                        { users.filter(u => u.deleted !== 1).map(u => {
                            const currentPermission = getUserPermissionForCamera(u.user_id);
                            return (
                            <div key={u.user_id} className="py-2 px-3 border-b border-slate-600/50 hover:bg-slate-700/30 flex items-center justify-between gap-2 text-sm">
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
                        {permission === "admin" && "จัดการกล้องและสิทธิ์ของผู้ใช้อื่นได้เต็มสิทธิ์"}
                        {permission === "operator" && "ดูสตรีมและควบคุมกล้องได้ (ไม่รวมการตั้งค่า)"}
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

export default function CameraList() {
    const { user } = useAuth();
    const { realtimeEvent } = useWebSocket();
    const [cameras, setCameras] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [formModal, setFormModal] = useState(null); // { initial }
    const [assignModal, setAssignModal] = useState(null); // camera
    const [toastMsg, setToastMsg] = useState(null);
    const [allPermissions, setAllPermissions] = useState([]);

    const apiBase = `${PROTOCOL}://${HOST}:${HOST_PORT}`;
    const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user?.token}`,
    };

    const showToast = (msg, type = "success") => {
        setToastMsg({ msg, type });
        setTimeout(() => setToastMsg(null), 3000);
    };

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
                // ไม่ critical ถ้าโหลด user list ไม่ได้
            }
        };

        fetchAllCamera();
        fetchAllUsers();
    }, [user?.token]);

    useEffect(() => {
        if (!realtimeEvent) return;
        const shouldRefresh = ["camera_changed", "permission_changed"].includes(realtimeEvent.event);
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
                .catch(() => {});
        }
    }, [realtimeEvent]);

    useEffect(() => {
        if (!assignModal) return;

        const fetchPermission = async () => {
            try {
                const respond = await fetch(`${PROTOCOL}://${HOST}:${HOST_PORT}/api/camera/getAllPermissions`, {
                    headers: authHeaders,
                });
                const permissions = await respond.json();
                setAllPermissions(permissions.data || []);
            } catch (err) {
                console.log("Error fetching camera permissions:", err);
            }
        };
        fetchPermission();
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
            } else {
                showToast("Assign ไม่สำเร็จ", "error");
            }
        } catch (err) {
            showToast("เกิดข้อผิดพลาด", "error");
        }
    };

    if (loading) {
        return (
            <div className="cl-loading">
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
                <div className="cl-header">
                    <span className="cl-header-title">กล้องทั้งหมด ({cameras.length})</span>
                    <button className="cl-add-btn" onClick={() => setFormModal({ initial: null })}>
                        <Plus size={16} /> เพิ่มกล้อง
                    </button>
                </div>

                {cameras.length === 0 ? (
                    <div className="cl-empty">ยังไม่มีกล้องในระบบ</div>
                ) : (
                    <div className="cl-list">
                        {cameras.map((cam) => (
                            <div className="cl-card" key={cam.camera_id}>
                                <div className="cl-icon-wrap">
                                    <Camera className="cl-cam-icon" />
                                    <span className={`cl-status-pip pip-${cam.status}`} />
                                </div>

                                <div className="cl-info">
                                    <h2 className="cl-name">{cam.camera_name}</h2>
                                    <div className="cl-meta">
                                        <span className="cl-uid">#{cam.camera_id}</span>
                                        <span className="cl-coords">
                                            <MapPin size={11} />
                                            {cam.latitude}, {cam.longitude}
                                        </span>
                                        <span className={`cl-status-text status-${cam.status}`}>
                                            {cam.status === "active" ? "Active" : cam.status === "maintenance" ? "Maintenance" : "Inactive"}
                                        </span>
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
                        ))}
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