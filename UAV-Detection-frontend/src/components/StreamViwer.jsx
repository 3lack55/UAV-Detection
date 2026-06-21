import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from '../context/WebsocketContext';

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "ws";

const StreamViewer = ({ cameraID, onControlReady }) => {
    const { connected: mainConnected } = useWebSocket();
    const [status, setStatus] = useState('Disconnected');
    const [fpsDisplay, setFpsDisplay] = useState(0);
    const [res, setRes] = useState({ w: 0, h: 0 });
    const [metaData, setMetaData] = useState(null);
    const reconnectTimeoutRef = useRef(null);
    const isCameraConnectedRef = useRef(false);

    const canvasRef = useRef(null);
    const wsRef = useRef(null);

    // Refs for Rendering Loop
    const pendingFrame = useRef(null);
    const isRendering = useRef(false);
    const lastFrameTime = useRef(0);
    const frameCount = useRef(0);
    const lastFpsUpdateTime = useRef(0);

    // Decoder สำหรับแปลง Bytes เป็น String
    const textDecoder = useRef(new TextDecoder('utf-8'));

    const sendControlMessage = useCallback((command, payload = {}) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'control',
                cameraID,
                command,
                payload,
                timestamp: Date.now()
            }));
        } else {
            console.warn('WebSocket is not open; cannot send control command.', command);
        }
    }, [cameraID]);

    useEffect(() => {
        if (typeof onControlReady === 'function') {
            onControlReady(sendControlMessage);
        }
        return () => {
            if (typeof onControlReady === 'function') {
                onControlReady(null);
            }
        };
    }, [onControlReady, sendControlMessage]);

    // --- 1. Render Loop (ทำงานตลอดเวลาตาม Refresh Rate จอ) ---
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            pendingFrame.current = null;
            setFpsDisplay(0);
            setRes({ w: 0, h: 0 });
        }
    };

    const renderFrame = useCallback(async () => {
        if (!pendingFrame.current || isRendering.current) {
            if (lastFrameTime.current && performance.now() - lastFrameTime.current > 5000) {
                clearCanvas();
                isCameraConnectedRef.current = false;
            }
            return;
        }
            
        isRendering.current = true;
        const { blob, meta } = pendingFrame.current;
        isCameraConnectedRef.current = true;

        try {
            // สร้าง Bitmap จาก Blob (เร็วกว่า Image Object)
            const bitmap = await createImageBitmap(blob);
            const canvas = canvasRef.current;
            if (canvas) {
                // ปรับขนาด Canvas ถ้าขนาดภาพเปลี่ยน
                if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
                    canvas.width = bitmap.width;
                    canvas.height = bitmap.height;
                }

                if (res.w !== bitmap.width || res.h !== bitmap.height) {
                    setRes({ w: bitmap.width, h: bitmap.height });
                }

                const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
                ctx.drawImage(bitmap, 0, 0);

                if (meta?.uavs?.length > 0) {
                    const scaleX = canvas.width / (meta.image_size?.model_size?.[0] ?? canvas.width);
                    const scaleY = canvas.height / (meta.image_size?.model_size?.[1] ?? canvas.height);

                    meta.uavs.forEach((uav) => {
                        const { x1, y1, x2, y2 } = uav.boxes;
                        const conf = uav.confs;

                        const rx1 = x1 * scaleX;
                        const ry1 = y1 * scaleY;
                        const rw = (x2 - x1) * scaleX;
                        const rh = (y2 - y1) * scaleY;

                        // กรอบ
                        ctx.strokeStyle = '#00FF00';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(rx1, ry1, rw, rh);

                        // Label background
                        const label = `UAV ${(conf * 100).toFixed(1)}%`;
                        ctx.font = 'bold 14px monospace';
                        const textW = ctx.measureText(label).width;
                        ctx.fillStyle = '#00FF00';
                        ctx.fillRect(rx1, ry1 - 20, textW + 8, 20);

                        // Label text
                        ctx.fillStyle = '#000000';
                        ctx.fillText(label, rx1 + 4, ry1 - 5);
                    });
                }
            }

            bitmap.close(); // คืน Memory ทันที
            pendingFrame.current = null; // เคลียร์คิวรอรับเฟรมใหม่

            // คำนวณ FPS
            frameCount.current++;
            const now = performance.now();
            if (now - lastFpsUpdateTime.current >= 1000) {
                setFpsDisplay(frameCount.current);
                frameCount.current = 0;
                lastFpsUpdateTime.current = now;
            }
            lastFrameTime.current = now;

        } catch (err) {
            console.error("Render error:", err);
        } finally {
            isRendering.current = false;
        }
    }, []);

    // เริ่ม Loop การวาดภาพ
    useEffect(() => {
        let rafId;
        const loop = () => {
            renderFrame();
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, [renderFrame]);

    // --- 2. WebSocket Connection ---
    useEffect(() => {
        console.log("Connecting to camera stream:", cameraID);
        
        if (cameraID === 'None') {
            setStatus('No Camera Selected');
            clearCanvas();
            return;
        }

        if (!mainConnected) {
            setStatus('Waiting for main connection...');
            clearCanvas();
            return;
        }

        let isMounted = true;

        const connect = () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }

            setStatus('Connecting...');
            clearCanvas();

            const ws = new WebSocket(`${PROTOCOL}://${HOST}:${HOST_PORT}/streamViewer/camera${cameraID}`);
            ws.binaryType = 'arraybuffer';
            wsRef.current = ws;

            ws.onopen = () => {
                if (isMounted) {
                    setStatus('Live');
                    clearTimeout(reconnectTimeoutRef.current);
                }
            };

            ws.onmessage = (event) => {
                if (!isMounted) return;
                if (event.data instanceof ArrayBuffer) {
                    try {
                        const buffer = event.data;
                        const view = new DataView(buffer);
                        const jsonLen = view.getUint32(0, true);
                        const jsonBytes = new Uint8Array(buffer, 4, jsonLen);
                        const jsonStr = textDecoder.current.decode(jsonBytes);
                        const meta = JSON.parse(jsonStr);

                        const imageBytes = new Uint8Array(buffer, 4 + jsonLen);
                        const blob = new Blob([imageBytes], { type: 'image/jpeg' });

                        setMetaData(meta);
                        pendingFrame.current = { blob, meta };
                    } catch (err) {
                        console.error("Parse error:", err);
                    }
                }
            };

            ws.onclose = (e) => {
                if (isMounted) {
                    if (mainConnected) {
                        setStatus('Reconnecting...');
                        reconnectTimeoutRef.current = setTimeout(() => {
                            connect();
                        }, 3000);
                    } else {
                        setStatus('Waiting for main connection...');
                    }
                }
            };

            ws.onerror = (err) => {
                console.error("StreamViewer WebSocket error:", err);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            };
        };

        connect();

        return () => {
            isMounted = false;
            if (wsRef.current) {
                wsRef.current.close();
            }
            clearTimeout(reconnectTimeoutRef.current);
        };
    }, [cameraID, mainConnected]);

    return (
        <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
            {/* --- Stats Overlay --- */}
            <div className="absolute top-4 left-4 pointer-events-none bg-black/70 text-white text-xs px-3 py-2 rounded font-mono backdrop-blur-sm z-10 border border-gray-700">
                <div className={`font-bold text-lg mb-1 ${status.includes('Live') ? 'text-green-400' : 'text-red-400'}`}>
                    {status}
                </div>

                {isCameraConnectedRef.current ? (
                    <div className="space-y-1">
                        <div className="flex gap-4">
                            <span className="text-gray-400">FPS:</span>
                            <span className="text-yellow-400 font-bold">{fpsDisplay}</span>
                        </div>
                        <div className="flex gap-4">
                            <span className="text-gray-400">Res:</span>
                            <span className="text-blue-400">{res.w}x{res.h}</span>
                        </div>
                    </div>
                ) : (
                    <div className="text-red-400 font-bold animate-pulse">Camera Disconnected</div>
                )
            }
            </div>

            <canvas
                ref={canvasRef}
                className="max-w-full max-h-full object-contain"
            />

            {!status.includes('Live') && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="animate-pulse text-gray-400">{status}</span>
                </div>
            )}
        </div>
    );
};

export default StreamViewer;