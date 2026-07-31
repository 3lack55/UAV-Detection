import { useEffect, useMemo, useRef, useState } from "react";

export function useThreatDetection(statusUpdate, cameraList) {
  const [toasts, setToasts] = useState([]);
  const previousCountRef = useRef(0);

  const detectingCameras = useMemo(() => {
    const detecting = statusUpdate?.detectingCameras || [];
    return detecting.map((item) => (
      typeof item === "object" && item !== null ? { ...item } : item
    ));
  }, [statusUpdate]);

  useEffect(() => {
    if (!statusUpdate) return;

    const detecting = statusUpdate.detectingCameras || [];
    if (detecting.length > previousCountRef.current && detecting.length > 0) {
      const newThreats = detecting.slice(previousCountRef.current);
      newThreats.forEach((threat, index) => {
        const threatCam = cameraList.find((camera) => camera.camera_id === threat.cameraId);
        const toastId = `${Date.now()}-${index}`;
        setToasts((currentToasts) => [
          ...currentToasts,
          {
            id: toastId,
            message: `มีการตรวจพบ UAV ที่ ${threatCam?.camera_name || "Camera " + threat.cameraId}!`,
            type: "threat",
          },
        ]);

        setTimeout(() => {
          setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
        }, 5000);
      });
    }

    previousCountRef.current = detecting.length;
  }, [statusUpdate, cameraList]);

  return { detectingCameras, toasts };
}
