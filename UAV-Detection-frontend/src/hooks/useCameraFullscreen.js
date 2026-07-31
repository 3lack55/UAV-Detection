import { useEffect, useRef, useState } from "react";

const COLLAPSED_SIZE = { w: 416, h: 234 };
const EXPANDED_SIZE = { w: 960, h: 540 };

export function useCameraFullscreen() {
  const cameraContainerRef = useRef(null);
  const [cameraExpanded, setCameraExpanded] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);

  const cameraSize = cameraExpanded ? EXPANDED_SIZE : COLLAPSED_SIZE;

  const handleCameraExpand = () => {
    setCameraExpanded((expanded) => !expanded);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      cameraContainerRef.current?.requestFullscreen().catch((error) => {
        console.error("Error attempting to enable fullscreen mode:", error);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return {
    cameraContainerRef,
    cameraSize,
    cameraExpanded,
    isNativeFullscreen,
    handleCameraExpand,
    toggleFullscreen,
  };
}
