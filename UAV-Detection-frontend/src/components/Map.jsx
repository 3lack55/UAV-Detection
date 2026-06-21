// Map.jsx
import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { useWebSocket } from '../context/websocketContext';

// --- 1. Custom Hook: แยก Logic การโหลด Script ---
const useLeafletLoader = () => {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // ถ้าโหลดอยู่แล้ว (เช่น จากหน้าอื่น) ให้ set true เลย
        if (window.L) {
            setIsLoaded(true);
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
        script.async = true;
        script.onload = () => setIsLoaded(true);
        document.head.appendChild(script);

        return () => {
            // ใน Production จริง อาจจะไม่ remove script ออก เพราะอาจใช้ซ้ำ
            // แต่ remove link css ได้ถ้าต้องการ cleanup
        };
    }, []);

    return isLoaded;
};

// --- Constants & Helpers ---
const COLORS = { active: '#22DD5D', warning: '#FACC15', threat: '#FF4444', inactive: '#6D7280', maintenance: '#F4D03F' };
const STATUS_TEXT = { active: 'ปกติ', warning: 'เฝ้าระวัง', threat: 'คุกคาม', inactive: 'ไม่ทำงาน', maintenance: 'บำรุงรักษา' };

const createBaseIcon = (label = "CAM", status = "maintenance") => {
    if (!window.L) return null;
    return window.L.divIcon({
        className: 'custom-base-wrapper',
        html: `
            <div class="base-marker-container">
                ${status == 'threat' ? `<div class="threat-pulse-ring"></div>` : ''}
                ${status == 'active' ? `<div class="base-signal-ring"></div>` : ''}

                <div class="base-tactical-box" style=" background: ${COLORS[status]}; box-shadow: 0 0 15px ${COLORS[status]}${status === 'threat' ? '; animation: threat-box-pulse 1s ease-in-out infinite' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M23 7l-7 5 7 5V7z"></path>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </svg>
                </div>

                <div class="base-label-tag" style="background: ${COLORS[status]}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">
                    ${label}
                </div>
            </div>`,
        iconSize: [40, 50],
        iconAnchor: [20, 25]
    });
};

const createBasePopupContent = (base) => `
    <div class="tactical-popup station-popup">
        <div class="popup-header" style="border-left: 4px solid ${COLORS[base.status]}; padding-left: 10px; margin-bottom: 12px;">
            <div style="font-size: 10px; color: #94a3b8; letter-spacing: 2px; font-weight: 800; text-transform: uppercase;">
                Station Profile
            </div>
            <div style="font-size: 16px; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${COLORS[base.status]}" stroke-width="2.5"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                ${base.name}
            </div>
        </div>

        <div class="popup-body" style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <div class="status-row" style="margin-bottom: 8px; font-size: 11px; border-bottom: 1px solid #334155; padding-bottom: 4px;">
                <span style="color: #64748b;">POSITION:</span>
                <span style="color: ${COLORS[base.status]}; float: right; font-weight: bold; text-transform: uppercase;">${STATUS_TEXT[base.status]}</span>
            </div>
            
            <div class="coord-row" style="display: flex; justify-content: space-between; font-family: 'monospace'; font-size: 11px;">
                <div style="color: #cbd5e1;"><span>LAT</span> ${base.lat.toFixed(6)}</div>
                <div style="color: #cbd5e1; border-left: 1px solid #334155; padding-left: 8px;"><span>LNG</span> ${base.lng.toFixed(6)}</div>
            </div>

            <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 10px; color: #64748b; font-weight: bold;">HEADING ANGLE:</span>
                <span style="font-size: 12px; color: ${COLORS[base.status]}; font-weight: 900; font-family: monospace;">${base.heading}°</span>
            </div>
        </div>
        
        <div style="margin-top: 8px; font-size: 9px; color: #475569; text-align: center; letter-spacing: 1px;">
            RADAR SCAN RANGE: 50.0M
        </div>
    </div>
`;

// --- 2. Separate Component: ปุ่มควบคุม (ป้องกัน Re-render) ---
// ใช้ memo เพื่อไม่ให้ render ใหม่เมื่อ uav ขยับ
const MapControls = memo(({ mapType, setMapType, onReset }) => {
    return (
        <>
            <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg z-[400] overflow-hidden flex flex-col sm:flex-row">
                <button onClick={() => setMapType('street')} className={`px-4 py-2 text-sm font-medium transition-colors ${mapType === 'street' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>🗺️ แผนที่</button>
                <button onClick={() => setMapType('satellite')} className={`px-4 py-2 text-sm font-medium transition-colors border-t sm:border-t-0 sm:border-l ${mapType === 'satellite' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>🛰️ ดาวเทียม</button>
            </div>
            <button onClick={onReset} className="absolute bottom-8 right-14 bg-white p-3 rounded-full shadow-lg z-[400] hover:bg-gray-100 transition-all active:scale-95 text-gray-700 border border-gray-400" title="กลับไปที่ฐานตรวจการณ์">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
        </>
    );
});

const getDestinationPoint = (lat, lng, distance, bearing) => {
    const R = 6378137; // รัศมีโลก (เมตร)
    const d = distance / R;
    const brng = (bearing * Math.PI) / 180;
    const lat1 = (lat * Math.PI) / 180;
    const lon1 = (lng * Math.PI) / 180;

    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));

    return [lat2 * 180 / Math.PI, lon2 * 180 / Math.PI];
};

const createSectorPoints = (lat, lng, radius, heading, status, fov = 65) => {
    const points = [[lat, lng]];
    const startAngle = heading - (fov / 2);
    const endAngle = heading + (fov / 2);

    // วาดส่วนโค้งทุกๆ 5 องศาเพื่อให้พัดดูมน
    for (let i = startAngle; i <= endAngle; i += 5) {
        points.push(getDestinationPoint(lat, lng, radius, i));
    }

    points.push([lat, lng]); // กลับมาปิดที่จุดศูนย์กลาง
    return points;
};

// --- Main Component ---
export function Map({ base, selectedCamera, detectingCameras }) {
    const mapContainerRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});
    const tileLayerRef = useRef(null);

    // ใช้ Hook ที่เตรียมไว้
    const mapReady = useLeafletLoader();
    const [mapType, setMapType] = useState('street');
    const basePosition = useMemo(() => base.length > 0 ? base : [], [base]);
    const baseLayersRef = useRef([]);

    const defaultCenter = [{ lat: 14.9844, lng: 102.1189 }];

    // Init Map
    useEffect(() => {
        if (!mapReady || !mapContainerRef.current || mapInstance.current) return;

        const worldBounds = [[-90, -180], [90, 180]];
        const map = window.L.map(mapContainerRef.current, {
            center: basePosition.length > 0 ? [basePosition[0].lat, basePosition[0].lng] : defaultCenter[0],
            zoom: 17, minZoom: 3, maxBounds: worldBounds, maxBoundsViscosity: 1.0, zoomControl: false,
        });
        mapInstance.current = map;

        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });
        resizeObserver.observe(mapContainerRef.current);

        const tileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors', maxZoom: 19, noWrap: true, bounds: worldBounds
        }).addTo(map);

        // const tileLayer = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        //     attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        //     subdomains: 'abcd',
        //     maxZoom: 20
        // }).addTo(map);
        tileLayerRef.current = tileLayer;
        window.L.control.zoom({ position: 'bottomright' }).addTo(map);

        return () => {
            resizeObserver.disconnect();
            map.remove();
            mapInstance.current = null;
        };
    }, [mapReady, basePosition]);

    useEffect(() => {
        if (!mapInstance.current || !window.L || !mapReady) return;
        const map = mapInstance.current;
        baseLayersRef.current.forEach(layer => map.removeLayer(layer));
        baseLayersRef.current = [];

        basePosition.forEach(b => {
            // 1. วาดรัศมีรูปพัด 50 เมตร (FOV)
            const sectorPoints = createSectorPoints(b.lat, b.lng, 100, b.heading, b.status, 90);
            const fovPolygon = window.L.polygon(sectorPoints, {
                color: COLORS[b.status], weight: 1, fillColor: COLORS[b.status], fillOpacity: 0.15, dashArray: '5, 5', interactive: false
            }).addTo(map);

            // 2. วางไอคอนกล้อง
            const marker = window.L.marker([b.lat, b.lng], {
                icon: createBaseIcon(b.name.split(' ')[0], b.status)
            }).addTo(map).bindPopup(createBasePopupContent(b));

            baseLayersRef.current.push(fovPolygon, marker);
        });
    }, [basePosition, mapReady]);

    // Switch Layer
    useEffect(() => {
        if (!tileLayerRef.current || !window.L) return;
        const url = mapType === 'satellite'
            ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        tileLayerRef.current.setUrl(url);
    }, [mapType]);

    const handleResetView = useCallback(() => {
        if (mapInstance.current && selectedCamera && selectedCamera !== 'None') {
            const targetCameraID = parseInt(selectedCamera);
            const targetCamera = basePosition.find(cam => cam.id === targetCameraID);
            if (targetCamera) {
                mapInstance.current.flyTo([targetCamera.lat, targetCamera.lng], 17, { duration: 1.5 });
            }
        }
    }, [selectedCamera, basePosition]);

    useEffect(() => {
        if (!mapInstance.current || !selectedCamera || selectedCamera === 'None') return;

        const targetCameraID = parseInt(selectedCamera);
        const targetCamera = basePosition.find(cam => cam.id === targetCameraID);
        if (targetCamera) {
            mapInstance.current.flyTo([targetCamera.lat, targetCamera.lng], 17, { duration: 0 });
        }
    }, [selectedCamera, basePosition]);

    useEffect(() => {
        if (!mapInstance.current || !window.L || !mapReady) return;

        const map = mapInstance.current;
        
        const detectingIds = new Set(detectingCameras?.map(cam => typeof cam === 'object' ? cam.cameraId : cam) || []);
        
        baseLayersRef.current.forEach(layer => map.removeLayer(layer));
        baseLayersRef.current = [];

        basePosition.forEach(b => {
            const status = detectingIds.has(b.id) ? 'threat' : b.status;
            
            const sectorPoints = createSectorPoints(b.lat, b.lng, 100, b.heading, status, 90);
            const fovPolygon = window.L.polygon(sectorPoints, {
                color: COLORS[status], weight: 1, fillColor: COLORS[status], fillOpacity: 0.15, dashArray: '5, 5', interactive: false
            }).addTo(map);

            const marker = window.L.marker([b.lat, b.lng], {
                icon: createBaseIcon(b.name.split(' ')[0], status)
            }).addTo(map).bindPopup(createBasePopupContent(b));

            baseLayersRef.current.push(fovPolygon, marker);
        });
    }, [detectingCameras, basePosition, mapReady]);

    return (
        <div className="w-full h-full flex flex-col bg-gray-900 overflow-hidden border border-slate-700">
            <style>{`
                .leaflet-popup-content-wrapper {
                    background: rgba(15, 23, 42, 0.9) !important;
                    color: #f8fafc !important;
                    border: 1px solid rgba(51, 65, 85, 0.5);
                    backdrop-filter: blur(8px);
                    border-radius: 8px !important;
                    padding: 0;
                    box-shadow: 0 0 20px rgba(0,0,0,0.5) !important;
                }
                .leaflet-popup-tip { background: rgba(15, 23, 42, 0.9) !important; }
                .leaflet-popup-content { margin: 0 !important; width: auto !important; }

                /* Tactical Popup Style */
                .tactical-popup { padding: 12px; min-width: 180px; }
                .popup-header { display: flex; flex-direction: column; margin-bottom: 8px; padding-left: 10px; }
                .status-row { font-size: 12px; margin-bottom: 8px; border-bottom: 1px solid #334155; padding-bottom: 4px; }
                .coord-row { display: flex; gap: 8px; font-family: monospace; }
                .coord { font-size: 10px; color: #cbd5e1; }
                .coord span { color: #64748b; margin-right: 4px; }

                .radar-pulse {
                    position: absolute;
                    width: 24px; height: 24px;
                    border: 2px solid;
                    border-radius: 50%;
                    animation: radar-ping 2s infinite ease-out;
                    opacity: 0;
                }
                .delay-1 { animation-delay: 0.5s; }

                @keyframes radar-ping {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(3); opacity: 0; }
                }

                /* Threat Pulse Ring - Expanded concentric circles */
                .threat-pulse-ring {
                    position: absolute;
                    top: 15px;
                    left: 20px;
                    width: 30px;
                    height: 30px;
                    margin-top: -15px;
                    margin-left: -15px;
                    border: 2px solid #FF4444;
                    border-radius: 50%;
                    animation: threat-ring-expand 1.5s ease-out infinite;
                    opacity: 0.8;
                    pointer-events: none;
                    box-shadow: 0 0 20px #FF4444;
                }

                @keyframes threat-ring-expand {
                    0% { 
                        transform: scale(0.8);
                        opacity: 0.8;
                        box-shadow: 0 0 20px #FF4444;
                    }
                    50% {
                        box-shadow: 0 0 40px #FF4444;
                    }
                    100% { 
                        transform: scale(3);
                        opacity: 0;
                        box-shadow: 0 0 60px #FF4444;
                    }
                }

                @keyframes threat-box-pulse {
                    0%, 100% { 
                        box-shadow: 0 0 15px #FF4444;
                    }
                    50% { 
                        box-shadow: 0 0 30px #FF4444, 0 0 50px rgba(255, 68, 68, 0.5);
                    }
                }

                /* Base Marker Style */
                .base-marker-container {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                }

                /* ตัวกล่องไอคอนทรงเหลี่ยมตัดมุม (Tactical Look) */
                .base-tactical-box {
                    width: 30px;
                    height: 30px;
                    border: 2px solid white;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 5;
                    transform: rotate(-45deg);
                    transition: all 0.3s ease;
                }

                .base-tactical-box svg {
                    transform: rotate(45deg);
                    filter: drop-shadow(0 0 2px rgba(0,0,0,0.5));
                }

                /* ป้ายชื่อด้านล่าง */
                .base-label-tag {
                    margin-top: 4px;
                    font-size: 9px;
                    font-weight: 900;
                    padding: 1px 6px;
                    border-radius: 4px;
                    border: 1px solid white;
                    white-space: nowrap;
                    letter-spacing: 0.5px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                }

                /* เอฟเฟกต์วงแหวนสัญญาณขยายตัว */
                .base-signal-ring {
                    position: absolute;
                    top: 15px;
                    left: 20px;
                    width: 30px;
                    height: 30px;
                    margin-top: -15px;
                    margin-left: -15px;
                    border: 2px solid #22DD5D;
                    border-radius: 50%;
                    animation: base-signal-expand 3s infinite;
                    opacity: 0;
                    pointer-events: none;
                }

                @keyframes base-signal-expand {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { opacity: 0.5; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
            `}</style>

            <div className="flex-1 flex relative">
                <div ref={mapContainerRef} className="w-full h-full" />

                {/* --- Control Component (Memoized) --- */}
                <MapControls
                    mapType={mapType}
                    setMapType={setMapType}
                    onReset={handleResetView}
                />

                {!mapReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-[2000] text-white">
                        <div>กำลังโหลดแผนที่...</div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Map;