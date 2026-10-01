import { useState } from "react";
import { Camera, Eye, EyeOff } from "lucide-react";
import StreamViewer from "../stream/StreamViewer.jsx";

export default function CameraViewerPanel({
  camera,
  cameraContainerRef,
  cameraSize,
  cameraExpanded,
  isNativeFullscreen,
  className = "",
  onExpand,
  onToggleFullscreen,
  onControlReady,
}) {
  const width = isNativeFullscreen ? "100%" : cameraSize.w;
  const height = isNativeFullscreen ? "100%" : cameraSize.h;
  const [overlayVisible, setOverlayVisible] = useState(true);

  return (
    <div
      ref={cameraContainerRef}
      style={{
        width: isNativeFullscreen ? "100vw" : cameraSize.w,
        height: isNativeFullscreen ? "100vh" : cameraSize.h + 32,
      }}
      className={`absolute border border-black rounded-lg bottom-4 left-4 z-[1000] overflow-hidden transition-all duration-300 ${className}`}
    >
      <div className="w-full h-[32px] flex items-center justify-between gap-2 px-2 bg-slate-800/80 border-b border-black backdrop-blur-[2px]">
        <div className="flex min-w-0 items-center gap-2">
          <Camera className="w-4 h-4 text-green-400 inline-block mr-1" />
          <h6 className="min-w-0 max-w-[300px] truncate text-sm">Camera: {camera?.camera_name || camera?.camera_id || "None"}</h6>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOverlayVisible((visible) => !visible)}
            aria-label={overlayVisible ? "ซ่อน Overlay" : "แสดง Overlay"}
            aria-pressed={overlayVisible}
            title={overlayVisible ? "ซ่อน Overlay" : "แสดง Overlay"}
            className="flex items-center gap-1 text-xs text-gray-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
          >
            {overlayVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>Overlay</span>
          </button>
          <img
            src="/expand.png"
            alt="expand"
            className={`w-6 p-1 opacity-60 cursor-pointer hover:opacity-100 transition-all duration-300 ${cameraExpanded ? "rotate-180" : ""} ${isNativeFullscreen ? "hidden" : ""}`}
            onClick={onExpand}
            title={cameraExpanded ? "Collapse" : "Expand"}
          />
          <img
            src={isNativeFullscreen ? "/exit-fullscreen.png" : "/fullscreen.png"}
            alt="fullscreen"
            className="w-6 p-1 opacity-60 cursor-pointer hover:opacity-100"
            onClick={onToggleFullscreen}
            title={isNativeFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          />
        </div>
      </div>
      <div
        style={{ width, height }}
        className="transition-all duration-300"
      >
        <StreamViewer onControlReady={onControlReady} showOverlay={overlayVisible} />
      </div>
    </div>
  );
}
