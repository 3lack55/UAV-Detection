import { useWebSocket } from '../../context/useWebSocket';
import { useState, useEffect, useCallback } from 'react';
import { Activity } from 'lucide-react';

export function HolderImage({ camera }) {
    const { holderImageRef } = useWebSocket();
    const cameraId = `camera${camera?.camera_id}`;
    const [imageForThisCamera, setImageForThisCamera] = useState(null);

    const setNewImageForThisCamera = useCallback(() => {
        if (holderImageRef.current && holderImageRef.current[cameraId]) {
            setImageForThisCamera(holderImageRef.current[cameraId]);
        } else {
            setImageForThisCamera(null);
        }
    }, [cameraId, holderImageRef]);

    useEffect(() => {
        if (holderImageRef.current && holderImageRef.current[cameraId]) {
            setImageForThisCamera(holderImageRef.current[cameraId]);
        }

        const interval = setInterval(() => {
            setNewImageForThisCamera();
        }, 10000);

        return () => clearInterval(interval);
    }, [cameraId, holderImageRef, setNewImageForThisCamera]);

    return (
        <div>
            {imageForThisCamera ? (
                <img src={`data:image/jpeg;base64,${imageForThisCamera.imageBuffer}`} alt="Holder" />
            ) : (
                <div className='flex flex-col items-center justify-center'>
                    <Activity className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-[10px] font-mono uppercase tracking-[0.2em] max-w-[200px] truncate">{camera.camera_name}</p>
                </div>
            )}
        </div>
    );
};

export default HolderImage;
