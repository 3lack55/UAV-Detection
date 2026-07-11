import { useState, useEffect, useRef, useCallback } from 'react';
import { useStreamViewer } from '../context/StreamViwerContext';

const StreamViewer = ({ onControlReady }) => {
    const { frame, metaData, status, fpsDisplay, isCameraConnected, sendControlMessage } = useStreamViewer();
    const [res, setRes] = useState({ w: 0, h: 0 });
    const canvasRef = useRef(null);

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

    const renderFrame = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        if (!ctx) return;

        if (!frame) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setRes({ w: 0, h: 0 });
            return;
        }

        try {
            const bitmap = await createImageBitmap(frame);

            if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
            }

            setRes({ w: bitmap.width, h: bitmap.height });
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bitmap, 0, 0);

            if (metaData?.uavs?.length > 0) {
                const scaleX = canvas.width / (metaData.image_size?.model_size?.[0] ?? canvas.width);
                const scaleY = canvas.height / (metaData.image_size?.model_size?.[1] ?? canvas.height);

                metaData.uavs.forEach((uav) => {
                    const { x1, y1, x2, y2 } = uav.boxes;
                    const conf = uav.confs;

                    const rx1 = x1 * scaleX;
                    const ry1 = y1 * scaleY;
                    const rw = (x2 - x1) * scaleX;
                    const rh = (y2 - y1) * scaleY;

                    ctx.strokeStyle = '#00FF00';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(rx1, ry1, rw, rh);

                    const label = `UAV ${(conf * 100).toFixed(1)}%`;
                    ctx.font = 'bold 14px monospace';
                    const textW = ctx.measureText(label).width;
                    ctx.fillStyle = '#00FF00';
                    ctx.fillRect(rx1, ry1 - 20, textW + 8, 20);
                    ctx.fillStyle = '#000000';
                    ctx.fillText(label, rx1 + 4, ry1 - 5);
                });
            }

            bitmap.close();
        } catch (err) {
            console.error('Render error:', err);
        }
    }, [frame, metaData]);

    useEffect(() => {
        renderFrame();
    }, [renderFrame]);

    return (
        <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
            <div className="absolute top-4 left-4 pointer-events-none bg-black/70 text-white text-xs px-3 py-2 rounded font-mono backdrop-blur-sm z-10 border border-gray-700">
                <div className={`font-bold text-lg mb-1 ${status.includes('Ready') ? 'text-green-400' : 'text-red-400'}`}>
                    {status}
                </div>

                {isCameraConnected ? (
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
                )}
            </div>

            <canvas
                ref={canvasRef}
                className="max-w-full max-h-full object-contain"
            />

            {!status.includes('Ready') && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="animate-pulse text-gray-400">{status}</span>
                </div>
            )}
        </div>
    );
};

export default StreamViewer;