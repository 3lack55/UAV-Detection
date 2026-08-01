import { useCallback, useEffect, useRef, useState } from "react";
import {
    Activity, AlertTriangle, CheckCircle2, Clock, Cpu, Database, Eye, HardDrive,
    Loader2, MemoryStick, Radio, RefreshCw, Server, Users, Video,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { useWebSocket } from "../../context/useWebSocket";
import { getSystemStatus } from "../../services/systemStatusApi";

const REFRESH_INTERVAL_MS = 30000;

const formatBytes = (bytes) => {
    if (bytes == null || Number.isNaN(Number(bytes))) return "-";
    if (Number(bytes) === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(Math.floor(Math.log(Number(bytes)) / Math.log(1024)), units.length - 1);
    const value = Number(bytes) / Math.pow(1024, index);
    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatUptime = (seconds) => {
    if (seconds == null || Number.isNaN(Number(seconds))) return "-";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (days > 0) parts.push(`${days} วัน`);
    if (hours > 0) parts.push(`${hours} ชม.`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes} นาที`);
    return parts.join(" ");
};

const formatDate = (value) => (value ? new Date(value).toLocaleString("th-TH") : "-");

function UsageBar({ percent }) {
    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    const color = value > 90 ? "bg-rose-500" : value > 75 ? "bg-amber-400" : "bg-blue-500";
    return (
        <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
        </div>
    );
}

function SectionHeader({ icon: Icon, title }) {
    return (
        <div className="flex items-center gap-2 mb-4 mt-8 first:mt-0">
            <Icon size={16} className="text-slate-400" />
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">{title}</h2>
        </div>
    );
}

function Card({ icon: Icon, title, children, className = "" }) {
    return (
        <div className={`bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-col ${className}`}>
            <div className="flex items-center gap-2 mb-4 text-slate-300">
                <Icon size={16} className="text-slate-400" />
                <h3 className="text-sm font-semibold">{title}</h3>
            </div>
            <div className="flex-1">
                {children}
            </div>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="flex justify-between items-center gap-3 text-xs py-1.5 border-b border-slate-700/30 last:border-0">
            <span className="text-slate-500">{label}</span>
            <span className="text-slate-200 text-right truncate max-w-[60%]" title={String(value ?? "")}>{value}</span>
        </div>
    );
}

function StatusPill({ online, onlineLabel = "Online", offlineLabel = "Offline" }) {
    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-900/50 border ${online ? "text-emerald-400 border-emerald-400/20" : "text-rose-400 border-rose-400/20"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-rose-400"}`} />
            {online ? onlineLabel : offlineLabel}
        </span>
    );
}

export default function SystemStatus() {
    const { user } = useAuth();
    const { connected: websocketConnected } = useWebSocket();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const intervalRef = useRef(null);

    const fetchStatus = useCallback(async (isBackground = false) => {
        if (!user?.token) return;
        if (!isBackground) setLoading(true);
        try {
            const result = await getSystemStatus(user.token);
            if (result.success) {
                setData(result.data);
                setError(null);
                setLastUpdated(new Date());
            } else {
                setError(result.message || "ไม่สามารถโหลดข้อมูลระบบได้");
            }
        } catch (requestError) {
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        } finally {
            setLoading(false);
        }
    }, [user?.token]);

    useEffect(() => {
        fetchStatus(false);
        intervalRef.current = setInterval(() => fetchStatus(true), REFRESH_INTERVAL_MS);
        return () => clearInterval(intervalRef.current);
    }, [fetchStatus]);

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <p className="text-sm">กำลังโหลดข้อมูลระบบ...</p>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4 bg-slate-800/30 rounded-xl border border-rose-500/20">
                <AlertTriangle className="w-8 h-8 text-rose-400" />
                <p className="text-rose-400 text-sm">{error}</p>
                <button
                    onClick={() => fetchStatus(false)}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg px-4 py-2 transition-colors"
                >
                    <RefreshCw size={14} /> ลองใหม่
                </button>
            </div>
        );
    }

    if (!data) return null;

    const { server, resources, database, services = [], operational = {}, network = {}, api = {}, storage = {}, processes = {} } = data;
    const cameras = operational.cameras || { total: 0, connected: 0, offline: 0, detecting: 0, controllable: 0, list: [] };
    const realtime = operational.realtime || {};
    const detection = operational.detection || {};
    const cameraList = cameras.list || [];
    const onlineUsers = realtime.onlineUsers || [];
    const detectingCameras = realtime.detectingCameras || [];
    const uploads = storage.uploads || {};
    const docker = processes.docker || {};
    const processList = processes.systemProcesses || [];

    const overallStatus = server.status || "operational";
    const statusMeta = {
        operational: { label: "ระบบทำงานปกติ", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", Icon: CheckCircle2 },
        degraded: { label: "พบปัญหาบางส่วน", color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20", Icon: AlertTriangle },
        critical: { label: "ต้องตรวจสอบด่วน", color: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-400/20", Icon: AlertTriangle },
    };
    const status = statusMeta[overallStatus] || statusMeta.operational;
    const StatusIcon = status.Icon;
    const backendServices = services.filter((s) => s.name !== "WebSocket");

    return (
        <div className="space-y-6 pb-10">
            {/* 1. Header & Global Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg border ${status.bg} ${status.border}`}>
                    <StatusIcon size={20} className={status.color} />
                    <span className={`text-sm tracking-wide ${status.color}`}>{status.label}</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-xs text-slate-400 flex flex-col sm:items-end">
                        <span className="flex items-center gap-1.5"><Clock size={12} /> อัปเดตล่าสุด</span>
                        <span className="text-slate-200 font-medium">{lastUpdated ? lastUpdated.toLocaleTimeString("th-TH") : "-"}</span>
                    </div>
                    <button
                        onClick={() => fetchStatus(false)}
                        className="flex items-center gap-2 text-xs font-semibold text-slate-200 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg px-3 py-2 transition-colors focus:ring-2 focus:ring-blue-500/50 outline-none"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin text-blue-400" : "text-blue-400"} /> รีเฟรช
                    </button>
                </div>
            </div>

            {/* 2. Live Operations (Cameras, Detections, Users) - Highest Priority */}
            <section>
                <SectionHeader icon={Video} title="Live Operations & Alerts" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    {/* Detection Alert Card */}
                    <Card icon={Eye} title="UAV Detection Alerts" className="lg:col-span-1 border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-transparent">
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700/50 text-center">
                                <div className="text-xs text-slate-400 mb-1">กำลังดำเนินการ</div>
                                <div className={`text-2xl font-bold ${detection.activeEvents > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                                    {detection.activeEvents}
                                </div>
                            </div>
                            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700/50 text-center">
                                <div className="text-xs text-slate-400 mb-1">พบใน 24 ชม.</div>
                                <div className="text-2xl font-bold text-slate-200">{detection.eventsLast24h}</div>
                            </div>
                        </div>
                        <InfoRow label="เหตุการณ์ทั้งหมด" value={detection.totalEvents} />
                        <InfoRow label="ตรวจพบล่าสุด" value={formatDate(detection.lastEventAt)} />
                        
                        {detectingCameras.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-700/50">
                                <div className="text-xs text-slate-400 mb-2">กล้องที่พบการเคลื่อนไหวขณะนี้:</div>
                                <div className="flex flex-wrap gap-2">
                                    {detectingCameras.map((camera) => (
                                        <span key={camera.cameraId} className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 border border-rose-500/30 px-2 py-1 text-xs font-medium text-rose-300 shadow-sm shadow-rose-500/10">
                                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute opacity-75"></span>
                                            <span className="w-2 h-2 rounded-full bg-rose-500 relative"></span>
                                            Cam {camera.cameraId}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Active Users */}
                    <Card icon={Users} title="ผู้ใช้งานที่กำลังเชื่อมต่อ" className="lg:col-span-1">
                        <div className="flex items-baseline gap-2 mb-4">
                            <span className="text-3xl font-bold text-emerald-400">{onlineUsers.length}</span>
                            <span className="text-xs text-slate-400">ผู้ใช้ออนไลน์</span>
                        </div>
                        <div className="space-y-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                            {onlineUsers.length ? (
                                onlineUsers.map((person) => (
                                    <div key={person.userId || person.username} className="flex justify-between items-center bg-slate-900/40 p-2 rounded border border-slate-700/30">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_#34d399]" />
                                            <span className="text-xs text-slate-200">{person.username || person.userId}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 uppercase px-1.5 py-0.5 bg-slate-800 rounded">{person.role || "user"}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-slate-500 italic text-center py-4">ไม่มีผู้ใช้งานออนไลน์</p>
                            )}
                        </div>
                    </Card>

                    {/* Camera Overview Stats */}
                    <Card icon={Video} title="สถานะกล้องทั้งหมด" className="lg:col-span-1">
                        <div className="grid grid-cols-2 gap-3 h-full">
                            <div className="flex flex-col justify-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                                <span className="text-xs text-slate-400 mb-1">กล้องออนไลน์</span>
                                <div className="flex items-end gap-1">
                                    <span className={`text-2xl font-bold ${cameras.connected === 0 && cameras.total > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                                        {cameras.connected}
                                    </span>
                                    <span className="text-sm text-slate-500 mb-0.5">/ {cameras.total}</span>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                                <span className="text-xs text-slate-400 mb-1">ออฟไลน์</span>
                                <span className={`text-2xl font-bold ${cameras.offline > 0 ? "text-rose-400" : "text-slate-300"}`}>
                                    {cameras.offline}
                                </span>
                            </div>
                            <div className="flex flex-col justify-center bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 col-span-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-400">ควบคุมได้ (PTZ)</span>
                                    <span className="text-lg font-bold text-slate-200">{cameras.controllable}</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Camera Table */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-xs">
                            <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-700/50">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold">ชื่อกล้อง</th>
                                    <th className="text-left px-4 py-3 font-semibold">สถานะ</th>
                                    <th className="text-left px-4 py-3 font-semibold">สิทธิ์การควบคุม</th>
                                    <th className="text-left px-4 py-3 font-semibold">จำนวน Event</th>
                                    <th className="text-left px-4 py-3 font-semibold">อัปเดตล่าสุด</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/40">
                                {cameraList.length ? cameraList.map((camera) => (
                                    <tr key={camera.camera_id} className="hover:bg-slate-700/20 transition-colors">
                                        <td className="px-4 py-3 text-slate-200 font-medium">{camera.camera_name || `Camera ${camera.camera_id}`}</td>
                                        <td className="px-4 py-3"><StatusPill online={camera.connected} /></td>
                                        <td className="px-4 py-3 text-slate-400">
                                            {camera.controllable ? <span className="text-blue-400">ควบคุมได้</span> : "ดูอย่างเดียว"}
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">{camera.event_count || 0}</td>
                                        <td className="px-4 py-3 text-slate-500">{formatDate(camera.last_update)}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500 italic">ยังไม่มีข้อมูลกล้องในระบบ</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* 3. Infrastructure & Resources */}
            <section>
                <SectionHeader icon={Cpu} title="Infrastructure & Resources" />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Card icon={Cpu} title="CPU Processing">
                        <div className="flex items-baseline justify-between mb-2">
                            <span className="text-3xl font-bold text-slate-100">{resources.cpu.usagePercent}%</span>
                            <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">{resources.cpu.cores} cores</span>
                        </div>
                        <UsageBar percent={resources.cpu.usagePercent} />
                        <p className="text-[10px] text-slate-500 mt-3 truncate" title={resources.cpu.model}>{resources.cpu.model}</p>
                        <div className="mt-3 pt-3 border-t border-slate-700/30">
                            <InfoRow label="Load Avg (1m)" value={resources.loadAverage?.[0]?.toFixed?.(2) ?? "-"} />
                            <InfoRow label="Load Avg (5m)" value={resources.loadAverage?.[1]?.toFixed?.(2) ?? "-"} />
                        </div>
                    </Card>

                    <Card icon={MemoryStick} title="Memory (RAM)">
                        <div className="flex items-baseline justify-between mb-2">
                            <span className="text-3xl font-bold text-slate-100">{resources.memory.usedPercent}%</span>
                            <span className="text-[10px] text-slate-400">
                                {formatBytes(resources.memory.usedBytes)} / {formatBytes(resources.memory.totalBytes)}
                            </span>
                        </div>
                        <UsageBar percent={resources.memory.usedPercent} />
                        <div className="mt-4 pt-3 border-t border-slate-700/30">
                            <InfoRow label="Process RSS" value={formatBytes(resources.memory.processRssBytes)} />
                            <InfoRow label="V8 Heap" value={`${formatBytes(resources.memory.processHeapUsedBytes)} / ${formatBytes(resources.memory.processHeapTotalBytes)}`} />
                        </div>
                    </Card>

                    <Card icon={HardDrive} title="Storage (Disk)">
                        {resources.disk ? (
                            <>
                                <div className="flex items-baseline justify-between mb-2">
                                    <span className="text-3xl font-bold text-slate-100">{resources.disk.usedPercent}%</span>
                                    <span className="text-[10px] text-slate-400">
                                        {formatBytes(resources.disk.usedBytes)} / {formatBytes(resources.disk.totalBytes)}
                                    </span>
                                </div>
                                <UsageBar percent={resources.disk.usedPercent} />
                                <div className="mt-4 pt-3 border-t border-slate-700/30">
                                    <InfoRow label="Uploads Path" value={uploads.path || "uploads"} />
                                    <InfoRow label="Files Stored" value={uploads.fileCount ?? 0} />
                                    <InfoRow label="Directory Size" value={formatBytes(uploads.totalBytes)} />
                                </div>
                            </>
                        ) : (
                            <div className="flex h-full items-center justify-center">
                                <p className="text-xs text-slate-500 italic">ไม่สามารถอ่านข้อมูลดิสก์ได้บน OS นี้</p>
                            </div>
                        )}
                    </Card>

                    <Card icon={Server} title="Server & Docker">
                        <InfoRow label="Hostname" value={server.hostname} />
                        <InfoRow label="OS Uptime" value={formatUptime(server.osUptimeSeconds)} />
                        
                        <div className="mt-3 pt-3 border-t border-slate-700/30">
                            <div className="flex justify-between items-center text-xs mb-2">
                                <span className="text-slate-400 font-semibold">Docker Containers</span>
                                <span className="text-slate-200">{docker.running ?? 0} / {docker.containerCount ?? 0}</span>
                            </div>
                            {docker.available && docker.containers?.length ? (
                                <div className="space-y-1.5">
                                    {docker.containers.slice(0, 3).map((container) => (
                                        <div key={`${container.name}-${container.image}`} className="flex justify-between items-center text-[10px] bg-slate-900/50 px-2 py-1 rounded">
                                            <span className="text-slate-300 truncate max-w-[100px]">{container.name}</span>
                                            <span className={`px-1.5 rounded-sm ${container.status.includes('Up') ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-500 bg-slate-800'}`}>{container.status}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[10px] text-slate-500 italic">No container data available.</p>
                            )}
                        </div>
                    </Card>
                </div>
            </section>

            {/* 4. Data, API & Services */}
            <section>
                <SectionHeader icon={Database} title="Data, API & Services" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card icon={Database} title="MySQL Database">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs text-slate-400">Connection Status</span>
                            <StatusPill online={database.status === "connected"} onlineLabel="Connected" offlineLabel="Disconnected" />
                        </div>
                        {database.status === "connected" ? (
                            <div className="space-y-1">
                                <InfoRow label="Database Size" value={formatBytes(database.sizeBytes)} />
                                <InfoRow label="Total Tables" value={database.tableCount} />
                                <InfoRow label="Query Latency" value={`${database.latencyMs} ms`} />
                            </div>
                        ) : (
                            <div className="bg-rose-500/10 p-3 rounded border border-rose-500/20">
                                <p className="text-xs text-rose-400">{database.error}</p>
                            </div>
                        )}
                    </Card>

                    <Card icon={Activity} title="Network & REST API">
                        <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-slate-700/30">
                            <div>
                                <div className="text-[10px] text-slate-500 mb-0.5">Traffic In</div>
                                <div className="text-sm font-medium text-blue-400">{formatBytes(network.bytesIn)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-500 mb-0.5">Traffic Out</div>
                                <div className="text-sm font-medium text-emerald-400">{formatBytes(network.bytesOut)}</div>
                            </div>
                        </div>
                        <InfoRow label="Total Requests" value={api.requestCount ?? 0} />
                        <InfoRow label="Error Rate" value={`${Number(api.errorRatePercent ?? 0).toFixed(2)}%`} />
                        <InfoRow label="Avg Response Time" value={`${Number(api.responseTimeMs ?? 0).toFixed(1)} ms`} />
                    </Card>

                    <Card icon={Radio} title="Microservices Status">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs py-2 px-3 bg-slate-900/40 rounded-lg border border-slate-700/50">
                                <div className="flex flex-col">
                                    <span className="text-slate-200 font-medium">WebSocket</span>
                                    <span className="text-[10px] text-slate-500">Your Current Connection</span>
                                </div>
                                <StatusPill online={websocketConnected} />
                            </div>
                            {backendServices.map((svc) => (
                                <div key={svc.name} className="flex items-center justify-between text-xs py-2 px-3 bg-slate-900/40 rounded-lg border border-slate-700/50">
                                    <span className="text-slate-300">{svc.name}</span>
                                    <StatusPill online={svc.status === "online"} />
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </section>
        </div>
    );
}