import { Camera, Compass, MapPin, ShieldCheck, Video } from "lucide-react";
import { HolderImage } from "../stream/HolderImage.jsx";

const cameraStatusColors = {
  active: "bg-green-500",
  inactive: "bg-red-500",
  maintenance: "bg-yellow-500",
  unknown: "bg-gray-500",
};

const directionLabels = (degree) => {
  if (degree >= 337.5 || degree < 22.5) return "เหนือ";
  if (degree >= 22.5 && degree < 67.5) return "ตะวันออกเฉียงเหนือ";
  if (degree >= 67.5 && degree < 112.5) return "ตะวันออก";
  if (degree >= 112.5 && degree < 157.5) return "ตะวันตกเฉียงใต้";
  if (degree >= 157.5 && degree < 202.5) return "ใต้";
  if (degree >= 202.5 && degree < 247.5) return "ตะวันตกเฉียงใต้";
  if (degree >= 247.5 && degree < 292.5) return "ตะวันตก";
  if (degree >= 292.5 && degree < 337.5) return "ตะวันตกเฉียงเหนือ";
  return "ไม่ทราบทิศทาง";
};

export default function DashboardCameraList({ cameras, permissionMap, onCameraClick }) {
  return (
    <>
      <div className="w-full h-12 flex items-center border-b border-slate-700 mb-4">
        <div className="flex gap-2 items-center">
          <Camera className="w-6 h-6 text-green-400 inline-block" />
          <h2 className="text-lg font-bold text-white">รายการกล้อง: {cameras.length}</h2>
        </div>
      </div>

      {cameras.length > 0 ? cameras.map((camera) => {
        const userPermission = permissionMap[camera.camera_id];
        const coordinates = `${parseFloat(camera.latitude).toFixed(4)}, ${parseFloat(camera.longitude).toFixed(4)}`;
        const statusLabel = camera.status === "active"
          ? "ทำงาน"
          : camera.status === "maintenance" ? "กำลังปรับปรุง" : "ไม่ทำงาน";

        return (
          <div
            key={camera.camera_id}
            className="w-full bg-slate-900/60 border border-slate-700 hover:border-blue-500/50 rounded-xl p-4 transition-all duration-300 mb-4 shadow-lg hover:shadow-blue-500/10"
          >
            <div className="w-full flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/10 rounded-lg">
                  <Video className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-white font-bold tracking-wide w-[200px] truncate">{camera.camera_name}</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full animate-pulse ${cameraStatusColors[camera.status] || cameraStatusColors.unknown}`} />
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-tighter">{statusLabel}</span>
              </div>
            </div>

            <div
              className={`group relative w-full h-[180px] bg-slate-950 rounded-lg border border-slate-800 overflow-hidden ${userPermission ? "group-hover:border-slate-600 cursor-pointer" : ""} transition-colors`}
              onClick={() => onCameraClick(camera.camera_id, userPermission)}
            >
              {userPermission && (
                <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 flex items-center justify-center transition-all">
                  <span className="opacity-0 group-hover:opacity-100 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-medium shadow-xl translate-y-2 group-hover:translate-y-0 transition-all">
                    เลือกกล้องนี้
                  </span>
                </div>
              )}
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-700">
                <HolderImage camera={camera} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-y-3 gap-x-2 border-t border-slate-800 pt-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <p className="text-[11px] text-slate-500 uppercase font-bold leading-none">พิกัด</p>
                </div>
                <p className="text-xs text-slate-300 font-mono italic ml-[22px]">{coordinates}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Compass className="w-3.5 h-3.5 text-slate-500" />
                  <p className="text-[11px] text-slate-500 uppercase font-bold leading-none">ทิศทางที่ติดตั้ง</p>
                </div>
                <p className="text-xs text-slate-300 ml-[22px]">{camera.heading}° ({directionLabels(camera.heading)})</p>
              </div>

              <div className="col-span-2 flex items-center gap-2 bg-slate-800/40 p-2 rounded-lg border border-slate-700/50">
                <ShieldCheck className={`w-4 h-4 ${userPermission ? "text-emerald-400" : "text-slate-500"}`} />
                <p className="text-xs font-medium">
                  <span className="text-slate-500 mr-2">ระดับการใช้งาน:</span>
                  <span className={userPermission ? "text-emerald-400 capitalize" : "text-red-400"}>
                    {userPermission || "Access Denied"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        );
      }) : (
        <p className="text-white text-center font-medium font-mono">No cameras available</p>
      )}
    </>
  );
}
