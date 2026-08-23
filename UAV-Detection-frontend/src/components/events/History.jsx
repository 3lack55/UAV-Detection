import { useState, useEffect, useMemo } from 'react';
import { Camera, Clock, AlertTriangle, CheckCircle2, Target, ChevronDown } from 'lucide-react';
import { EventDetailModal } from './EventDetailModal';

import { getEventDetails, markEventAsRead } from "../../services/eventApi";

const PAGE_SIZE = 5;

export function History({ events, setEvents, unReadEvents, readEvents, isFetching, setIsFetching, cameras= [] }) {
    const [focusedId, setFocusedId] = useState(null);
    const [eventDetails, setEventDetails] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [visibleReadCount, setVisibleReadCount] = useState(PAGE_SIZE);

    useEffect(() => {
        setVisibleReadCount(PAGE_SIZE);
    }, [readEvents.length]);

    const visibleReadEvents = readEvents.slice(0, visibleReadCount);
    const hasMoreRead = readEvents.length > visibleReadCount;

    const fetchEventDetails = async (eventId) => {
        setIsFetching(true);
        try {
            const result = await getEventDetails(eventId);
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
            const result = await markEventAsRead(eventId);
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
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            timeZone: 'Asia/Bangkok'
        });
    };

    const cameraMap = useMemo(() => {
        return cameras.reduce((map, camera) => {
            if (camera && camera.camera_id != null) {
                map[camera.camera_id] = camera.camera_name || `Camera ${camera.camera_id}`;
            }
            return map;
        }, {});
    }, [cameras]);

    const getCameraName = (cameraId) => {
        return cameraMap[cameraId] || `Camera ${cameraId}`;
    };

    return (

        <div className="w-full h-full flex flex-col text-white bg-slate-800/30">

            {/* List Container */}
            <div className='w-full h-full p-3 custom-scrollbar overflow-y-auto flex flex-col gap-2'>
                {events.length === 0 ? (
                    // Empty State
                    <div className="h-40 mt-4 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/30">
                        <Camera size={32} className="mb-2 opacity-50" />
                        <p className="text-sm">ยังไม่มีประวัติการตรวจพบ UAV</p>
                    </div>
                ) : (
                    <>
                        {/* Unread Events (NEW) - always shown in full, these are active alerts */}
                        {unReadEvents.map((e) => (
                            <div
                                key={`unread-${e.event_id}`}
                                className={`relative w-full p-2.5 rounded-lg transition-all duration-200 cursor-pointer
                                        bg-slate-800/80 border border-red-900 shadow-md shadow-red-900/10 hover:bg-slate-700
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
                                <div className="flex justify-between items-center mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-red-500/20 text-red-400 rounded-md">
                                            <Camera size={14} />
                                        </div>
                                        <div>
                                            <h3 className="text-slate-100 font-bold text-xs truncate max-w-48 flex items-center gap-1.5">
                                                {getCameraName(e.camera_id)}
                                                <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                            </h3>
                                            <p className="text-[9px] text-slate-400 font-mono">EVENT: {e.event_id}</p>
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded border border-red-500/20 whitespace-nowrap">
                                        ยังไม่ได้ดู
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-2 text-[11px] font-mono bg-slate-900/50 px-2 py-1 rounded-md border border-slate-700/50">
                                    <span className="flex items-center gap-1 text-slate-200"><Clock size={10} className="text-slate-500" /> {formatTime(e.start_time)}</span>
                                    <span className="text-slate-600">→</span>
                                    <span className={!e.end_time ? 'text-amber-400 animate-pulse' : 'text-slate-200'}>
                                        {e.end_time ? formatTime(e.end_time) : 'กำลังตรวจจับ...'}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {/* Read Events (History) - paginated */}
                        {visibleReadEvents.map((e) => (
                            <div
                                key={`read-${e.event_id}`}
                                className={`relative w-full p-2.5 rounded-lg transition-all duration-200 cursor-pointer
                                    ${focusedId === e.event_id
                                        ? 'bg-slate-700 border border-slate-400 ring-2 ring-blue-500/40 opacity-100 grayscale-0 shadow-lg shadow-black/50'
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
                                <div className="flex justify-between items-center mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-slate-700 text-slate-400 rounded-md">
                                            <Camera size={14} />
                                        </div>
                                        <div>
                                            <h3 className="text-slate-300 font-semibold text-xs truncate max-w-48">{getCameraName(e.camera_id)}</h3>
                                            <p className="text-[9px] text-slate-500 font-mono">EVENT: {e.event_id}</p>
                                        </div>
                                    </div>
                                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded border border-slate-700 whitespace-nowrap">
                                        <CheckCircle2 size={10} /> ดูแล้ว
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-2 text-[11px] font-mono bg-slate-900/30 px-2 py-1 rounded-md border border-slate-800 text-slate-400">
                                    <span className="flex items-center gap-1"><Clock size={10} className="text-slate-600" /> {formatTime(e.start_time)}</span>
                                    <span className="text-slate-700">→</span>
                                    <span>{formatTime(e.end_time)}</span>
                                </div>
                            </div>
                        ))}

                        {/* Pagination control for read history */}
                        {readEvents.length > 0 && (
                            <div className="flex flex-col items-center gap-1.5 pt-1 pb-2">
                                {hasMoreRead && (
                                    <button
                                        onClick={() => setVisibleReadCount(c => c + PAGE_SIZE)}
                                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-slate-800/70 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-1.5 transition-colors"
                                    >
                                        <ChevronDown size={13} />
                                        โหลดเพิ่มเติม
                                    </button>
                                )}
                                <span className="text-[10px] text-slate-600">
                                    แสดง {visibleReadEvents.length} จาก {readEvents.length} รายการ
                                </span>
                            </div>
                        )}
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