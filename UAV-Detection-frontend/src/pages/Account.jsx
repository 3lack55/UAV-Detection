import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock, Upload, Eye, EyeOff, Check, X, Loader, Edit2, Save, ShieldAlert, MoveLeft, ImageUp } from "lucide-react";

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

export default function Account() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("profile");
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    // Profile Form State
    const [profileForm, setProfileForm] = useState({
        username: ""
    });
    const [editingProfile, setEditingProfile] = useState(false);

    // Password Form State
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });

    // Profile Image State
    const [profileImage, setProfileImage] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    // Load user data
    useEffect(() => {
        if (!user) {
            navigate("/login");
            return;
        }
        setProfileForm({ username: user.username });
    }, [user, navigate]);

    // Clear messages after 5 seconds
    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage("");
                setErrorMessage("");
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, errorMessage]);

    // Handle profile update
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        if (profileForm.username.trim() === "") {
            setErrorMessage("ชื่อผู้ใช้ไม่สามารถว่างได้");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(
                `${PROTOCOL}://${HOST}:${HOST_PORT}/api/auth/user/${user.user_id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${user.token}`
                    },
                    body: JSON.stringify({
                        username: profileForm.username
                    })
                }
            );

            const data = await response.json();
            if (data.success) {
                setSuccessMessage("อัปเดตโปรไฟล์สำเร็จ");
                login(
                    user.token,
                    profileForm.username,
                    user.user_id,
                    user.role,
                    user.profile_image
                );
                setEditingProfile(false);
            } else {
                setErrorMessage(data.message || "เกิดข้อผิดพลาด");
            }
        } catch (error) {
            setErrorMessage("เกิดข้อผิดพลาด: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Handle password change
    const handleChangePassword = async (e) => {
        e.preventDefault();

        if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
            setErrorMessage("กรุณากรอกข้อมูลให้ครบถ้วน");
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setErrorMessage("รหัสผ่านใหม่ไม่ตรงกัน");
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            setErrorMessage("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(
                `${PROTOCOL}://${HOST}:${HOST_PORT}/api/auth/change-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${user.token}`
                    },
                    body: JSON.stringify({
                        currentPassword: passwordForm.currentPassword,
                        newPassword: passwordForm.newPassword
                    })
                }
            );

            const data = await response.json();
            if (data.success) {
                setSuccessMessage("เปลี่ยนรหัสผ่านสำเร็จ");
                setPasswordForm({
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: ""
                });
            } else {
                setErrorMessage(data.message || "เกิดข้อผิดพลาด");
            }
        } catch (error) {
            setErrorMessage("เกิดข้อผิดพลาด: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Handle profile image selection
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith("image/")) {
                setErrorMessage("กรุณาเลือกไฟล์รูปภาพ");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setErrorMessage("ขนาดรูปภาพต้องไม่เกิน 5MB");
                return;
            }
            setProfileImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle drag over
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
    };

    // Handle drag leave
    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    };

    // Handle drop
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (!file.type.startsWith("image/")) {
                setErrorMessage("กรุณาเลือกไฟล์รูปภาพ");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setErrorMessage("ขนาดรูปภาพต้องไม่เกิน 5MB");
                return;
            }
            setProfileImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle profile image upload
    const handleUploadImage = async (e) => {
        e.preventDefault();
        if (!profileImage) {
            setErrorMessage("กรุณาเลือกรูปภาพ");
            return;
        }

        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append("profileImage", profileImage);

            const response = await fetch(
                `${PROTOCOL}://${HOST}:${HOST_PORT}/api/auth/upload-profile-image`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${user.token}`
                    },
                    body: formData
                }
            );

            const data = await response.json();
            if (data.success) {
                setSuccessMessage("อัปโหลดรูปภาพสำเร็จ");
                login(
                    user.token,
                    user.username,
                    user.user_id,
                    user.role,
                    data.filename
                );
                setProfileImage(null);
                setPreviewImage(null);
            } else {
                setErrorMessage(data.message || "เกิดข้อผิดพลาด");
            }
        } catch (error) {
            setErrorMessage("เกิดข้อผิดพลาด: " + error.message);
        } finally {
            setUploadingImage(false);
        }
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                .parent-container {overflow-x: hidden;}
                .parent-container::-webkit-scrollbar { width: 0px; }
                .parent-container::-webkit-scrollbar-track { background: #0f172a; }
                .parent-container::-webkit-scrollbar-thumb { background: rgb(255 255 255 / 0.3); border-radius: 10px; }

                .custom-scrollbar::-webkit-scrollbar { height: 0px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
                
                .right-content-scroll::-webkit-scrollbar { width: 6px; }
                .right-content-scroll::-webkit-scrollbar-track { background: transparent; }
                .right-content-scroll::-webkit-scrollbar-thumb { background: rgb(148 163 184 / 0.5); border-radius: 10px; }
                .right-content-scroll::-webkit-scrollbar-thumb:hover { background: rgb(148 163 184 / 0.7); }
                `}}
            />

            <div className="min-h-full w-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-4 py-6 lg:h-screen lg:overflow-hidden lg:flex lg:flex-col">
                <div className="mb-6 ">
                    <div className="flex items-center mb-6 text-right gap-4 lg:text-left justify-between lg:justify-start">
                        <div>
                            <Link to="/">
                                <button className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg transition-colors duration-300 lg:hidden" title="กลับไปที่หน้าหลัก">
                                    <MoveLeft className="w-5 h-5" />
                                </button>
                            </Link>

                        </div>
                        <div>
                            <h1 className="text-5xl font-bold text-white mb-2">จัดการบัญชี</h1>
                            <p className="text-slate-400 text-lg">จัดการข้อมูลส่วนตัวและความปลอดภัยของบัญชี</p>
                        </div>
                    </div>
                </div>

                {/* Alert Messages - Enhanced */}
                {successMessage && (
                    <div
                        className="mb-6 p-4 bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border border-emerald-500/40 rounded-xl flex items-center gap-3 text-emerald-300 shadow-lg shadow-emerald-500/10 animate-in fade-in slide-in-from-top-4 duration-300">
                        <Check className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium">{successMessage}</span>
                    </div>
                )}
                {errorMessage && (
                    <div
                        className="mb-6 p-4 bg-gradient-to-r from-rose-500/20 to-rose-500/10 border border-rose-500/40 rounded-xl flex items-center gap-3 text-rose-300 shadow-lg shadow-rose-500/10 animate-in fade-in slide-in-from-top-4 duration-300">
                        <X className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium">{errorMessage}</span>
                    </div>
                )}

                <div className="flex flex-col lg:flex-grow lg:flex-row lg:gap-4 lg:min-h-0">
                    <div className="flex flex-col mb-6 lg:mb-0 lg:flex-shrink-0 lg:overflow-y-auto lg:max-h-full lg:border-r border-slate-700/50 lg:pr-4 lg:w-[320px]">
                        <div className="mb-10 bg-gradient-to-br from-slate-800 to-slate-800/50 rounded-2xl border border-slate-700/50 p-6 shadow-xl hover:shadow-2xl hover:border-slate-600/50 transition-all duration-300">
                            <div className="flex items-center gap-6">
                                <div className="relative">
                                    {user?.profile_image && user.profile_image !== "null" ? (
                                        <img src={`${PROTOCOL}://${HOST}:${HOST_PORT}/uploads/user_profile/${user.profile_image}`} alt="profile"
                                            className="w-24 h-24 rounded-full border-4 border-blue-500/50 object-cover shadow-lg" />
                                    ) : (
                                        <div
                                            className="w-24 h-24 rounded-full border-4 border-slate-600 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-lg">
                                            <User className="w-12 h-12 text-slate-500" />
                                        </div>
                                    )}
                                    <div
                                        className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 border-4 border-slate-800 rounded-full shadow-lg">
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-bold text-white mb-1">{user?.username}</h2>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className="text-slate-400">ID: {user?.user_id}</span>
                                        <span
                                            className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-sm font-semibold border border-blue-500/30 uppercase tracking-wide">
                                            {user?.role}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar Tabs */}
                        <div className="w-full border-b pb-2 border-slate-700 lg:border-b-0 lg:pb-0  lg:h-full">
                            <div className="lg:flex lg:flex-col lg:justify-between lg:h-full">
                                <div className="flex items-center flex-1 lg:flex-col gap-3 lg:gap-0">
                                    {[
                                        { id: "profile", label: "ข้อมูลโปรไฟล์", icon: User },
                                        { id: "password", label: "เปลี่ยนรหัสผ่าน", icon: Lock },
                                        { id: "image", label: "รูปโปรไฟล์", icon: ImageUp }
                                    ].map(tab => {
                                        const IconComponent = tab.icon;
                                        return (
                                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                                className={`flex justify-center lg:justify-start items-center gap-3 px-4 py-4 rounded-[4px] w-full lg:min-w-[160px] border-t-4 lg:border-t-0 transition-all duration-300 text-left ${activeTab === tab.id
                                                    ? "border-t-blue-500 text-blue-400 bg-blue-500/10"
                                                    : "border-t-transparent text-slate-400 hover:text-slate-300 hover:bg-white/10"
                                                    }`}
                                            >
                                                <IconComponent className="w-5 h-5 flex-shrink-0" />
                                                <span className="font-medium text-sm hidden sm:block">{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <Link to="/">
                                    <button className="hidden lg:flex group gap-3 items-center bg-slate-500/20 border border-slate-700/50 rounded-xl px-4 py-3 cursor-pointer hover:bg-slate-700/40 transition-all duration-300 w-[55px] hover:w-full overflow-hidden whitespace-nowrap">
                                        <MoveLeft className="w-5 h-5 flex-shrink-0" />
                                        <p className="text-sm font-medium text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300">กลับไปที่หน้าหลัก</p>
                                    </button>
                                </Link>

                            </div>
                        </div>
                    </div>

                    <div className="flex flex-1 flex-grow bg-gradient-to-br from-slate-800 to-slate-800/50 rounded-2xl border border-slate-700/50 p-6 shadow-xl hover:shadow-2xl hover:border-slate-600/50 transition-all duration-300 justify-center lg:overflow-y-auto lg:min-h-0 right-content-scroll">
                        {activeTab === "profile" && (
                            <div className="lg:max-w-5xl w-full flex justify-center">
                                <div className="w-full space-y-6">
                                    {/* User ID (Read-only) */}
                                    <div className="group">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                                            <User className="w-4 h-4 text-slate-500" /> รหัสผู้ใช้
                                        </label>
                                        <input type="text" value={user?.user_id || ""} disabled className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-slate-400 cursor-not-allowed font-mono text-sm hover:bg-slate-700/60 transition-colors" />
                                    </div>

                                    {/* Username */}
                                    <div className="group">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                                            <Edit2 className="w-4 h-4 text-slate-500" /> ชื่อผู้ใช้
                                        </label>
                                        <div className="relative">
                                            <input type="text" value={profileForm.username}
                                                onChange={(e) => setProfileForm({
                                                    ...profileForm,
                                                    username: e.target.value
                                                })}
                                                disabled={!editingProfile}
                                                className={`w-full px-4 py-3 border rounded-xl transition-all duration-300
                                            ${editingProfile ? "bg-slate-700 border-blue-500 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent shadow-lg shadow-blue-500/10" : "bg-slate-700/50 border-slate-600 text-slate-200 cursor-not-allowedhover:bg-slate-700/60"
                                                    }`}
                                            />
                                            {editingProfile && (
                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-400">
                                                    <Edit2 className="w-5 h-5" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Role (Read-only) */}
                                    <div className="group">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                                            <ShieldAlert className="w-4 h-4 text-slate-500" />
                                            บทบาท
                                        </label>
                                        <input type="text" value={user?.role || ""} disabled
                                            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-slate-400 cursor-not-allowed capitalize font-medium hover:bg-slate-700/60 transition-colors" />
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex gap-3 pt-6 border-t border-slate-700 mt-8">
                                        {!editingProfile ? (
                                            <button onClick={() => setEditingProfile(true)}
                                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl
                                                transition-all duration-300 font-semibold shadow-lg hover:shadow-xl
                                                hover:shadow-blue-500/20 active:scale-95"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                แก้ไขข้อมูล
                                            </button>
                                        ) : (
                                            <>
                                                <button onClick={handleUpdateProfile} disabled={loading}
                                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl hover:shadow-emerald-500/20 disabled:shadow-none active:scale-95">
                                                    {loading ? (
                                                        <>
                                                            <Loader className="w-4 h-4 animate-spin" />
                                                            กำลังบันทึก...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Save className="w-4 h-4" />
                                                            บันทึก
                                                        </>
                                                    )}
                                                </button>
                                                <button onClick={() => {
                                                    setEditingProfile(false);
                                                    setProfileForm({ username: user.username });
                                                }}
                                                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl
                                        transition-all duration-300 font-semibold shadow-lg hover:shadow-xl
                                        active:scale-95"
                                                >
                                                    ยกเลิก
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "password" && (
                            <div className="lg:max-w-5xl  w-full">
                                <form onSubmit={handleChangePassword} className="space-y-6">
                                    {/* Current Password */}
                                    <div className="group">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                                            <Lock className="w-4 h-4 text-slate-500" />
                                            รหัสผ่านปัจจุบัน
                                        </label>
                                        <div className="relative">
                                            <input type={showPasswords.current ? "text" : "password"}
                                                value={passwordForm.currentPassword} onChange={(e) =>
                                                    setPasswordForm({
                                                        ...passwordForm,
                                                        currentPassword: e.target.value
                                                    })
                                                }
                                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl
                                    text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50
                                    focus:border-transparent transition-all duration-300"
                                                placeholder="กรุณากรอกรหัสผ่านปัจจุบัน"
                                            />
                                            <button type="button" onClick={() =>
                                                setShowPasswords({
                                                    ...showPasswords,
                                                    current: !showPasswords.current
                                                })
                                            }
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400
                                        hover:text-white transition-colors"
                                            >
                                                {showPasswords.current ? (
                                                    <EyeOff className="w-5 h-5" />
                                                ) : (
                                                    <Eye className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* New Password */}
                                    <div className="group">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                                            <Lock className="w-4 h-4 text-slate-500" />
                                            รหัสผ่านใหม่
                                        </label>
                                        <div className="relative">
                                            <input type={showPasswords.new ? "text" : "password"}
                                                value={passwordForm.newPassword} onChange={(e) =>
                                                    setPasswordForm({
                                                        ...passwordForm,
                                                        newPassword: e.target.value
                                                    })
                                                }
                                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl
                                    text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50
                                    focus:border-transparent transition-all duration-300"
                                                placeholder="กรุณากรอกรหัสผ่านใหม่"
                                            />
                                            <button type="button" onClick={() =>
                                                setShowPasswords({
                                                    ...showPasswords,
                                                    new: !showPasswords.new
                                                })
                                            }
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400
                                        hover:text-white transition-colors"
                                            >
                                                {showPasswords.new ? (
                                                    <EyeOff className="w-5 h-5" />
                                                ) : (
                                                    <Eye className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Confirm Password */}
                                    <div className="group">
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                                            <Lock className="w-4 h-4 text-slate-500" />
                                            ยืนยันรหัสผ่านใหม่
                                        </label>
                                        <div className="relative">
                                            <input type={showPasswords.confirm ? "text" : "password"}
                                                value={passwordForm.confirmPassword} onChange={(e) =>
                                                    setPasswordForm({
                                                        ...passwordForm,
                                                        confirmPassword: e.target.value
                                                    })
                                                }
                                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl
                                    text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50
                                    focus:border-transparent transition-all duration-300"
                                                placeholder="กรุณายืนยันรหัสผ่านใหม่"
                                            />
                                            <button type="button" onClick={() =>
                                                setShowPasswords({
                                                    ...showPasswords,
                                                    confirm: !showPasswords.confirm
                                                })
                                            }
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400
                                        hover:text-white transition-colors"
                                            >
                                                {showPasswords.confirm ? (
                                                    <EyeOff className="w-5 h-5" />
                                                ) : (
                                                    <Eye className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Password Requirements */}
                                    <div
                                        className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl p-5 text-sm text-blue-300 border border-blue-500/20 shadow-lg shadow-blue-500/5">
                                        <p className="font-semibold mb-3 flex items-center gap-2">
                                            <ShieldAlert className="w-4 h-4" />
                                            ข้อกำหนดรหัสผ่าน
                                        </p>
                                        <ul className="space-y-2 pl-6">
                                            <li>
                                                <span>✓ ความยาวอย่างน้อย 6 ตัวอักษร</span>
                                            </li>
                                        </ul>
                                    </div>

                                    {/* Submit Button */}
                                    <button type="submit" disabled={loading}
                                        className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-xl transition-all duration-300 font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:shadow-blue-500/20 disabled:shadow-none active:scale-95 text-base">
                                        {loading ? (
                                            <>
                                                <Loader className="w-5 h-5 animate-spin" />
                                                กำลังเปลี่ยนรหัสผ่าน...
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="w-5 h-5" />
                                                เปลี่ยนรหัสผ่าน
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        )}

                        {activeTab === "image" && (
                            <div className="lg:max-w-5xl w-full">
                                <div className="space-y-8">
                                    {/* Current Profile Image */}
                                    <div>
                                        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-200 mb-4">
                                            <User className="w-5 h-5 text-slate-500" />
                                            รูปโปรไฟล์ปัจจุบัน
                                        </h3>
                                        <div
                                            className="flex justify-center p-6 bg-slate-700/30 rounded-xl border border-slate-700/50">
                                            {user?.profile_image && user.profile_image !== "null" ? (
                                                <div className="relative">
                                                    <img src={`${PROTOCOL}://${HOST}:${HOST_PORT}/uploads/user_profile/${user.profile_image}`}
                                                        alt="profile"
                                                        className="w-40 h-40 rounded-full border-4 border-blue-500/50 object-cover shadow-2xl" />
                                                    <div
                                                        className="absolute bottom-4 right-3 w-5 h-5 bg-green-500  border-[3px] border-slate-800 rounded-full shadow-lg">
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    className="w-40 h-40 rounded-full border-4 border-slate-600 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-xl">
                                                    <User className="w-20 h-20 text-slate-500" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Preview */}
                                    {previewImage && (
                                        <div className="relative">
                                            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-200 mb-4">
                                                <Check className="w-5 h-5 text-green-400" />
                                                ตัวอย่างรูปภาพใหม่
                                            </h3>
                                            <div
                                                className="flex justify-center p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/30">
                                                <div className="relative">
                                                    <img src={previewImage} alt="preview"
                                                        className="w-40 h-40 rounded-full border-4 border-green-500/60 object-cover shadow-2xl" />
                                                    <div
                                                        className="absolute bottom-4 right-3 w-5 h-5 bg-green-400 border-[3px] border-slate-800 rounded-full shadow-lg">
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* File Input - Enhanced */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-300 mb-3">
                                            เลือกรูปภาพใหม่
                                        </label>
                                        <label
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            className={`flex flex-col items-center justify-center w-full px-6 py-10 border-2 border-dashed rounded-2xl transition-all duration-300 cursor-pointer group shadow-lg ${dragOver
                                                ? "border-blue-400 bg-blue-500/20 shadow-xl shadow-blue-500/20"
                                                : "border-slate-600 hover:border-blue-500 hover:bg-slate-700/40 hover:shadow-xl"
                                                }`}>
                                            <div className="flex flex-col items-center justify-center">
                                                <div
                                                    className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-all ${dragOver
                                                        ? "bg-gradient-to-br from-blue-500/40 to-purple-500/40"
                                                        : "bg-gradient-to-br from-blue-500/20 to-purple-500/20 group-hover:from-blue-500/30 group-hover:to-purple-500/30"
                                                        }`}>
                                                    <Upload
                                                        className={`w-8 h-8 transition-colors ${dragOver
                                                            ? "text-blue-300"
                                                            : "text-slate-400 group-hover:text-blue-400"
                                                            }`} />
                                                </div>
                                                <span
                                                    className={`text-base font-semibold transition-colors ${dragOver
                                                        ? "text-blue-300"
                                                        : "text-slate-300 group-hover:text-blue-300"
                                                        }`}>
                                                    {dragOver ? "ปล่อยรูปภาพที่นี่" : "ลากรูปภาพที่นี่ หรือคลิกเพื่อเลือก"}
                                                </span>
                                                <span className="text-xs text-slate-500 mt-2">
                                                    PNG, JPG, GIF หรือ WebP • สูงสุด 5MB
                                                </span>
                                            </div>
                                            <input type="file" accept="image/*" onChange={handleImageChange}
                                                className="hidden" />
                                        </label>
                                    </div>

                                    {/* Upload Button */}
                                    {profileImage && (
                                        <button onClick={handleUploadImage} disabled={uploadingImage}
                                            className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-xl transition-all duration-300 font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:shadow-blue-500/20 disabled:shadow-none active:scale-95 text-base animate-in fade-in slide-in-from-bottom-4">
                                            {uploadingImage ? (
                                                <>
                                                    <Loader className="w-5 h-5 animate-spin" />
                                                    กำลังอัปโหลด...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-5 h-5" />
                                                    อัปโหลดรูปภาพ
                                                </>
                                            )}
                                        </button>
                                    )}

                                    {/* Info */}
                                    <div
                                        className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-5 text-sm text-amber-300 border border-amber-500/20 shadow-lg shadow-amber-500/5">
                                        <p className="flex items-center gap-2">
                                            <span className="text-lg mt-0.5">&#9432;</span>
                                            <span>รูปโปรไฟล์ของคุณจะแสดงในส่วนหัวของแอปพลิเคชันและใช้เป็นตัวแทนของบัญชีของคุณ</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}