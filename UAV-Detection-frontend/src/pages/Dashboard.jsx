// Dashboard.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import Topbar from "../components/Topbar.jsx";
import Map from "../components/Map.jsx";
import { Camera, Clock, Video, MapPin, Compass, ShieldCheck, Activity } from "lucide-react"
import StreamViewer from "../components/StreamViwer.jsx";
import Situation from "../components/Situation.jsx";
import History from "../components/History.jsx";
import CameraController from "../components/CameraController.jsx";
import { useCameraPermissions } from "../context/CameraPermissionContext.jsx";
import { useWebSocket } from "../context/websocketContext.jsx";

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

const cameraPositions = (data) => {
  return data.map(cam => ({
    id: cam.camera_id,
    lat: parseFloat(cam.latitude),
    lng: parseFloat(cam.longitude),
    name: cam.camera_name,
    heading: cam.heading || 0,
    status: cam.status
  }));
};

const cameraStatusColors = {
  active: 'bg-green-500',
  inactive: 'bg-red-500',
  maintenance: 'bg-yellow-500',
  unknown: 'bg-gray-500'
};

export default function Dashboard() {
  const { lastMessage, connected } = useWebSocket();

  const [cameraID, setCameraID] = useState('None');
  const [sideTab, setSideTab] = useState('situation');
  const [rightTabOn, setRightTabOn] = useState(true);
  const [leftTabOn, setLeftTabOn] = useState(false);
  const [cameraSize, setCameraSize] = useState({ w: 416, h: 234 });
  const [cameraExpanded, setCameraExpanded] = useState(false);
  const { permissions } = useCameraPermissions();
  const [basePosition, setBasePosition] = useState([]);
  const [cameraList, setCameraList] = useState([]);

  // const [newHistory, setNewHistory] = useState(false);
  const [events, setEvents] = useState([]);
  const [isEventFetching, setIsEventFetching] = useState(true);

  const [detectingCameras, setDetectingCameras] = useState([]);
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [prevDetectingCount, setPrevDetectingCount] = useState(0);

  const fetchHistory = async () => {
    setIsEventFetching(true);
    try {
      const response = await fetch(`${PROTOCOL}://${HOST}:${HOST_PORT}/api/event/getEvents`);
      const result = await response.json();
      if (result.success) {
        setEvents(result.data);
      } else {
        throw new Error(result.message || "Failed to fetch history data");
      }
    } catch (error) {
      console.error("Error fetching history data:", error);
    } finally {
      setIsEventFetching(false);
    }
  }

  useEffect(() => {
    if (!connected) return;

    fetchHistory();
    const intervalId = setInterval(() => { fetchHistory() }, 30000);
    return () => clearInterval(intervalId);
  }, [connected]);

  const unReadEvents = events ? events.filter(e => e.seen === 0) : [];
  const readEvents = events ? events.filter(e => e.seen === 1) : [];

  // useEffect(() => {
  //   if (unReadEvents.length > 0) {
  //     setNewHistory(true);
  //   } else {
  //     setNewHistory(false);
  //   }
  // }, [unReadEvents]);

  const permissionMap = useMemo(() => {
    const map = {};
    if (permissions && permissions.data && Array.isArray(permissions.data)) {
      permissions.data.forEach(perm => {
        map[perm.camera_id] = perm.permission_level;
      });
    }
    return map;
  }, [permissions]);

  useEffect(() => {
    if (!connected) return;

    const fetchCameras = async () => {
      try {
        const response = await fetch(`${PROTOCOL}://${HOST}:${HOST_PORT}/api/camera/getAllCameras`);
        const data = await response.json();
        if (data.success) {
          setCameraList(data.data);
          setBasePosition(cameraPositions(data.data));
        }
      } catch (err) {
        console.error("Error fetching cameras:", err);
      }
    };
    fetchCameras();
  }, [connected]);

  useEffect(() => {
    if (lastMessage) {
      const detecting = lastMessage.detectingCameras || [];

      // Check if new threat detected
      if (detecting.length > prevDetectingCount && detecting.length > 0) {
        const newThreats = detecting.slice(prevDetectingCount);
        newThreats.forEach(threat => {
          const threatCam = cameraList.find(cam => cam.camera_id === threat.cameraId);
          const toastId = Date.now();
          setToasts(prev => [...prev, {
            id: toastId,
            message: `มีการตรวจพบ UAV ที่ ${threatCam?.camera_name || 'Camera ' + threat.cameraId}!`,
            type: 'threat'
          }]);

          // Auto remove toast after 5 seconds
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toastId));
          }, 5000);
        });
      }

      setPrevDetectingCount(detecting.length);
      setDetectingCameras(detecting);
    }
  }, [lastMessage, cameraList, prevDetectingCount]);

  useEffect(() => {
    if (cameraList.length > 0 && cameraID === 'None') {
      for (const cam of cameraList) {
        if (permissionMap[cam.camera_id]) {
          setCameraID(cam.camera_id);
          break;
        }
      }
    }
  }, [cameraList, cameraID, permissionMap]);

  const controlSenderRef = useRef(null);

  const handleCameraExpand = () => {
    const next = !cameraExpanded;
    setCameraExpanded(next);
    setCameraSize(next ? { w: 960, h: 540 } : { w: 416, h: 234 });
  }

  const cameraContainerRef = useRef(null);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      cameraContainerRef.current.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen mode:", err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => setIsNativeFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleCameraClick = (cameraId, permission) => {
    if (cameraId === cameraID) return;

    if (!permission) {
      setAlertMessage("คุณไม่มีสิทธิ์เข้าถึงกล้องนี้ กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์การเข้าถึง");
      setShowAlert(true);
      return;
    }
    setCameraID(cameraId);
    setLeftTabOn(false);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }

        .parent-container {overflow: hidden;}
        .parent-container::-webkit-scrollbar { width: 0px; height: 0px; }
        .parent-container::-webkit-scrollbar-track { background: transparent; }
        .parent-container::-webkit-scrollbar-thumb { background: transparent; }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideOutDown {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(20px);
          }
        }

        .toast-notification {
          animation: slideInUp 0.3s ease-out;
        }

        .toast-notification.exit {
          animation: slideOutDown 0.3s ease-in;
        }

        @keyframes threat-pulse-badge {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .threat-badge-pulse {
          animation: threat-pulse-badge 1s ease-in-out infinite;
        }
      `}} />

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-[10000] space-y-3 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="toast-notification bg-gradient-to-r from-rose-600 to-red-600 text-white px-6 py-3 rounded-lg shadow-2xl border border-rose-400/50 backdrop-blur-sm pointer-events-auto"
          >
            <p className="text-sm font-semibold">{toast.message}</p>
          </div>
        ))}
      </div>

      {/* Alert Modal */}
      {showAlert && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-sm w-[90%] animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-red-400">Access Denied</h3>
            </div>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">{alertMessage}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAlert(false)}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="h-full w-full relative overflow-hidden">
        <div className="w-full h-[56px]">
          <Topbar />
        </div>

        <div className="w-full h-[calc(100%-56px)] flex relative">
          <div className={`
            h-full bg-slate-900 relative 
            transition-all duration-300 ease-in-out
            ${rightTabOn ? 'w-[calc(100%-400px)]' : 'w-full'}
          `}>
            <Map base={basePosition} selectedCamera={cameraID} detectingCameras={detectingCameras} />
            <div
              ref={cameraContainerRef}
              style={{
                width: isNativeFullscreen ? '100vw' : cameraSize.w,
                height: isNativeFullscreen ? '100vh' : cameraSize.h + 32
              }}
              className={`absolute border border-black rounded-lg bottom-4 left-4 z-[1000] overflow-hidden transition-all duration-300 ${leftTabOn ? 'translate-x-[416px]' : 'translate-x-0'}`}
            >
              <div className="w-full h-[32px] flex items-center justify-between gap-2 px-2 bg-slate-800/80 border-b border-black backdrop-blur-[2px]">
                <div>
                  <Camera className="w-4 h-4 text-green-400 inline-block mr-1" />
                  <span className="text-sm font-mono">Camera: {cameraID}</span>
                </div>
                <div className="flex items-center gap-2">
                  <img src="/expand.png" alt="expand" className={`w-6 p-1 opacity-60 cursor-pointer hover:opacity-100 transition-all duration-300 ${cameraExpanded ? 'rotate-180' : ''} ${isNativeFullscreen ? 'hidden' : ''}`} onClick={handleCameraExpand} title={`${cameraExpanded ? 'Collapse' : 'Expand'}`} />
                  <img src={`${isNativeFullscreen ? '/exit-fullscreen.png' : '/fullscreen.png'}`} alt="fullscreen" className="w-6 p-1 opacity-60 cursor-pointer hover:opacity-100" onClick={toggleFullscreen} title={`${isNativeFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}`} />
                </div>

              </div>
              <div
                style={{
                  width: isNativeFullscreen ? '100%' : cameraSize.w,
                  height: isNativeFullscreen ? '100%' : cameraSize.h
                }}
                className="transition-all duration-300"
              >
                <StreamViewer
                  cameraID={cameraID}
                  onControlReady={(sender) => { controlSenderRef.current = sender; }}
                />
              </div>
            </div>

            <div
              className="absolute top-[50%] -translate-y-1/2 right-0 z-[1001] cursor-pointer p-2 rounded-[4px_0px_0px_4px] bg-slate-700/50 hover:bg-slate-700 transition-colors duration-200"
              onClick={() => setRightTabOn(prev => !prev)}
            >
              <div className={`transition-transform duration-300 ${rightTabOn ? 'rotate-0' : 'rotate-180'}`}>
                <img src="/fast-forward.png" alt="close-tab-icon" className="w-[16px]" />
              </div>
            </div>
          </div>

          { /* --- Left Side Tabs --- */}
          <div className={`absolute top-1/2 -translate-y-1/2 -left-[416px] z-[1001] w-[432px] h-full p-4 ${leftTabOn ? 'translate-x-[416px]' : 'translate-x-0'} transition-transform duration-300`}>
            <div className="w-full h-full bg-slate-800/80 backdrop-blur-[2px] relative rounded-lg border border-slate-700 overflow-y-auto overflow-x-hidden custom-scrollbar px-4">
              <div className="w-full h-12 flex items-center border-b border-slate-700 mb-4">
                <div className="flex gap-2 items-center">
                  <Camera className="w-6 h-6 text-green-400 inline-block" />
                  <h2 className="text-lg font-bold text-white">รายการกล้อง: {cameraList.length}</h2>
                </div>

              </div>
              {cameraList.length > 0 ? (
                cameraList.map((cam, index) => {
                  const userPermission = permissionMap[cam.camera_id];

                  return (
                    <div
                      key={index}
                      className="group w-full bg-slate-900/60 border border-slate-700 hover:border-blue-500/50 rounded-xl p-4 transition-all duration-300 mb-4 shadow-lg hover:shadow-blue-500/10"
                    >
                      {/* Header: ID & Status */}
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-blue-500/10 rounded-lg">
                            <Video className="w-4 h-4 text-blue-400" />
                          </div>
                          <h3 className="text-white font-bold tracking-wide">CAM-{cam.camera_id}</h3>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full animate-pulse ${cameraStatusColors[cam.status] || cameraStatusColors.unknown}`}></span>
                          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-tighter">{cam.status}</span>
                        </div>
                      </div>

                      {/* Camera Preview (Thumbnail) */}
                      <div
                        className={`relative w-full h-[180px] bg-slate-950 rounded-lg border border-slate-800 overflow-hidden ${userPermission ? 'group-hover:border-slate-600 cursor-pointer' : ''} transition-colors`}
                        onClick={() => handleCameraClick(cam.camera_id, userPermission)}
                      >
                        {/* Overlay เมื่อ Hover */}
                        {userPermission && (
                          <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 flex items-center justify-center transition-all">
                            <span className="opacity-0 group-hover:opacity-100 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-medium shadow-xl translate-y-2 group-hover:translate-y-0 transition-all">
                              Select Camera
                            </span>
                          </div>
                        )}

                        {/* ใส่รูป Placeholder หรือข้อความ */}
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-700">
                          <Activity className="w-8 h-8 mb-2 opacity-20" />
                          <p className="text-[10px] font-mono uppercase tracking-[0.2em]">{cam.camera_name}</p>
                        </div>
                      </div>

                      {/* Info Grid */}
                      <div className="mt-4 grid grid-cols-2 gap-y-3 gap-x-2 border-t border-slate-800 pt-4">
                        {/* Location */}
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold leading-none mb-1">Position</p>
                            <p className="text-xs text-slate-300 font-mono italic">{parseFloat(cam.latitude).toFixed(4)}, {parseFloat(cam.longitude).toFixed(4)}</p>
                          </div>
                        </div>

                        {/* Heading */}
                        <div className="flex items-start gap-2">
                          <Compass className="w-3.5 h-3.5 text-slate-500 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold leading-none mb-1">Heading</p>
                            <p className="text-xs text-slate-300 font-mono">{cam.heading}°</p>
                          </div>
                        </div>

                        {/* Permission (Full Width) */}
                        <div className="col-span-2 flex items-center gap-2 bg-slate-800/40 p-2 rounded-lg border border-slate-700/50">
                          <ShieldCheck className={`w-4 h-4 ${userPermission ? 'text-emerald-400' : 'text-slate-500'}`} />
                          <p className="text-xs font-medium">
                            <span className="text-slate-500 mr-2">Level:</span>
                            <span className={userPermission ? 'text-emerald-400 capitalize' : 'text-red-400'}>
                              {userPermission || 'Access Denied'}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-white text-center font-medium font-mono">No cameras available</p>
              )}
            </div>
            <div
              className={`absolute top-[50%] -translate-y-1/2 -right-4 z-[1001] cursor-pointer p-2 rounded-[0px_4px_4px_0px] bg-slate-700/50 hover:bg-slate-700 transition-colors duration-200`}
              onClick={() => setLeftTabOn(prev => !prev)}
            >
              <div className={`transition-transform duration-300 ${leftTabOn ? 'rotate-180' : 'rotate-0'}`}>
                <img src="/fast-forward.png" alt="close-tab-icon" className="w-[16px]" />
              </div>
            </div>
          </div>

          { /* --- Right Side Tabs --- */}
          <div className={`
            h-full bg-slate-800 border border-slate-700 border-t-0 
            overflow-hidden transition-all duration-300 ease-in-out z-[1001]
            ${rightTabOn ? 'w-[400px] min-w-[400px] h-[calc(100%-56px)] opacity-100 border' : 'w-0 min-w-0 border-0'}
          `}>
            <div className="w-full h-12 flex border-b border-slate-600">
              <div
                className={`
                  w-1/2 cursor-pointer hover:bg-slate-700 
                  flex items-center justify-center relative
                  ${sideTab === 'situation' ? 'bg-slate-700/50' : ''}
                `}
                onClick={() => setSideTab('situation')}
              >
                <p className="text-center text-lg">สถานการณ์</p>
                {(detectingCameras.length > 0 && rightTabOn) && (
                  <div className="absolute top-2 right-2">
                    <div className="threat-badge-pulse inline-flex items-center justify-center w-8 h-6 text-xs font-bold text-white bg-red-600 rounded-full border-2 border-red-400 shadow-lg">
                      {detectingCameras.length}
                    </div>
                  </div>
                )}
              </div>
              <div
                className={`
                  w-1/2 border-l border-slate-600 cursor-pointer hover:bg-slate-700 
                  flex items-center justify-center relative
                  ${sideTab === 'history' ? 'bg-slate-700/50' : ''}
                `}
                onClick={() => setSideTab('history')}
              >
                <p className="text-center text-lg">ประวัติ</p>
                {(unReadEvents.length > 0 && rightTabOn) && (
                  <div className="absolute top-2 right-2">
                    <div className="threat-badge-pulse inline-flex items-center justify-center w-8 h-6 text-xs font-bold text-white bg-red-600 rounded-full border-2 border-red-400 shadow-lg">
                      {unReadEvents.length}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full h-[calc(100%-48px)]">
              <div className="w-full h-[60%] overflow-y-hidden border-b border-slate-700">
                {sideTab === 'situation' && <Situation detectingCameras={detectingCameras} cameras={cameraList} permissionMap={permissionMap} handleCameraSelect={handleCameraClick} />}
                {sideTab === 'history' && <History events={events} setEvents={setEvents} unReadEvents={unReadEvents} readEvents={readEvents} isFetching={isEventFetching} setIsFetching={setIsEventFetching} />}
              </div>

              <div className="w-full h-[40%] overflow-hidden">
                <CameraController
                  cameraID={cameraID}
                  permission={permissionMap[cameraID]}
                  onControl={(command) => controlSenderRef.current?.(command)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
