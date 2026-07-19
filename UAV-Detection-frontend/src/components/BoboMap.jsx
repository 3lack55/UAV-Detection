import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { Map, Satellite } from 'lucide-react';
import { useWebSocket } from "../context/WebsocketContext.jsx";

const useLeafletLoader = () => {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
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

                <div class="base-label-tag" style="background: ${COLORS[status]}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; max-width: 90px; text-align: center;">
                    ${label}
                </div>
            </div>`,
        iconSize: [40, 50],
        iconAnchor: [20, 25]
    });
};

const createBasePopupContent = (base, live) => `
    <div class="tactical-popup station-popup">
        <div class="popup-header" style="border-left: 4px solid ${COLORS[base.status]}; padding-left: 10px; margin-bottom: 12px;">
            <div style="font-size: 10px; color: #94a3b8; letter-spacing: 2px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">
                ${base.type || 'ฐานตรวจการณ์'}
            </div>
            <div style="font-size: 16px; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${COLORS[base.status]}" stroke-width="2.5"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                <h6 style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${base.name}</h6>
            </div>
        </div>

        <div class="popup-body" style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <div class="status-row" style="margin-bottom: 8px; font-size: 11px; padding-bottom: 2px;">
                <span style="color: #64748b;">ตำแหน่ง:</span>
            </div>
            
            <div class="coord-row" style="display: flex; justify-content: space-between; font-family: 'monospace'; font-size: 11px;">
                <div style="color: #cbd5e1;"><span>LAT</span> ${base.lat.toFixed(6)}</div>
                <div style="color: #64748b; padding: 0 4px;">|</div>
                <div style="color: #cbd5e1; "><span>LNG</span> ${base.lng.toFixed(6)}</div>
            </div>

            <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 10px; color: #64748b; font-weight: bold;">INSTALL FACE (ทิศติดตั้ง):</span>
                <span style="font-size: 12px; color: ${COLORS[base.status]}; font-weight: 900; font-family: monospace;">${live ? live.installFace : base.heading}°</span>
            </div>

            ${live ? `
            <div style="margin-top: 6px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 10px; color: #64748b; font-weight: bold;">CURRENT PAN:</span>
                <span style="font-size: 12px; color: #e2e8f0; font-weight: 900; font-family: monospace;">${live.pan}°</span>
            </div>
            <div style="margin-top: 6px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 10px; color: #64748b; font-weight: bold;">CURRENT HEADING:</span>
                <span style="font-size: 12px; color: #e2e8f0; font-weight: 900; font-family: monospace;">${live.currentHeading}°</span>
            </div>
            ` : ''}
        </div>
        
        <div style="margin-top: 8px; font-size: 9px; color: #475569; text-align: center; letter-spacing: 1px;">
            ${live?.timestamp ? `อัพเดตล่าสุด: ${new Date(live.timestamp).toLocaleString('th-TH')}` : (base.last_update ? `อัพเดตล่าสุด: ${new Date(base.last_update).toLocaleString('th-TH')}` : 'ไม่พบข้อมูลอัพเดตล')}
        </div>
    </div>
`;

const MapControls = memo(({ mapType, setMapType, onReset }) => {
    return (
        <>
            <div className="absolute top-4 right-4 rounded-full max-sm:rounded-lg border border-slate-700 bg-slate-900/90 backdrop-blur-lg shadow-[0_20px_40px_rgba(15,23,42,0.25)] z-[400] overflow-hidden flex gap-1 p-1 max-sm:p-0 max-sm:block ">
                <button onClick={() => setMapType('street')} className={`flex max-sm:w-full max-sm:rounded-none items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] transition-all duration-200 rounded-full ${mapType === 'street' ? 'bg-slate-700/95 text-slate-100 ring-1 ring-slate-500 max-sm:ring-0' : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-slate-100'}`}>
                    <Map className="w-4 h-4" /> แผนที่
                </button>
                <button onClick={() => setMapType('satellite')} className={`flex max-sm:w-full max-sm:rounded-none items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] transition-all duration-200 rounded-full ${mapType === 'satellite' ? 'bg-slate-700/95 text-slate-100 ring-1 ring-slate-500 max-sm:ring-0' : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-slate-100'}`}>
                    <Satellite className="w-4 h-4" /> ดาวเทียม
                </button>
            </div>
            <button onClick={onReset} className="absolute bottom-8 right-14 grid place-items-center w-12 h-12 rounded-full bg-slate-900/90 border border-slate-700 text-slate-200 shadow-[0_16px_30px_rgba(15,23,42,0.2)] z-[400] hover:bg-slate-800 transition-all duration-200 active:scale-95" title="กลับไปที่ฐานตรวจการณ์">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
        </>
    );
});

const normalizeAngle = (angle) => ((Number(angle) % 360) + 360) % 360;

const DIRECTION_ARROW_COLOR = '#F54927';
const DIRECTION_ARROW_LENGTH_METERS = 30;

const createDirectionArrowHeadIcon = (angle, color = DIRECTION_ARROW_COLOR) => {
    if (!window.L) return null;
    return window.L.divIcon({
        className: 'custom-direction-arrowhead',
        html: `
            <div style="width:26px; height:26px; transform: rotate(${normalizeAngle(angle)}deg); transform-origin: 50% 50%; pointer-events: none;">
                <svg width="26" height="26" viewBox="0 0 26 26" style="overflow: visible;">
                    <polygon points="13,0 3,20 13,15 23,20" fill="${color}" stroke="#0f172a" stroke-width="1.5" stroke-linejoin="round"></polygon>
                </svg>
            </div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
    });
};

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

    for (let i = startAngle; i <= endAngle; i += 5) {
        points.push(getDestinationPoint(lat, lng, radius, i));
    }

    points.push([lat, lng]); 
    return points;
};

// --- Main Component ---
const BoboMap = memo(function BoboMap({ base, selectedCamera, detectingCameras }) {
    const mapContainerRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});
    const tileLayerRef = useRef(null);

    // ใช้ Hook ที่เตรียมไว้
    const mapReady = useLeafletLoader();
    const [mapType, setMapType] = useState(() => {
        if (typeof window === 'undefined') return 'street';
        const savedType = window.localStorage.getItem('boboMapType');
        return savedType === 'satellite' ? 'satellite' : 'street';
    });
    const basePosition = useMemo(() => base.length > 0 ? base : [], [base]);
    const baseLayersRef = useRef([]);

    const defaultCenter = [{ lat: 14.9844, lng: 102.1189 }];

    const { allMetaDataRef } = useWebSocket();
    const [liveMeta, setLiveMeta] = useState({});

    useEffect(() => {
        const readMetaData = () => {
            const data = allMetaDataRef?.current;
            if (!data) return;

            const parsed = {};
            Object.values(data).forEach((camData) => {
                const camId = camData?.camera?.camera_id;
                if (camId === undefined || camId === null) return;

                parsed[String(camId)] = {
                    pan: camData.heading?.currentPan ?? 0,
                    tilt: camData.heading?.currentTilt ?? 0,
                    installFace: camData.heading?.installFace ?? 0,
                    timestamp: camData.timestamp || null,
                };
            });

            setLiveMeta(parsed);
        };

        readMetaData(); 
        const intervalId = setInterval(readMetaData, 3000);

        return () => clearInterval(intervalId);
    }, [allMetaDataRef]);

    const enrichedBasePosition = useMemo(() => {
        return basePosition.map((b) => {
            const live = liveMeta[String(b.id)];
            const installFace = live ? live.installFace : b.heading;
            const pan = live ? live.pan : 0;
            const currentHeading = normalizeAngle(installFace + pan);

            return {
                ...b,
                installFace: normalizeAngle(installFace),
                currentHeading,
                live: live ? { ...live, installFace: normalizeAngle(installFace), currentHeading } : null,
            };
        });
    }, [basePosition, liveMeta]);

    // Init Map
    useEffect(() => {
        if (!mapReady || !mapContainerRef.current || mapInstance.current) return;

        const worldBounds = [[-90, -180], [90, 180]];
        const initialCenter = basePosition.length > 0 ? [basePosition[0].lat, basePosition[0].lng] : defaultCenter[0];
        const map = window.L.map(mapContainerRef.current, {
            center: initialCenter,
            zoom: 17, minZoom: 3, maxBounds: worldBounds, maxBoundsViscosity: 1.0, zoomControl: false,
        });
        mapInstance.current = map;

        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });
        resizeObserver.observe(mapContainerRef.current);

        const tileUrl = mapType === 'satellite'
            ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        const tileLayer = window.L.tileLayer(tileUrl, {
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
    }, [mapReady]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('boboMapType', mapType);
        }
    }, [mapType]);

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
    }, [selectedCamera]);

    useEffect(() => {
        if (!mapInstance.current || !window.L || !mapReady) return;

        const map = mapInstance.current;

        const detectingIds = new Set(detectingCameras?.map(cam => typeof cam === 'object' ? cam.cameraId : cam) || []);

        baseLayersRef.current.forEach(layer => map.removeLayer(layer));
        baseLayersRef.current = [];

        enrichedBasePosition.forEach(b => {
            const status = detectingIds.has(String(b.id)) ? 'threat' : b.status;

            const sectorPoints = createSectorPoints(b.lat, b.lng, 100, b.currentHeading, status, 90);
            const fovPolygon = window.L.polygon(sectorPoints, {
                color: COLORS[status], weight: 1, fillColor: COLORS[status], fillOpacity: 0.15, dashArray: '5, 5', interactive: false
            }).addTo(map);

            const arrowEndPoint = getDestinationPoint(b.lat, b.lng, DIRECTION_ARROW_LENGTH_METERS, b.installFace);

            const directionLineCasing = window.L.polyline([[b.lat, b.lng], arrowEndPoint], {
                color: '#0f172a', weight: 6, opacity: 0.85, interactive: false,
            }).addTo(map);

            const directionLine = window.L.polyline([[b.lat, b.lng], arrowEndPoint], {
                color: DIRECTION_ARROW_COLOR, weight: 3, opacity: 1, interactive: false,
            }).addTo(map);

            const directionArrowHead = window.L.marker(arrowEndPoint, {
                icon: createDirectionArrowHeadIcon(b.installFace),
                interactive: false,
                zIndexOffset: -50,
            }).addTo(map);

            const marker = window.L.marker([b.lat, b.lng], {
                icon: createBaseIcon(b.name.split(' ')[0], status)
            }).addTo(map).bindPopup(createBasePopupContent(b, b.live));

            baseLayersRef.current.push(fovPolygon, directionLineCasing, directionLine, directionArrowHead, marker);
        });
    }, [detectingCameras, enrichedBasePosition, mapReady]);

    return (
        <div className="w-full h-full flex flex-col bg-gray-900 overflow-hidden border border-slate-700">

            <div className="flex-1 flex relative">
                <div ref={mapContainerRef} className="w-full h-full" />

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
});

export default BoboMap;