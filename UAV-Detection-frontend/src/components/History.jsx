import { useState, useEffect } from 'react';
import { Camera, Clock, AlertTriangle, CheckCircle2, Target } from 'lucide-react';
import { EventDetailModal } from './EventDetailModal';

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

export function History({ events, setEvents, unReadEvents, readEvents, isFetching, setIsFetching }) {
    const [focusedId, setFocusedId] = useState(null);
    const [eventDetails, setEventDetails] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchEventDetails = async (eventId) => {
        setIsFetching(true);
        const event = events.find(e => e.event_id === eventId);

        const url = `${PROTOCOL}://${HOST}:${HOST_PORT}/api/event/readEventData`;

        const payload = {
            eventId: eventId,
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.success) {
                setEventDetails(result.data);
            } else {
                throw new Error(result.message || "Failed to fetch event details");
            }
        } catch (error) {
            console.error("Error fetching event details:", error);
        } finally {
            setIsFetching(false);
        }

    }

    const markAsRead = async (eventId) => {
        try {
            const response = await fetch(`${PROTOCOL}://${HOST}:${HOST_PORT}/api/event/markEventRead`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: eventId })
            });
            const result = await response.json();
            if (result.success) {
                setEvents(prev => prev.map(e => e.event_id === eventId ? { ...e, seen: 1 } : e));
            } else {
                throw new Error(result.message || "Failed to mark event as read");
            }
        } catch (error) {
            console.error("Error marking event as read:", error);
        }
    }

    const formatTime = (isoString) => {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleTimeString('th-TH', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };

    return (
        <div className="w-full h-full flex flex-col text-white bg-slate-800/30">
            {/* Header */}
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 backdrop-blur-sm sticky top-0 z-10 shadow-md">
                <div className="flex items-center gap-2">
                    <Target className="text-blue-400" size={20} />
                    <h2 className="font-bold text-lg tracking-wide">ประวัติการตรวจพบ</h2>
                </div>
                {unReadEvents.length > 0 && (
                    <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-[11px] font-bold font-mono border border-red-500/30 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        NEW: {unReadEvents.length}
                    </span>
                )}
            </div>

            {/* List Container */}
            <div className='w-full h-full p-4 custom-scrollbar overflow-y-auto flex flex-col gap-3'>
                {events.length === 0 ? (
                    // Empty State
                    <div className="h-40 mt-4 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30">
                        <Camera size={32} className="mb-2 opacity-50" />
                        <p className="text-sm">ยังไม่มีประวัติการตรวจพบ UAV</p>
                    </div>
                ) : (
                    <>
                        {/* Unread Events (NEW) */}
                        {unReadEvents.map((e) => (
                            <div
                                key={`unread-${e.event_id}`}
                                className={`relative w-full p-4 rounded-xl transition-all duration-200 cursor-pointer
                                        'bg-slate-800/80 border border-slate-600 border-l-4 border-l-red-500 shadow-md shadow-red-900/10 hover:bg-slate-700'
                                        ${isFetching ? 'opacity-70 cursor-wait pointer-events-none' : ''}
                                `}
                                onClick={() => {
                                    if (isFetching) return;
                                    markAsRead(e.event_id);
                                    setFocusedId(e.event_id);
                                    fetchEventDetails(e.event_id);
                                    setIsModalOpen(true);
                                }}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-red-500/20 text-red-400 rounded-lg">
                                            <Camera size={18} />
                                        </div>
                                        <div>
                                            <h3 className="text-slate-100 font-bold text-sm flex items-center gap-2">
                                                กล้อง {e.camera_id}
                                                <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                                            </h3>
                                            <p className="text-[10px] text-slate-400 font-mono">EVENT: {e.event_id}</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-1 bg-red-500/10 text-red-400 rounded-md border border-red-500/20">
                                        UNREAD
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/50">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-500 flex items-center gap-1 mb-0.5"><Clock size={10} /> เริ่มตรวจพบ</span>
                                        <span className="text-xs font-mono text-slate-200">{formatTime(e.start_time)}</span>
                                    </div>
                                    <div className="flex flex-col border-l border-slate-700 pl-2">
                                        <span className="text-[10px] text-slate-500 flex items-center gap-1 mb-0.5"><Clock size={10} /> สิ้นสุด</span>
                                        <span className={`text-xs font-mono ${!e.end_time ? 'text-amber-400 animate-pulse' : 'text-slate-200'}`}>
                                            {e.end_time ? formatTime(e.end_time) : 'กำลังตรวจจับ...'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Read Events (History) */}
                        {readEvents.map((e) => (
                            <div
                                key={`read-${e.event_id}`}
                                // 3. ปรับ className ของรายการที่อ่านแล้ว ให้เด่นขึ้นมาเมื่อถูกโฟกัส
                                className={`relative w-full p-4 rounded-xl transition-all duration-200 cursor-pointer
                                    ${focusedId === e.event_id
                                        ? 'bg-slate-700 border border-slate-400 ring-2 ring-blue-500/40 opacity-100 grayscale-0 scale-[1.02] shadow-lg shadow-black/50'
                                        : 'bg-slate-800/40 border border-slate-700/60 opacity-75 grayscale-[30%] hover:opacity-100 hover:grayscale-0'
                                    }
                                    ${isFetching ? 'opacity-70 cursor-wait pointer-events-none' : ''}
                                `}
                                onClick={() => {
                                    if (isFetching) return;
                                    setFocusedId(e.event_id);
                                    fetchEventDetails(e.event_id);
                                    setIsModalOpen(true);
                                }}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-700 text-slate-400 rounded-lg">
                                            <Camera size={18} />
                                        </div>
                                        <div>
                                            <h3 className="text-slate-300 font-semibold text-sm">กล้อง {e.camera_id}</h3>
                                            <p className="text-[10px] text-slate-500 font-mono">EVENT: {e.event_id}</p>
                                        </div>
                                    </div>
                                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-slate-800 text-slate-500 rounded-md border border-slate-700">
                                        <CheckCircle2 size={12} /> CLEARED
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 bg-slate-900/30 p-2.5 rounded-lg border border-slate-800">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-600 mb-0.5">เริ่มตรวจพบ</span>
                                        <span className="text-xs font-mono text-slate-400">{formatTime(e.start_time)}</span>
                                    </div>
                                    <div className="flex flex-col border-l border-slate-800 pl-2">
                                        <span className="text-[10px] text-slate-600 mb-0.5">สิ้นสุด</span>
                                        <span className="text-xs font-mono text-slate-400">{formatTime(e.end_time)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Event Detail Modal */}
            <EventDetailModal
                isOpen={isModalOpen}
                eventDetails={eventDetails}
                eventId={focusedId}
                onClose={() => {setIsModalOpen(false); setFocusedId(null);}}
            />
        </div>
    );
}

export default History;