import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Camera, AlertCircle, Square, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.15;

export function EventDetailViewer({ eventDetails, eventId }) {
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const imageObjRef = useRef(null); // HTMLImageElement สำหรับ drawImage
    const isPanning = useRef(false);
    const panStart = useRef({ x: 0, y: 0 });
    const panOrigin = useRef({ x: 0, y: 0 });
    const stateRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });

    const hasData = eventDetails && eventDetails.length > 0;
    const currentFrame = hasData ? eventDetails[currentFrameIndex] : null;
    const totalFrames = hasData ? eventDetails.length : 0;

    // keep stateRef in sync (for use inside event handlers without stale closure)
    useEffect(() => {
        stateRef.current = { zoom, pan };
    }, [zoom, pan]);

    const goToPrevious = () => setCurrentFrameIndex((p) => (p === 0 ? totalFrames - 1 : p - 1));
    const goToNext = () => setCurrentFrameIndex((p) => (p === totalFrames - 1 ? 0 : p + 1));

    const resetZoom = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    useEffect(() => { resetZoom(); }, [currentFrameIndex, resetZoom]);

    // ── clamp pan ────────────────────────────────────────────────────────────
    const clampPan = useCallback((newPan, z, cW, cH) => {
        const maxX = (cW * (z - 1)) / 2;
        const maxY = (cH * (z - 1)) / 2;
        return {
            x: Math.max(-maxX, Math.min(maxX, newPan.x)),
            y: Math.max(-maxY, Math.min(maxY, newPan.y)),
        };
    }, []);

    // ── draw everything on canvas ─────────────────────────────────────────────
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        const img = imageObjRef.current;
        if (!canvas || !container || !img || !img.complete || !img.naturalWidth) return;

        const { zoom: z, pan: p } = stateRef.current;
        const cW = container.clientWidth;
        const cH = container.clientHeight;

        canvas.width = cW;
        canvas.height = cH;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, cW, cH);

        // ── compute letterbox rect (base, zoom=1) ──
        const natW = img.naturalWidth;
        const natH = img.naturalHeight;
        const imgAspect = natW / natH;
        const conAspect = cW / cH;

        let baseW, baseH, baseX, baseY;
        if (imgAspect > conAspect) {
            baseW = cW;
            baseH = cW / imgAspect;
            baseX = 0;
            baseY = (cH - baseH) / 2;
        } else {
            baseH = cH;
            baseW = cH * imgAspect;
            baseX = (cW - baseW) / 2;
            baseY = 0;
        }

        // ── apply zoom + pan (origin = canvas center) ──
        const cx = cW / 2;
        const cy = cH / 2;

        const imgX = (baseX - cx) * z + cx + p.x;
        const imgY = (baseY - cy) * z + cy + p.y;
        const imgW = baseW * z;
        const imgH = baseH * z;

        // draw image
        ctx.drawImage(img, imgX, imgY, imgW, imgH);

        // ── draw bounding boxes ───────────────────────────────────────────────
        if (showBoundingBoxes && currentFrame) {
            const eventData = currentFrame.event_data || {};
            const uavs = eventData.uavs || [];
            const modelSize = eventData.modelSize || [640, 640];

            // model coords → zoomed+panned canvas coords
            const scaleX = imgW / modelSize[0];
            const scaleY = imgH / modelSize[1];

            uavs.forEach((uav, idx) => {
                const boxes = uav.boxes || {};
                const x1 = (boxes.x1 || 0) * scaleX + imgX;
                const y1 = (boxes.y1 || 0) * scaleY + imgY;
                const x2 = (boxes.x2 || 0) * scaleX + imgX;
                const y2 = (boxes.y2 || 0) * scaleY + imgY;

                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

                const label = `UAV ${idx + 1} - ${(uav.confs * 100).toFixed(1)}%`;
                ctx.font = '12px monospace';
                const tw = ctx.measureText(label).width;
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(x1, y1 - 20, tw + 4, 18);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(label, x1 + 2, y1 - 6);
            });
        }
    }, [showBoundingBoxes, currentFrame]);

    // redraw whenever zoom/pan/frame/boxes change
    useEffect(() => { draw(); }, [draw, zoom, pan]);

    // ── load image into imageObjRef ──────────────────────────────────────────
    useEffect(() => {
        if (!currentFrame?.image_path) return;
        const img = new Image();
        img.src = `${PROTOCOL}://${HOST}:${HOST_PORT}/${currentFrame.image_path}`;
        img.onload = () => {
            imageObjRef.current = img;
            draw();
        };
        img.onerror = () => {
            imageObjRef.current = null;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        };
    }, [currentFrame?.image_path, draw]);

    // ── wheel zoom ───────────────────────────────────────────────────────────
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        setZoom((prevZ) => {
            const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
            const newZ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prevZ + delta * prevZ));
            const ratio = newZ / prevZ;
            setPan((prevP) => {
                const newP = {
                    x: mouseX - ratio * (mouseX - prevP.x),
                    y: mouseY - ratio * (mouseY - prevP.y),
                };
                return clampPan(newP, newZ, rect.width, rect.height);
            });
            return newZ;
        });
    }, [clampPan]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    // ── pan ──────────────────────────────────────────────────────────────────
    const handleMouseDown = useCallback((e) => {
        if (stateRef.current.zoom <= 1) return;
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY };
        panOrigin.current = stateRef.current.pan;
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!isPanning.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const newPan = {
            x: panOrigin.current.x + (e.clientX - panStart.current.x),
            y: panOrigin.current.y + (e.clientY - panStart.current.y),
        };
        setPan(clampPan(newPan, stateRef.current.zoom, rect.width, rect.height));
    }, [clampPan]);

    const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

    // ── data for info panels ─────────────────────────────────────────────────
    const eventData = currentFrame?.event_data || {};
    const cameraPos = eventData.cameraPosition || [0, 0];
    const modelSize = eventData.modelSize || [0, 0];
    const uavs = eventData.uavs || [];

    const formatTime = (isoString) => {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleTimeString('th-TH', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    };

    if (!hasData) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-900/40">
                <AlertCircle size={32} className="mb-2 opacity-50" />
                <p className="text-sm">ไม่มีข้อมูล Event Details</p>
            </div>
        );
    }

    return (
        <div
            className="w-full h-full flex flex-col bg-slate-900/50 overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/60">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Camera size={16} className="text-blue-400" />
                        <span className="text-sm font-semibold text-slate-300">Event #{eventId}</span>
                    </div>
                    <span className="text-xs text-slate-500">Frame {currentFrameIndex + 1} / {totalFrames}</span>
                </div>
                <p className="text-xs text-slate-400">{formatTime(currentFrame.time_stamp)}</p>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                <div className="bg-slate-800/40 rounded-lg border border-slate-700 overflow-hidden">

                    {/* Canvas viewport */}
                    <div
                        ref={containerRef}
                        className="aspect-video bg-slate-950 relative overflow-hidden"
                        style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
                        onMouseDown={handleMouseDown}
                        onDoubleClick={resetZoom}
                    >
                        <canvas
                            ref={canvasRef}
                            className="absolute top-0 left-0 w-full h-full"
                            style={{ pointerEvents: 'none' }}
                        />
                        {zoom > 1 && (
                            <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-mono px-2 py-0.5 rounded pointer-events-none">
                                {Math.round(zoom * 100)}%
                            </div>
                        )}
                        {zoom > 1 && (
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-slate-400 text-[10px] px-2 py-0.5 rounded pointer-events-none">
                                ลากเพื่อเลื่อน • ดับเบิลคลิกเพื่อรีเซ็ต
                            </div>
                        )}
                    </div>

                    {/* Navigation + Controls */}
                    <div className="flex items-center p-3 bg-slate-800/80 gap-1">
                        {totalFrames > 1 && (
                            <button onClick={goToPrevious} className="p-1.5 hover:bg-slate-700 rounded transition-colors">
                                <ChevronLeft size={18} className="text-slate-400" />
                            </button>
                        )}
                        <div className="flex-1 flex justify-center">
                            {totalFrames > 1 && (
                                <span className="text-xs text-slate-500">{currentFrameIndex + 1} / {totalFrames}</span>
                            )}
                        </div>
                        {totalFrames > 1 && (
                            <button onClick={goToNext} className="p-1.5 hover:bg-slate-700 rounded transition-colors">
                                <ChevronRight size={18} className="text-slate-400" />
                            </button>
                        )}

                        <div className="border-l border-slate-700 pl-2 ml-1 flex items-center gap-1">
                            <button
                                onClick={() => setZoom((p) => { const n = Math.max(MIN_ZOOM, p - ZOOM_STEP * p); if (n <= 1) { setPan({ x: 0, y: 0 }); return 1; } return n; })}
                                className="p-1.5 hover:bg-slate-700 rounded transition-colors" title="Zoom out"
                            >
                                <ZoomOut size={15} className="text-slate-400" />
                            </button>
                            <button
                                onClick={() => setZoom((p) => Math.min(MAX_ZOOM, p + ZOOM_STEP * p))}
                                className="p-1.5 hover:bg-slate-700 rounded transition-colors" title="Zoom in"
                            >
                                <ZoomIn size={15} className="text-slate-400" />
                            </button>
                            <button
                                onClick={resetZoom}
                                className="p-1.5 hover:bg-slate-700 rounded transition-colors" title="Reset zoom"
                            >
                                <Maximize2 size={15} className="text-slate-400" />
                            </button>

                            <div className="border-l border-slate-700 pl-2 ml-1">
                                <button
                                    onClick={() => setShowBoundingBoxes((v) => !v)}
                                    className={`p-1.5 rounded transition-colors flex items-center gap-1.5 px-2 ${
                                        showBoundingBoxes
                                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                    }`}
                                >
                                    <Square size={14} />
                                    <span className="text-xs font-semibold">Box</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Detection Data */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50 flex-1 min-w-[200px]">
                            <div className="flex items-center gap-2 mb-2">
                                <MapPin size={14} className="text-amber-400" />
                                <h4 className="text-xs font-bold text-slate-300">ตำแหน่งกล้อง (ขณะตรวจพบ)</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-slate-900/50 p-2 rounded">
                                    <span className="text-slate-500">X:</span>
                                    <span className="font-mono text-slate-200 ml-1">{cameraPos[0]?.toFixed(4) || 0}</span>
                                </div>
                                <div className="bg-slate-900/50 p-2 rounded">
                                    <span className="text-slate-500">Y:</span>
                                    <span className="font-mono text-slate-200 ml-1">{cameraPos[1]?.toFixed(4) || 0}</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50 flex-1 min-w-[200px]">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertCircle size={14} className="text-cyan-400" />
                                <h4 className="text-xs font-bold text-slate-300">ขนาด Model</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-slate-900/50 p-2 rounded">
                                    <span className="text-slate-500">W:</span>
                                    <span className="font-mono text-slate-200 ml-1">{modelSize[0] || 0}</span>
                                </div>
                                <div className="bg-slate-900/50 p-2 rounded">
                                    <span className="text-slate-500">H:</span>
                                    <span className="font-mono text-slate-200 ml-1">{modelSize[1] || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {uavs.length > 0 ? (
                        <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                            <h4 className="text-xs font-bold text-slate-300 mb-2">การตรวจพบ UAV ({uavs.length})</h4>
                            <div className="space-y-2">
                                {uavs.map((uav, idx) => (
                                    <div key={idx} className="bg-slate-900/50 p-2.5 rounded border border-red-900/30">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10px] text-slate-400 font-mono">UAV #{idx + 1}</span>
                                            <span className="text-xs font-bold text-red-400">
                                                ความมั่นใจ: {(uav.confs * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                                            {['x1','x2','y1','y2'].map((k) => (
                                                <div key={k} className="flex justify-between">
                                                    <span className="text-slate-500">{k.toUpperCase()}:</span>
                                                    <span className="text-slate-300 font-mono">{uav.boxes?.[k]?.toFixed(1) || 0}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50 text-center">
                            <p className="text-xs text-slate-500">ไม่พบการตรวจพบ UAV ในเฟรมนี้</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default EventDetailViewer;