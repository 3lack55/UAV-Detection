import { useState } from 'react';
import { 
  Camera, 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, 
  Plus, Minus,
  Lock
} from 'lucide-react';

export function CameraController({ cameraID, permission = "", onControl }) {
  const [zoom, setZoom] = useState(1);

  // ตรวจสอบสิทธิ์การควบคุม
  const hasControl = permission === "admin" || permission === "operator";

  const handleCommand = (command) => {
    if (!hasControl) return;
    if (typeof onControl === 'function') {
      onControl(command);
    }
  };

  // สไตล์ปุ่มกดทิศทาง
  const ControlBtn = ({ children, className = "", onClick }) => (
    <button 
      type="button"
      onClick={onClick}
      disabled={!hasControl}
      className={`p-3 bg-slate-700/50 transition-all rounded-lg border border-slate-600 shadow-inner 
        ${hasControl ? 'hover:bg-blue-600/50 active:scale-90 cursor-pointer' : 'opacity-40 cursor-not-allowed'} 
        ${className}`}
    >
      {children}
    </button>
  );

  return (
    <div className="w-full h-full flex flex-col bg-slate-900/80 text-slate-100 shadow-2xl border border-slate-700/50 backdrop-blur-md">
      {/* Header */}
      <div className="w-full h-[47px] p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-400" />
          <h2 className="font-bold text-sm tracking-widest uppercase text-slate-300">CAM-{cameraID}</h2>
        </div>
        
        {/* Badge สิทธิ์การใช้งาน */}
        <div className="flex gap-2">
          {hasControl ? (
            <span className="text-[10px] font-mono bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
               CONTROL ACTIVE
            </span>
          ) : (
            <span className="text-[10px] font-mono bg-red-500/10 px-2 py-1 rounded border border-red-500/30 text-red-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> UNAUTHORIZED
            </span>
          )}
        </div>
      </div>

      {/* ส่วนควบคุมหลัก (ใส่ Relative เพื่อทำ Overlay) */}
      <div className="flex relative p-2 overflow-y-auto custom-scrollbar items-center justify-center w-full h-full">
        
        {/* === Locked Overlay === */}
        {!hasControl && (
          <div className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center transition-all duration-500">
            <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-2 scale-110">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                    <Lock className="w-5 h-5 text-red-500" />
                </div>
                <div className="text-center">
                    <p className="text-[11px] font-bold text-white uppercase tracking-widest">Controls Locked</p>
                    <p className="text-[9px] text-slate-400">Insufficient Permission Level</p>
                </div>
            </div>
          </div>
        )}

        {/* ส่วนควบคุมทิศทาง (PTZ) */}
        <div className={`flex flex-col items-center justify-center space-y-4 transition-opacity duration-300 ${!hasControl ? 'opacity-30' : 'opacity-100'}`}>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Directional Control</p>
          <div className="grid grid-cols-3 gap-2">
            <div />
            <ControlBtn onClick={() => handleCommand('up')}><ChevronUp className="w-4 h-4" /></ControlBtn>
            <div />
            <ControlBtn onClick={() => handleCommand('left')}><ChevronLeft className="w-4 h-4" /></ControlBtn>
            <div className="bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center">
                <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] ${hasControl ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`} />
            </div>
            <ControlBtn onClick={() => handleCommand('right')}><ChevronRight className="w-4 h-4" /></ControlBtn>
            <div />
            <ControlBtn onClick={() => handleCommand('down')}><ChevronDown className="w-4 h-4" /></ControlBtn>
            <div />
          </div>
        </div>

        {/* ส่วนควบคุม Zoom */}
        {/* <div className={`flex flex-col justify-center space-y-6 transition-opacity duration-300 ${!hasControl ? 'opacity-30' : 'opacity-100'}`}>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-slate-500 font-bold">
              <span>ZOOM LEVEL</span>
              <span className="text-blue-400 font-mono">{zoom.toFixed(1)}x</span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                disabled={!hasControl}
                onClick={() => setZoom(Math.max(1, zoom - 1))} 
                className="p-1 hover:text-blue-400 disabled:text-slate-700"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input 
                type="range" 
                min="1" max="4" step="0.1" 
                value={zoom} 
                disabled={!hasControl}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-blue-500 bg-slate-700 ${!hasControl && 'cursor-not-allowed opacity-50'}`} 
              />
              <button 
                disabled={!hasControl}
                onClick={() => setZoom(Math.min(4, zoom + 1))} 
                className="p-1 hover:text-blue-400 disabled:text-slate-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}

export default CameraController;