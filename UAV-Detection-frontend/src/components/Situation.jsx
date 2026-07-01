import { Wrench, Activity, ShieldAlert, CameraOff, CheckCircle2, Camera, AlertCircle, Lock } from 'lucide-react';

const STATUS_CONFIG = {
    active: {
        label: 'ปกติ',
        color: 'text-emerald-400',
        bg: 'bg-emerald-400/15',
        border: 'border-emerald-500/30',
        icon: <CheckCircle2 className="w-4 h-4" />
    },
    inactive: {
        label: 'ไม่ทำงาน',
        color: 'text-slate-400',
        bg: 'bg-slate-400/15',
        border: 'border-slate-500/30',
        icon: <CameraOff className="w-4 h-4" />
    },
    maintenance: {
        label: 'บำรุงรักษา',
        color: 'text-yellow-400',
        bg: 'bg-yellow-400/15',
        border: 'border-yellow-500/30',
        icon: <Wrench className="w-4 h-4" />
    },
    threat: {
        label: 'คุกคาม',
        color: 'text-rose-400',
        bg: 'bg-rose-400/15',
        border: 'border-rose-500/30',
        icon: <ShieldAlert className="w-4 h-4" />
    }
};

const DIRECTION_LABELS = (degree) => {
    if (degree >= 337.5 || degree < 22.5) return 'North';
    if (degree >= 22.5 && degree < 67.5) return 'Northeast';
    if (degree >= 67.5 && degree < 112.5) return 'East';
    if (degree >= 112.5 && degree < 157.5) return 'Southeast';
    if (degree >= 157.5 && degree < 202.5) return 'South';
    if (degree >= 202.5 && degree < 247.5) return 'Southwest';
    if (degree >= 247.5 && degree < 292.5) return 'West';
    if (degree >= 292.5 && degree < 337.5) return 'Northwest';
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

            {/* Header */}
            <div className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2 w-[55%]">
                    <Activity className="w-5 h-5 text-blue-400" />
                    <h2 className="font-bold text-lg tracking-wide">สถานการณ์ปัจจุบัน</h2>
                </div>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-mono border border-blue-500/30">
                    DETECTION: {detectingCameras?.length || 0}
                </span>
            </div>

            {/* List Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {cameras.map((camera) => {
                    const cameraId = String(camera.camera_id ?? camera.id ?? camera.cameraId);
                    const isDetecting = detectingCameras.some(dc => String(dc.cameraId) === cameraId);
                    const statusKey = isDetecting ? 'threat' : camera.status || 'inactive';
                    const status = STATUS_CONFIG[statusKey];
                    const hasPermission = permissionMap[camera.camera_id] || false;

                    return (
                        <div
                            key={camera.camera_id}
                            className={`group relative overflow-hidden transition-all duration-300 hover:scale-105 cursor-pointer border ${status.border} ${status.bg} rounded-xl p-4 shadow-lg ${isDetecting ? 'threat-card' : ''}`}
                            onClick={() => handleCameraSelect(camera.camera_id, hasPermission)}
                        >
                            {/* Threat Glow Background */}
                            {isDetecting && (
                                <div className="absolute inset-0 bg-gradient-to-r from-rose-500/20 to-rose-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}

                            {/* Status Bar (Left Side) */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${status.color.replace('text', 'bg')}`} />

                            <div className="flex justify-between items-start relative z-10">
                                <div className="flex items-center gap-2 w-[60%]">
                                    <div className={`p-1.5 rounded-lg bg-slate-900/50 ${status.color} ${isDetecting ? 'animate-pulse' : ''}`}>
                                        <Camera className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm">{camera.camera_name}</h3>
                                        <p className="text-xs text-slate-400">ID: {camera.camera_id}</p>
                                    </div>
                                </div>

                                <div className="flex justify-end items-center gap-2 w-[40%]">
                                    {!hasPermission && (
                                        <Lock className="w-4 h-4 text-yellow-400" title="No permission to view this camera" />
                                    )}
                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-900/40 border border-white/5 ${status.color} text-[11px] font-bold ${isDetecting ? 'threat-status-badge' : ''}`}>

                                        {isDetecting ? (
                                            <AlertCircle className="w-4 h-4 animate-spin" />
                                        ) : (
                                            status.icon
                                        )}
                                        {status.label}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3 text-xs text-slate-400 flex justify-between items-center gap-1 italic bg-slate-900/30 p-2 rounded-md border border-white/5 relative z-10">
                                <span>Lat: {parseFloat(camera.latitude).toFixed(6)}</span>
                                <span>Lng: {parseFloat(camera.longitude).toFixed(6)}</span>
                                <span>Heading: {DIRECTION_LABELS(parseFloat(camera.heading))}, {parseInt(camera.heading)}°</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default Situation;