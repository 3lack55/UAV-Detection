import { useRef, useState, useMemo } from "react";
import Topbar from "../../components/layout/Topbar.jsx";
import BoboMap from "../../components/dashboard/BoboMap.jsx";
import { Camera } from "lucide-react"
import { StreamViewerProvider } from "../../context/StreamViewerContext.jsx";
import Situation from "../../components/dashboard/Situation.jsx";
import History from "../../components/events/History.jsx";
import CameraController from "../../components/dashboard/CameraController.jsx";
import { useCameraPermissions } from "../../context/useCameraPermissions";
import { useWebSocket } from "../../context/useWebSocket";
import { HolderImage} from "../../components/stream/HolderImage.jsx";
import CameraViewerPanel from "../../components/dashboard/CameraViewerPanel.jsx";
import { DashboardOverlays } from "../../components/dashboard/DashboardOverlays.jsx";
import DashboardCameraList from "../../components/dashboard/DashboardCameraList.jsx";

import { useDashboardEvents } from "../../hooks/useDashboardEvents";
import { useThreatDetection } from "../../hooks/useThreatDetection";
import { useCameraFullscreen } from "../../hooks/useCameraFullscreen";

export default function Dashboard() {
  const { statusUpdate, connected } = useWebSocket();

  const [selectedCameraID, setSelectedCameraID] = useState(null);
  const [sideTab, setSideTab] = useState('situation');
  const [rightTabOn, setRightTabOn] = useState(true);
  const [leftTabOn, setLeftTabOn] = useState(false);
  const { permissions, cameraList, basePosition } = useCameraPermissions();

  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const {
    events,
    setEvents,
    isEventFetching,
    setIsEventFetching,
    unReadEvents,
    readEvents,
  } = useDashboardEvents(connected);
  const { detectingCameras, toasts } = useThreatDetection(statusUpdate, cameraList);

  const permissionMap = useMemo(() => {
    const map = {};
    if (permissions && Array.isArray(permissions)) {
      permissions.forEach(perm => {
        map[perm.camera_id] = perm.permission_level;
      });
    }
    return map;
  }, [permissions]);

  const cameraID = useMemo(() => {
    const selectedCamera = cameraList.find((camera) => camera.camera_id === selectedCameraID);
    if (selectedCamera && permissionMap[selectedCamera.camera_id]) {
      return selectedCamera.camera_id;
    }

    return cameraList.find((camera) => permissionMap[camera.camera_id])?.camera_id || 'None';
  }, [cameraList, permissionMap, selectedCameraID]);

  const controlSenderRef = useRef(null);
  const {
    cameraContainerRef,
    cameraSize,
    cameraExpanded,
    isNativeFullscreen,
    handleCameraExpand,
    toggleFullscreen,
  } = useCameraFullscreen();

  const handleCameraClick = (cameraId, permission) => {
    if (cameraId === cameraID) return;

    if (!permission) {
      setAlertMessage("คุณไม่มีสิทธิ์เข้าถึงกล้องนี้ กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์การเข้าถึง");
      setShowAlert(true);
      return;
    }
    setSelectedCameraID(cameraId);
    setLeftTabOn(false);
  }

  return (
    <StreamViewerProvider cameraID={cameraID} permission={permissionMap[cameraID]} >
      <>
        <DashboardOverlays
          toasts={toasts}
          alertMessage={alertMessage}
          showAlert={showAlert}
          onCloseAlert={() => setShowAlert(false)}
        />

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
            <BoboMap
              base={basePosition}
              selectedCamera={cameraID}
              detectingCameras={detectingCameras}
            />
            <CameraViewerPanel
              camera={cameraList.find((camera) => camera.camera_id === cameraID)}
              cameraContainerRef={cameraContainerRef}
              cameraSize={cameraSize}
              cameraExpanded={cameraExpanded}
              isNativeFullscreen={isNativeFullscreen}
              onExpand={handleCameraExpand}
              onToggleFullscreen={toggleFullscreen}
              className={leftTabOn ? 'translate-x-[416px]' : 'translate-x-0'}
              onControlReady={(sender) => { controlSenderRef.current = sender; }}
            />

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
              <DashboardCameraList
                cameras={cameraList.filter(cam => (!cam.deleted))}
                permissionMap={permissionMap}
                onCameraClick={handleCameraClick}
              />
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
              <div className="w-full h-[55%] overflow-y-hidden border-b border-slate-700">
                {sideTab === 'situation' && <Situation detectingCameras={detectingCameras} cameras={cameraList.filter(cam => (cam.deleted !== 1))} permissionMap={permissionMap} handleCameraSelect={handleCameraClick} />}
                {sideTab === 'history' && <History events={events} setEvents={setEvents} unReadEvents={unReadEvents} readEvents={readEvents} isFetching={isEventFetching} setIsFetching={setIsEventFetching} cameras={cameraList} />}
              </div>

              <div className="w-full h-[45%] overflow-hidden">
                <CameraController
                  cameraID={cameraID}
                  permission={permissionMap[cameraID]}
                  active={cameraList.some(cam => cam.camera_id === cameraID && cam.status === 'active')}
                  controllable={cameraList.some(cam => cam.camera_id === cameraID && cam.controllable === 1)}
                  onControl={(command, params) => controlSenderRef.current?.(command, params)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
    </StreamViewerProvider>
  );
}
