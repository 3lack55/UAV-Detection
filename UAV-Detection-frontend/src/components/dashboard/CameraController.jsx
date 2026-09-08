import { useEffect, useCallback, useState, useRef, memo } from 'react';
import {
  Camera,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Plus, Minus,
  Lock,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Video,
  Power,
  Move
} from 'lucide-react';
import { useStreamViewer } from '../../context/useStreamViewer';
import { Supervisor } from '../stream/Supervisor';

const RESOLUTION_PRESETS = [
  { label: '854x480 (480p)', width: 854, height: 480 },
  { label: '960x540', width: 960, height: 540 },
  { label: '1280x720 (720p)', width: 1280, height: 720 },
];

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
      <span className="text-xs text-slate-400">ทิศทาง: {handleHeadingUpdate('installFace', heading?.installFace?.toFixed(0))}</span>
      <span className="text-xs text-slate-400">ระนาบ: {handleHeadingUpdate('pan', heading?.currentPan?.toFixed(0))}</span>
      <span className="text-xs text-slate-400">ก้มเงย: {handleHeadingUpdate('tilt', heading?.currentTilt?.toFixed(0))}</span>
    </div>
  );
});

function CameraControllerInner({ cameraID, permission = "", onControl, active = false, controllable = false }) {
  const [panelSection, setPanelSection] = useState("ptz");
  const [controlTypes, setControlTypes] = useState("continuously");
  const [degree, setDegree] = useState(5);
  const [degreeInput, setDegreeInput] = useState("5");
  const [feedback, setFeedback] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [resolution, setResolution] = useState(RESOLUTION_PRESETS[1]);
  const [quality, setQuality] = useState(50);
  const [qualityInput, setQualityInput] = useState("50");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [confidence, setConfidence] = useState(30);
  const [confidenceInput, setConfidenceInput] = useState("30");
  const [frameSkip, setFrameSkip] = useState(8);
  const [frameSkipInput, setFrameSkipInput] = useState("8");
  const streamViewer = useStreamViewer() || {};
  const serverFeedback = streamViewer.controlFeedback;
  const metaData = streamViewer.metaData;

  const hasControl = permission === "admin" || permission === "operator";
  const isReady = hasControl && active;
  const controlsDisabled = !isReady || isSending;

  const hasSyncedSettingsRef = useRef(false);

  useEffect(() => {
    hasSyncedSettingsRef.current = false;
  }, [cameraID]);

  useEffect(() => {
    if (hasSyncedSettingsRef.current) return;

    const streamConfig = metaData?.streamConfig;
    const ai = metaData?.ai;
    if (!streamConfig && !ai) return;

    if (streamConfig) {
      if (typeof streamConfig.width === 'number' && typeof streamConfig.height === 'number') {
        const preset = RESOLUTION_PRESETS.find((p) => p.width === streamConfig.width && p.height === streamConfig.height);
        setResolution(preset || { label: `${streamConfig.width}x${streamConfig.height}`, width: streamConfig.width, height: streamConfig.height });
      }
      if (typeof streamConfig.quality === 'number') {
        setQuality(streamConfig.quality);
        setQualityInput(String(streamConfig.quality));
      }
    }

    if (ai) {
      if (typeof ai.enabled === 'boolean') setAiEnabled(ai.enabled);
      if (typeof ai.confidence === 'number') {
        const pct = Math.round(ai.confidence * 100);
        setConfidence(pct);
        setConfidenceInput(String(pct));
      }
      if (typeof ai.frameSkip === 'number') {
        setFrameSkip(ai.frameSkip);
        setFrameSkipInput(String(ai.frameSkip));
      }
    }

    hasSyncedSettingsRef.current = true;
  }, [metaData]);

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

  const normalizeQuality = useCallback((value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.min(100, Math.max(1, Math.round(parsed)));
  }, []);

  const updateQualityInput = useCallback((rawValue) => {
    setQualityInput(String(rawValue));

    const normalized = normalizeQuality(rawValue);
    if (normalized === null) {
      setFeedback({ type: 'error', message: 'กรุณากรอกตัวเลข 1–100' });
      return;
    }

    setQuality(normalized);
    setFeedback(null);
  }, [normalizeQuality]);

  const commitQuality = useCallback(() => {
    const normalized = normalizeQuality(qualityInput);
    if (normalized === null) {
      setQualityInput(String(quality));
      setFeedback({ type: 'error', message: 'กรุณากรอกตัวเลข 1–100' });
      return;
    }

    setQuality(normalized);
    setQualityInput(String(normalized));
    setFeedback(null);
  }, [normalizeQuality, qualityInput, quality]);

  const normalizeConfidence = useCallback((value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.min(100, Math.max(0, Math.round(parsed)));
  }, []);

  const updateConfidenceInput = useCallback((rawValue) => {
    setConfidenceInput(String(rawValue));

    const normalized = normalizeConfidence(rawValue);
    if (normalized === null) {
      setFeedback({ type: 'error', message: 'กรุณากรอกตัวเลข 0–100' });
      return;
    }

    setConfidence(normalized);
    setFeedback(null);
  }, [normalizeConfidence]);

  const commitConfidence = useCallback(() => {
    const normalized = normalizeConfidence(confidenceInput);
    if (normalized === null) {
      setConfidenceInput(String(confidence));
      setFeedback({ type: 'error', message: 'กรุณากรอกตัวเลข 0–100' });
      return;
    }

    setConfidence(normalized);
    setConfidenceInput(String(normalized));
    setFeedback(null);
  }, [normalizeConfidence, confidenceInput, confidence]);

  const normalizeFrameSkip = useCallback((value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.min(60, Math.max(1, Math.round(parsed)));
  }, []);

  const updateFrameSkipInput = useCallback((rawValue) => {
    setFrameSkipInput(String(rawValue));

    const normalized = normalizeFrameSkip(rawValue);
    if (normalized === null) {
      setFeedback({ type: 'error', message: 'กรุณากรอกตัวเลข 1–60' });
      return;
    }

    setFrameSkip(normalized);
    setFeedback(null);
  }, [normalizeFrameSkip]);

  const commitFrameSkip = useCallback(() => {
    const normalized = normalizeFrameSkip(frameSkipInput);
    if (normalized === null) {
      setFrameSkipInput(String(frameSkip));
      setFeedback({ type: 'error', message: 'กรุณากรอกตัวเลข 1–60' });
      return;
    }

    setFrameSkip(normalized);
    setFrameSkipInput(String(normalized));
    setFeedback(null);
  }, [normalizeFrameSkip, frameSkipInput, frameSkip]);

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
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error?.message || 'ส่งคำสั่งไม่สำเร็จ กรุณาลองใหม่'
      });
    } finally {
      setIsSending(false);
    }
  }, [hasControl, active, onControl]);

  const handleApplyStreamSettings = useCallback(() => {
    handleCommand({ controlType: 'stream_settings', width: resolution.width, height: resolution.height, quality });
  }, [handleCommand, resolution, quality]);

  const handleToggleAI = useCallback(() => {
    const next = !aiEnabled;
    setAiEnabled(next);
    handleCommand({ controlType: 'ai_toggle', enabled: next });
  }, [handleCommand, aiEnabled]);

  const handleApplyAISettings = useCallback(() => {
    handleCommand({ controlType: 'ai_settings', confidence: confidence / 100, frameSkip });
  }, [handleCommand, confidence, frameSkip]);

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
    if (!serverFeedback?.type || !serverFeedback?.success && !serverFeedback?.reason) {
      return;
    }

    const severity = serverFeedback.success ? 'success' : 'error';
    const message = serverFeedback.message || serverFeedback.reason || 'ไม่มีข้อความตอบกลับจากเซิร์ฟเวอร์';
    setFeedback({ type: severity, message });

    const timer = window.setTimeout(() => {
      setFeedback(null);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [serverFeedback]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-900/80 text-slate-100 shadow-2xl border border-slate-700/50 backdrop-blur-md">
      <div className="w-full h-[47px] p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-400" />
          <h2 className="font-bold text-sm tracking-widest uppercase text-slate-300">CAM-{cameraID}</h2>
          <div className="w-0.5 h-6 bg-gray-600 rounded-full"></div>
          <Supervisor cameraId={cameraID}/>
        </div>

        <div className="flex gap-2">
          {active ? (
            hasControl ? (
              controllable ? (
                <span className="text-[10px] bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                  การควบคุมพร้อมใช้งาน
                </span>
              ) : (
                <span className="text-[10px] bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/30 text-yellow-400 flex items-center gap-1">
                  การควบคุมถูกปิดใช้งาน
                </span>
              )
            ) : (
              <span className="text-[10px] bg-red-500/10 px-2 py-1 rounded border border-red-500/30 text-red-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> ไม่ได้รับสิทธิ์ควบคุม
              </span>
            )
          ) : (
            <span className="text-[10px] bg-slate-500/10 px-2 py-1 rounded border border-slate-500/30 text-slate-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> <span>ไม่พร้อมใช้งาน</span>
            </span>
          )}
        </div>
      </div>

      <div className="w-full flex border-b border-slate-700 bg-slate-800/30">
        <button
          type="button"
          onClick={() => setPanelSection('ptz')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold uppercase tracking-widest transition ${panelSection === 'ptz' ? 'bg-slate-700/60 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:bg-slate-700/30'}`}
        >
          <Move className="w-3.5 h-3.5" /> ควบคุมกล้อง
        </button>
        <button
          type="button"
          onClick={() => setPanelSection('stream')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold uppercase tracking-widest transition ${panelSection === 'stream' ? 'bg-slate-700/60 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:bg-slate-700/30'}`}
        >
          <Video className="w-3.5 h-3.5" /> สตรีมและ AI
        </button>
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
        ) : panelSection === 'ptz' ? (
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
        ) : null}

        {panelSection === 'ptz' && controlTypes === 'continuously' && (
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

        {panelSection === 'ptz' && controlTypes === 'absolutely' && (
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

        {panelSection === 'stream' && (isReady ? (
          <div className="w-full h-full px-5 py-5 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
            <section className="flex flex-col gap-3">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-slate-400">ความละเอียด &amp; คุณภาพ</h3>

              <label className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">ความละเอียด</span>
                <select
                  value={resolution.label}
                  onChange={(event) => {
                    const preset = RESOLUTION_PRESETS.find((p) => p.label === event.target.value);
                    if (preset) setResolution(preset);
                  }}
                  disabled={controlsDisabled}
                  className="bg-slate-800 text-slate-300 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 text-xs rounded-md px-2 py-1.5 disabled:opacity-40"
                >
                  {(RESOLUTION_PRESETS.some((p) => p.label === resolution.label) ? RESOLUTION_PRESETS : [resolution, ...RESOLUTION_PRESETS]).map((preset) => (
                    <option key={preset.label} value={preset.label}>{preset.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">คุณภาพ (1–100)</span>
                <div className="flex gap-2 items-center">
                  <button type="button" onClick={() => updateQualityInput(quality - 5)} disabled={controlsDisabled} className="disabled:opacity-40 disabled:cursor-not-allowed">
                    <Minus className="w-4 h-4 cursor-pointer text-slate-400 hover:text-white" />
                  </button>
                  <input
                    type="text"
                    value={qualityInput}
                    onChange={(event) => updateQualityInput(event.target.value)}
                    onBlur={commitQuality}
                    onKeyDown={(event) => event.key === 'Enter' && commitQuality()}
                    disabled={controlsDisabled}
                    className="bg-slate-800 text-slate-400 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 w-14 text-center rounded-md py-1"
                  />
                  <button type="button" onClick={() => updateQualityInput(quality + 5)} disabled={controlsDisabled} className="disabled:opacity-40 disabled:cursor-not-allowed">
                    <Plus className="w-4 h-4 cursor-pointer text-slate-400 hover:text-white" />
                  </button>
                </div>
              </label>

              <button
                type="button"
                onClick={handleApplyStreamSettings}
                disabled={controlsDisabled}
                className="w-full text-xs font-semibold rounded-md py-2 bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:bg-blue-600/50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ส่งคำสั่งความละเอียด/คุณภาพ
              </button>
            </section>

            <section className="flex flex-col gap-3 pt-4 border-t border-slate-700/60">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-slate-400">ระบบ AI ตรวจจับ</h3>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">เปิด/ปิดการตรวจจับ</span>
                <button
                  type="button"
                  onClick={handleToggleAI}
                  disabled={controlsDisabled}
                  className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest rounded-full px-3 py-1.5 border transition disabled:opacity-40 disabled:cursor-not-allowed
                    ${aiEnabled ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-slate-700/60 border-slate-600 text-slate-400'}`}
                >
                  <Power className="w-3 h-3" /> {aiEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </button>
              </div>

              <label className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">Confidence (%)</span>
                <div className="flex gap-2 items-center">
                  <button type="button" onClick={() => updateConfidenceInput(confidence - 5)} disabled={controlsDisabled} className="disabled:opacity-40 disabled:cursor-not-allowed">
                    <Minus className="w-4 h-4 cursor-pointer text-slate-400 hover:text-white" />
                  </button>
                  <input
                    type="text"
                    value={confidenceInput}
                    onChange={(event) => updateConfidenceInput(event.target.value)}
                    onBlur={commitConfidence}
                    onKeyDown={(event) => event.key === 'Enter' && commitConfidence()}
                    disabled={controlsDisabled}
                    className="bg-slate-800 text-slate-400 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 w-14 text-center rounded-md py-1"
                  />
                  <button type="button" onClick={() => updateConfidenceInput(confidence + 5)} disabled={controlsDisabled} className="disabled:opacity-40 disabled:cursor-not-allowed">
                    <Plus className="w-4 h-4 cursor-pointer text-slate-400 hover:text-white" />
                  </button>
                </div>
              </label>

              <label className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400" title="ประมวลผล AI ทุกกี่เฟรม (ยิ่งมากยิ่งเบา แต่ตรวจจับช้าลง)">Frame Skip</span>
                <div className="flex gap-2 items-center">
                  <button type="button" onClick={() => updateFrameSkipInput(frameSkip - 1)} disabled={controlsDisabled} className="disabled:opacity-40 disabled:cursor-not-allowed">
                    <Minus className="w-4 h-4 cursor-pointer text-slate-400 hover:text-white" />
                  </button>
                  <input
                    type="text"
                    value={frameSkipInput}
                    onChange={(event) => updateFrameSkipInput(event.target.value)}
                    onBlur={commitFrameSkip}
                    onKeyDown={(event) => event.key === 'Enter' && commitFrameSkip()}
                    disabled={controlsDisabled}
                    className="bg-slate-800 text-slate-400 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 w-14 text-center rounded-md py-1"
                  />
                  <button type="button" onClick={() => updateFrameSkipInput(frameSkip + 1)} disabled={controlsDisabled} className="disabled:opacity-40 disabled:cursor-not-allowed">
                    <Plus className="w-4 h-4 cursor-pointer text-slate-400 hover:text-white" />
                  </button>
                </div>
              </label>

              <button
                type="button"
                onClick={handleApplyAISettings}
                disabled={controlsDisabled}
                className="w-full text-xs font-semibold rounded-md py-2 bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:bg-blue-600/50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ส่งคำสั่งตั้งค่า AI
              </button>
            </section>
          </div>
        ) : null)}

        {panelSection === 'ptz' && <HeadingReadout />}

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