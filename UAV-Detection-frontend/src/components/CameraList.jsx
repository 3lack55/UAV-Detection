import { useEffect, useState } from "react";
import { Camera, Plus, Pencil, Users, X, MapPin } from "lucide-react";
import { useAuth } from "../context/AuthContext";

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
    }, []);

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
            <style>{`
                .cl-wrap { width: 100%; display: flex; flex-direction: column; font-family: inherit; }

                .cl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
                .cl-header-title { font-size: 13px; color: #64748b; font-family: ui-monospace, monospace; letter-spacing: 0.04em; }
                .cl-add-btn { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 8px; border: 0.5px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #f1f5f9; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s; }
                .cl-add-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); }

                .cl-list { display: flex; flex-direction: column; gap: 8px; }
                .cl-card { border: 0.5px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 16px; display: flex; width: 100%; align-items: center; gap: 16px; background: rgba(255,255,255,0.03); transition: border-color 0.15s, background 0.15s; }
                .cl-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.15); }
                .cl-icon-wrap { position: relative; flex-shrink: 0; }
                .cl-cam-icon { width: 56px; height: 56px; color: #475569; }
                .cl-status-pip { position: absolute; bottom: 2px; right: 2px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #1a1f2e; }
                .pip-active { background: #34d399; }
                .pip-maintenance { background: #fbbf24; }
                .pip-inactive { background: #64748b; }

                .cl-info { flex-grow: 1; min-width: 0; }
                .cl-name { margin-bottom: 4px; color: #f1f5f9; font-weight: 500; font-size: 15px; }
                .cl-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
                .cl-uid { color: #475569; font-family: ui-monospace, monospace; font-size: 12px; }
                .cl-coords { display: flex; align-items: center; gap: 4px; color: #475569; font-family: ui-monospace, monospace; font-size: 11px; }
                .cl-status-text { font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 500; }
                .status-active { background: #064e3b; color: #6ee7b7; }
                .status-maintenance { background: #78350f; color: #fde68a; }
                .status-inactive { background: rgba(255,255,255,0.06); color: #64748b; }

                .cl-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
                .cl-btn { width: 36px; height: 36px; border-radius: 8px; border: 0.5px solid rgba(255,255,255,0.08); background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: all 0.15s; }
                .cl-btn:hover { border-color: rgba(255,255,255,0.2); color: #f1f5f9; background: rgba(255,255,255,0.07); }

                .cl-empty { text-align: center; padding: 2.5rem 0; color: #475569; font-size: 14px; }
                .cl-loading { padding: 2rem; display: flex; justify-content: center; }
                .cl-loading p { font-size: 14px; color: #64748b; font-family: ui-monospace, monospace; }
                .cl-error { color: #f87171; }

                /* Modal */
                .cl-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1rem; }
                .cl-modal-box { background: #1e2433; border: 0.5px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 24px; width: 100%; max-width: 450px; position: relative; }
                .cl-modal-title { font-size: 16px; font-weight: 500; color: #f1f5f9; margin-bottom: 4px; }
                .cl-modal-subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 18px; }
                .cl-modal-close { position: absolute; top: 14px; right: 14px; width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color 0.15s; }
                .cl-modal-close:hover { color: #f1f5f9; }

                .cl-form-group { margin-bottom: 16px; }
                .cl-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
                .cl-form-row .cl-form-group { margin-bottom: 0; }
                .cl-label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
                .cl-input { width: 100%; height: 38px; border-radius: 8px; border: 0.5px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #f1f5f9; font-size: 14px; padding: 0 12px; outline: none; font-family: inherit; transition: border-color 0.15s; }
                .cl-input:focus { border-color: rgba(255,255,255,0.3); }
                .cl-input::placeholder { color: #475569; }

                .cl-status-toggle { display: flex; gap: 8px; }
                .cl-status-btn { flex: 1; height: 38px; border-radius: 8px; border: 0.5px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.02); color: #94a3b8; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: inherit; transition: all 0.15s; }
                .cl-status-btn.is-active { border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.08); color: #f1f5f9; }
                .cl-status-dot { width: 8px; height: 8px; border-radius: 50%; }
                .dot-active { background: #34d399; }
                .dot-maintenance { background: #fbbf24; }
                .dot-inactive { background: #64748b; }

                .cl-permission-btn { flex: 1; height: 44px; border-radius: 8px; border: 0.5px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; padding: 0 12px; }
                .cl-permission-btn.is-active { border-color: rgba(255,255,255,0.35); background: rgba(255,255,255,0.08); }
                .cl-permission-hint { font-size: 12px; color: #475569; margin-top: 8px; line-height: 1.5; }

                .badge { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 999px; letter-spacing: 0.02em; }
                .badge-admin { background: #EEEDFE; color: #3C3489; }
                .badge-operator { background: #FAEEDA; color: #633806; }
                .badge-viewer { background: #E1F0FB; color: #0C4A6E; }
                .badge-unassigned { background: rgba(255,255,255,0.06); color: #64748b; }

                .cl-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
                .cl-btn-cancel { height: 36px; padding: 0 16px; border-radius: 8px; border: 0.5px solid rgba(255,255,255,0.12); background: transparent; color: #94a3b8; font-size: 14px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
                .cl-btn-cancel:hover { background: rgba(255,255,255,0.05); color: #f1f5f9; }
                .cl-btn-save { height: 36px; padding: 0 16px; border-radius: 8px; border: none; background: #2563eb; color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background 0.15s; }
                .cl-btn-save:hover { background: #1d4ed8; }
                .cl-btn-save:disabled { background: rgba(255,255,255,0.06); color: #475569; cursor: not-allowed; }

                /* Toast */
                .cl-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #1e2433; border: 0.5px solid rgba(255,255,255,0.15); border-radius: 999px; padding: 10px 20px; font-size: 13px; color: #f1f5f9; z-index: 200; white-space: nowrap; box-shadow: 0 4px 20px rgba(0,0,0,0.3); animation: clFadeUp 0.2s ease; }
                .cl-toast.toast-error { border-color: rgba(239,68,68,0.3); color: #fca5a5; }
                @keyframes clFadeUp { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
            `}</style>

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