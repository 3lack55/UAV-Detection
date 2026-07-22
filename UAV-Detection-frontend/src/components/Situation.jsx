import { Wrench, Activity, ShieldAlert, CameraOff, CheckCircle2, Camera, AlertCircle, Lock } from 'lucide-react';

const STATUS_CONFIG = {
    active: {
        label: 'ปกติ',
        color: 'text-emerald-400',
        bg: 'bg-emerald-400/15',
        border: 'border-emerald-500/30',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />
    },
    inactive: {
        label: 'ไม่ทำงาน',
        color: 'text-slate-400',
        bg: 'bg-slate-400/15',
        border: 'border-slate-500/30',
        icon: <CameraOff className="w-3.5 h-3.5" />
    },
    maintenance: {
        label: 'บำรุงรักษา',
        color: 'text-yellow-400',
        bg: 'bg-yellow-400/15',
        border: 'border-yellow-500/30',
        icon: <Wrench className="w-3.5 h-3.5" />
    },
    threat: {
        label: 'คุกคาม',
        color: 'text-rose-400',
        bg: 'bg-rose-400/15',
        border: 'border-rose-500/30',
        icon: <ShieldAlert className="w-3.5 h-3.5" />
    }
};

const getLastOnlineTime = (lastUpdate) => {
    if (!lastUpdate) return 'ไม่พบข้อมูลอัพเดตล่าสุด';
    const lastOnlineDate = new Date(lastUpdate);
    const now = new Date();
    const diffInMs = now - lastOnlineDate;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays > 0) {
        return `${diffInDays} วันที่แล้ว`;
    }
    if (diffInHours > 0) {
        return `${diffInHours} ชั่วโมงที่แล้ว`;
    }
    if (diffInMinutes > 0) {
        return `${diffInMinutes} นาทีที่แล้ว`;
    }
    return 'เมื่อสักครู่ก่อน';
};

// Guards against "Invalid Date" showing up when last_update is missing/malformed
const formatDateTime = (isoString) => {
    if (!isoString) return null;
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString("th-TH");
};

export function Situation({ detectingCameras = [], cameras = [], permissionMap = {}, handleCameraSelect }) {
    return (
        <div className="w-full h-full flex flex-col bg-slate-800/50 text-slate-100 shadow-xl">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }

                @keyframes threat-shake {
                    0%, 100% { transform: translateX(0) rotate(0deg); }
                    10% { transform: translateX(-2px) rotate(-0.5deg); }
                    20% { transform: translateX(2px) rotate(0.5deg); }
                    30% { transform: translateX(-2px) rotate(-0.5deg); }
                    40% { transform: translateX(2px) rotate(0.5deg); }
                    50% { transform: translateX(-1px) rotate(-0.2deg); }
                    60% { transform: translateX(1px) rotate(0.2deg); }
                    70% { transform: translateX(0) rotate(0deg); }
                }

                @keyframes threat-glow {
                    0%, 100% { 
                        box-shadow: 0 0 10px rgba(248, 113, 113, 0.3), 
                                    inset 0 0 10px rgba(248, 113, 113, 0.1);
                    }
                    50% { 
                        box-shadow: 0 0 20px rgba(248, 113, 113, 0.6), 
                                    inset 0 0 20px rgba(248, 113, 113, 0.3);
                    }
                }

                @keyframes pulse-scale {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.02); }
                }

                .threat-card {
                    animation: threat-shake 0.6s ease-in-out infinite, threat-glow 2s ease-in-out infinite;
                }

                .threat-status-badge {
                    animation: pulse-scale 1s ease-in-out infinite;
                }
            `}</style>

            {/* List Area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {cameras.length === 0 ? (
                    // Empty State
                    <div className="h-40 mt-4 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30">
                        <Camera size={32} className="mb-2 opacity-50" />
                        <p className="text-sm">ไม่พบกล้องในระบบ</p>
                    </div>
                ) : (
                    cameras.map((camera) => {
                        const cameraId = String(camera.camera_id ?? camera.id ?? camera.cameraId);
                        const isDetecting = detectingCameras.some(dc => String(dc.cameraId) === cameraId);
                        const statusKey = isDetecting ? 'threat' : camera.status || 'inactive';
                        const status = STATUS_CONFIG[statusKey];
                        const hasPermission = permissionMap[camera.camera_id] || false;
                        const lastUpdateText = formatDateTime(camera.last_update);

                        return (
                            <div
                                key={camera.camera_id}
                                className={`group relative overflow-hidden transition-all duration-75 hover:scale-[1.015] cursor-pointer border ${status.border} ${status.bg} rounded-lg p-2.5 shadow-lg ${isDetecting ? 'threat-card' : ''}`}
                                onClick={() => handleCameraSelect(camera.camera_id, hasPermission)}
                            >
                                {/* Threat Glow Background */}
                                {isDetecting && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-rose-500/20 to-rose-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}

                                <div className="flex justify-between items-center relative z-10">
                                    <div className="flex items-center gap-2 w-[60%]">
                                        <div className={`p-1.5 rounded-md bg-slate-900/50 ${status.color} ${isDetecting ? 'animate-pulse' : ''}`}>
                                            <Camera className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-xs truncate max-w-48">{camera.camera_name}</h3>
                                            <p className="text-[10px] text-slate-400">ID: {camera.camera_id}</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-end items-center gap-1.5 w-[40%]">
                                        {!hasPermission && (
                                            <span title="ไม่มีสิทธิ์เข้าถึงกล้องนี้">
                                                <Lock className="w-3.5 h-3.5 text-yellow-400" />
                                            </span>
                                        )}
                                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-900/40 border border-white/5 ${status.color} text-[10px] font-bold whitespace-nowrap ${isDetecting ? 'threat-status-badge' : ''}`}>
                                            {isDetecting ? (
                                                <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
                                            ) : (
                                                status.icon
                                            )}
                                            {status.label}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-2 text-[11px] text-slate-400 flex justify-between items-center gap-1 italic bg-slate-900/30 px-2 py-1 rounded-md border border-white/5 relative z-10">
                                    {statusKey === 'active' && (
                                        <span>กล้องนี้ทำงานอยู่ ไม่พบเหตุการณ์ผิดปกติ</span>
                                    )}

                                    {statusKey === 'inactive' && (
                                        <span>
                                            ทำงานล่าสุด: {getLastOnlineTime(camera.last_update)}
                                            {lastUpdateText && ` (${lastUpdateText})`}
                                        </span>
                                    )}

                                    {statusKey === 'maintenance' && (
                                        <span>
                                            อยู่ระหว่างการปรับปรุง{lastUpdateText ? ` ตั้งแต่: (${lastUpdateText})` : ''}
                                        </span>
                                    )}

                                    {statusKey === 'threat' && (
                                        <span>ตรวจพบภัยคุกคาม!</span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default Situation;