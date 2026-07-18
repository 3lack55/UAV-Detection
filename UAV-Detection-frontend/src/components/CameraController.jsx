import { useEffect, useCallback, useState, memo } from 'react';
import {
  Camera,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Plus, Minus,
  Lock,
  AlertCircle,
  CheckCircle2,
  LoaderCircle
} from 'lucide-react';
import { useStreamViewer } from '../context/StreamViwerContext';

const ControlBtn = memo(function ControlBtn({ children, className = '', onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`p-3 bg-slate-700/50 transition-all rounded-lg border border-slate-600 shadow-inner
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-blue-600/50 active:scale-90 cursor-pointer'}
        ${className}`}
    >
      {children}
    </button>
  );
});

const HeadingReadout = memo(function HeadingReadout() {
  const streamViewer = useStreamViewer() || {};
  const heading = streamViewer.metaData?.heading;

  const handleHeadingUpdate = (type, value) => {
    if (type === 'pan') {
      if (value < 0) {
        return `ซ้าย ${Math.abs(value)}°`;
      } else if (value > 0) {
        return `ขวา ${value}°`;
      } else {
        return `ตรง 0°`;
      }
    } else if (type === 'tilt') {
      if (value < 0) {
        return `เงย ${Math.abs(value)}°`;
      } else if (value > 0) {
        return `ก้ม ${value}°`;
      } else {
        return `ตรง 0°`;
      }
    } else if (type === 'installFace') {
      return `${value}°`;
    }
  };

  return (
    <div className="absolute bottom-0 w-full flex items-center justify-between p-1 z-10">
      <span className="text-xs text-slate-400">ทิศทาง: {handleHeadingUpdate('installFace', heading?.installFace)}</span>
      <span className="text-xs text-slate-400">ระนาบ: {handleHeadingUpdate('pan', heading?.currentPan)}</span>
      <span className="text-xs text-slate-400">ก้มเงย: {handleHeadingUpdate('tilt', heading?.currentTilt)}</span>
    </div>
  );
});

function CameraControllerInner({ cameraID, permission = "", onControl, active = false, controllable = false }) {
  const [controlTypes, setControlTypes] = useState("continuously");
  const [degree, setDegree] = useState(5);
  const [degreeInput, setDegreeInput] = useState("5");
  const [feedback, setFeedback] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const hasControl = permission === "admin" || permission === "operator";
  const isReady = hasControl && active;
  const controlsDisabled = !isReady || isSending;

  const normalizeDegree = useCallback((value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;

    const rounded = Math.round(parsed / 5) * 5;
    return Math.min(45, Math.max(0, rounded));
  }, []);

  const updateDegree = useCallback((rawValue) => {
    setDegreeInput(String(rawValue));

    const normalized = normalizeDegree(rawValue);
    if (normalized === null) {
      setFeedback({ type: 'error', message: 'กรุณากรอกตัวเลข 0–45 องศา' });
      return;
    }

    setDegree(normalized);
    setFeedback(null);
  }, [normalizeDegree]);

  const commitDegree = useCallback(() => {
    const normalized = normalizeDegree(degreeInput);
    if (normalized === null) {
      setDegreeInput(String(degree));
      setFeedback({ type: 'error', message: 'กรุณากรอกตัวเลข 0–45 องศา' });
      return;
    }

    setDegree(normalized);
    setDegreeInput(String(normalized));
    setFeedback(null);
  }, [normalizeDegree, degreeInput, degree]);

  const handleCommand = useCallback(async (command) => {
    if (!hasControl) {
      setFeedback({ type: 'error', message: 'คุณไม่มีสิทธิ์ควบคุมกล้องนี้' });
      return;
    }

    if (!active) {
      setFeedback({ type: 'error', message: 'กล้องยังไม่พร้อมรับคำสั่ง' });
      return;
    }

    try {
      setIsSending(true);
      setFeedback({ type: 'info', message: 'กำลังส่งคำสั่ง…' });

      if (typeof onControl === 'function') {
        const result = onControl(command);
        if (result && typeof result.then === 'function') {
          await result;
        }
      }

      setFeedback({ type: 'success', message: 'ส่งคำสั่งเรียบร้อยแล้ว' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'ส่งคำสั่งไม่สำเร็จ กรุณาลองใหม่'
      });
    } finally {
      setIsSending(false);
    }
  }, [hasControl, active, onControl]);

  const feedbackStyles = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    error: 'bg-red-500/10 border-red-500/30 text-red-300',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-300'
  };

  const feedbackIcon = {
    success: <CheckCircle2 className="w-3.5 h-3.5" />,
    error: <AlertCircle className="w-3.5 h-3.5" />,
    info: <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
  };

  useEffect(() => {
    if (!feedback || feedback.type !== 'success') {
      return;
    }

    const timer = window.setTimeout(() => {
      setFeedback(null);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [feedback]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-900/80 text-slate-100 shadow-2xl border border-slate-700/50 backdrop-blur-md">
      <div className="w-full h-[47px] p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-400" />
          <h2 className="font-bold text-sm tracking-widest uppercase text-slate-300">CAM-{cameraID}</h2>
        </div>

        <div className="flex gap-2">
          {active ? (
            hasControl ? (
              controllable ? (
                <span className="text-[10px] font-mono bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                  การควบคุมพร้อมใช้งาน
                </span>
              ) : (
                <span className="text-[10px] font-mono bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/30 text-yellow-400 flex items-center gap-1">
                  การควบคุมถูกปิดใช้งาน
                </span>
              )
            ) : (
              <span className="text-[10px] font-mono bg-red-500/10 px-2 py-1 rounded border border-red-500/30 text-red-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> ไม่ได้รับสิทธิ์ควบคุม
              </span>
            )
          ) : (
            <span className="text-[10px] font-mono bg-slate-500/10 px-2 py-1 rounded border border-slate-500/30 text-slate-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> <span>ไม่พร้อมใช้งาน</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center relative overflow-y-auto custom-scrollbar flex-1">
        {!isReady ? (
          <div className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center transition-all duration-500">
            <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-2 scale-110">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <Lock className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-center">
                <p className="text-[11px] font-bold text-white uppercase tracking-widest">
                  {active ? 'Controls Locked' : 'Camera Unavailable'}
                </p>
                <p className="text-[9px] text-slate-400">
                  {active ? 'ไม่มีสิทธิ์การควบคุม' : 'กล้องยังไม่พร้อมรับคำสั่ง'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          controllable ? (
            <div className="absolute top-0 left-0 right-0 flex items-center gap-2 px-4 py-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">โหมด: </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setControlTypes('continuously')}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${controlTypes === 'continuously' ? 'bg-slate-600 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'}`}
                >
                  ต่อเนื่อง
                </button>
                <button
                  type="button"
                  onClick={() => setControlTypes('absolutely')}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${controlTypes === 'absolutely' ? 'bg-slate-600 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'}`}
                >
                  กำหนดมุม
                </button>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center transition-all duration-500">
              <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-2 scale-110">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                  <Lock className="w-5 h-5 text-red-500" />
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-bold text-white uppercase tracking-widest">
                    Camera Control Inactive
                  </p>
                  <p className="text-[9px] text-slate-400">
                    กล้องนี้ไม่สามารถควบคุมได้
                  </p>
                </div>
              </div>
            </div>
          )
        )}

        {controlTypes === 'continuously' && (
          <div className="w-full px-4 flex flex-col items-center justify-between gap-2">
            <div className="w-full flex items-center justify-between p-2">
              <span className="text-sm text-slate-400">องศาต่อการกด</span>
              <div className="flex gap-1 items-center justify-center">
                <button
                  type="button"
                  onClick={() => updateDegree(degree - 5)}
                  disabled={controlsDisabled}
                  className="disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Minus className="w-4 h-4 cursor-pointer text-slate-400 hover:text-white" />
                </button>
                <input
                  type="text"
                  min="0"
                  max="45"
                  value={degree}
                  onChange={(event) => updateDegree(event.target.value)}
                  onBlur={commitDegree}
                  onKeyDown={(event) => event.key === 'Enter' && commitDegree()}
                  disabled={controlsDisabled}
                  className="bg-slate-800 text-slate-400 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 w-16 text-center rounded-md"
                />
                <button
                  type="button"
                  onClick={() => updateDegree(degree + 5)}
                  disabled={controlsDisabled}
                  className="disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4 cursor-pointer text-slate-400 hover:text-white" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center w-full h-full gap-4">
              <div className={`transition-opacity duration-300 ${!isReady ? 'opacity-30' : 'opacity-100'}`}>
                <div className="grid grid-cols-3 gap-2">
                  <div />
                  <ControlBtn disabled={controlsDisabled} onClick={() => handleCommand({ controlType: controlTypes, direction: 'up', deg: degree })}>
                    <ChevronUp className="w-4 h-4" />
                  </ControlBtn>
                  <div />
                  <ControlBtn disabled={controlsDisabled} onClick={() => handleCommand({ controlType: controlTypes, direction: 'left', deg: degree })}>
                    <ChevronLeft className="w-4 h-4" />
                  </ControlBtn>
                  <div className="bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center">
                    <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] ${isReady ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`} />
                  </div>
                  <ControlBtn disabled={controlsDisabled} onClick={() => handleCommand({ controlType: controlTypes, direction: 'right', deg: degree })}>
                    <ChevronRight className="w-4 h-4" />
                  </ControlBtn>
                  <div />
                  <ControlBtn disabled={controlsDisabled} onClick={() => handleCommand({ controlType: controlTypes, direction: 'down', deg: degree })}>
                    <ChevronDown className="w-4 h-4" />
                  </ControlBtn>
                  <div />
                </div>
              </div>
            </div>
          </div>
        )}

        {controlTypes === 'absolutely' && (
          <div className="flex items-center justify-center w-full h-full gap-4 mt-2">
            <div className={`transition-opacity duration-300 ${!isReady ? 'opacity-30' : 'opacity-100'}`}>
              <div className="grid grid-cols-5 grid-rows-5 gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <div className={`col-start-3 border-slate-600 row-start-3 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'reset', pan: 0, tilt: 0 })}>รีเซ็ต</div>
                <div className={`col-start-2 border-slate-600 row-start-3 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'left45', pan: -45, tilt: 0 })}>L45°</div>
                <div className={`col-start-1 border-slate-600 row-start-3 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'left90', pan: -90, tilt: 0 })}>L90°</div>
                <div className={`col-start-4 border-slate-600 row-start-3 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'right45', pan: 45, tilt: 0 })}>R45°</div>
                <div className={`col-start-5 border-slate-600 row-start-3 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'right90', pan: 90, tilt: 0 })}>R90°</div>
                <div className={`col-start-3 border-slate-600 row-start-2 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'up15', pan: 0, tilt: -15 })}>T15°</div>
                <div className={`col-start-3 border-slate-600 row-start-1 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'up45', pan: 0, tilt: -45 })}>T45°</div>
                <div className={`col-start-3 border-slate-600 row-start-4 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'down15', pan: 0, tilt: 15 })}>B15°</div>
                <div className={`col-start-3 border-slate-600 row-start-5 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'down45', pan: 0, tilt: 45 })}>B45°</div>
                <div className={`col-start-2 border-slate-600 row-start-2 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'left45-top15', pan: -45, tilt: -15 })}>L45° T15°</div>
                <div className={`col-start-1 border-slate-600 row-start-1 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'left90-top45', pan: -90, tilt: -45 })}>L90° T45°</div>
                <div className={`col-start-4 border-slate-600 row-start-2 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'right45-top15', pan: 45, tilt: -15 })}>R45° T15°</div>
                <div className={`col-start-5 border-slate-600 row-start-1 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'right90-top45', pan: 90, tilt: -45 })}>R90° T45°</div>
                <div className={`col-start-2 border-slate-600 row-start-4 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'left45-bottom15', pan: -45, tilt: 15 })}>L45° B15°</div>
                <div className={`col-start-1 border-slate-600 row-start-5 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'left90-bottom45', pan: -90, tilt: 45 })}>L90° B45°</div>
                <div className={`col-start-4 border-slate-600 row-start-4 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'right45-bottom15', pan: 45, tilt: 15 })}>R45° B15°</div>
                <div className={`col-start-5 border-slate-600 row-start-5 border rounded-md flex justify-center items-center p-2 ${isReady ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed'}`} onClick={() => handleCommand({ controlType: controlTypes, direction: 'right90-bottom45', pan: 90, tilt: 45 })}>R90° B45°</div>
              </div>
            </div>
          </div>
        )}

        <HeadingReadout />

        {feedback && (
          <div className={`absolute top-1 right-1 z-30 flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-medium shadow-lg ${feedbackStyles[feedback.type] || feedbackStyles.info}`}>
            {feedbackIcon[feedback.type] || feedbackIcon.info}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const CameraController = memo(CameraControllerInner);

export default CameraController;