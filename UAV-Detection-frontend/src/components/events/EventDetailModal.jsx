import { useEffect } from 'react';
import { X } from 'lucide-react';
import { EventDetailViewer } from './EventDetailViewer';

export function EventDetailModal({ isOpen, eventDetails, eventId, onClose }) {
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="w-full max-w-3xl h-[80vh] bg-slate-800 rounded-xl shadow-2xl border border-slate-700 flex flex-col pointer-events-auto animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/60">
                        <h2 className="text-lg font-bold text-slate-100">Event Details</h2>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
                            title="Close (ESC)"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Modal Content */}
                    <div className="flex-1 overflow-hidden">
                        <EventDetailViewer
                            eventDetails={eventDetails}
                            eventId={eventId}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}

export default EventDetailModal;
