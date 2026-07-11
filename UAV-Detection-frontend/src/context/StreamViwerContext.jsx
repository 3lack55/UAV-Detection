import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useWebSocket } from "./WebsocketContext";

const StreamViewerContext = createContext(null);

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "ws";

export function StreamViewerProvider({ cameraID, children }) {
    const { connected: mainConnected } = useWebSocket();
    const [status, setStatus] = useState("Disconnected");
    const [fpsDisplay, setFpsDisplay] = useState(0);
    const [frame, setFrame] = useState(null);
    const [metaData, setMetaData] = useState(null);
    const [isCameraConnected, setIsCameraConnected] = useState(false);

    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const textDecoderRef = useRef(new TextDecoder("utf-8"));
    const frameCountRef = useRef(0);
    const lastFpsUpdateTimeRef = useRef(0);

    const lastFrameTimeRef = useRef(0);
    const lastFrameTimeout = 5000; // 5 seconds

    const clearStreamState = useCallback(() => {
        setFrame(null);
        setMetaData(null);
        setIsCameraConnected(false);
        setFpsDisplay(0);
    }, []);

    const sendControlMessage = useCallback((command, payload = {}) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: "control",
                cameraID,
                command,
                payload,
                timestamp: Date.now(),
            }));
        } else {
            console.warn("WebSocket is not open; cannot send control command.", command);
        }
    }, [cameraID]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            if (!isCameraConnected) return;
            const lastTime = lastFrameTimeRef.current;
            if (!lastTime) return;
            if (performance.now() - lastTime > lastFrameTimeout) {
                setStatus("Ready...");
                clearStreamState(); 
            }
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [isCameraConnected, clearStreamState]);

    useEffect(() => {
        if (cameraID === "None") {
            setStatus("No Camera Selected");
            clearStreamState();
            return;
        }

        if (!mainConnected) {
            setStatus("Waiting for main connection...");
            clearStreamState();
            return;
        }

        let isMounted = true;

        const connect = () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }

            setStatus("Connecting...");
            clearStreamState();

            const ws = new WebSocket(`${PROTOCOL}://${HOST}:${HOST_PORT}/streamViewer/camera${cameraID}`);
            ws.binaryType = "arraybuffer";
            wsRef.current = ws;

            ws.onopen = () => {
                if (isMounted) {
                    setStatus("Ready...");
                    clearTimeout(reconnectTimeoutRef.current);
                }
            };

            ws.onmessage = (event) => {
                if (!isMounted || !(event.data instanceof ArrayBuffer)) return;

                try {
                    const buffer = event.data;
                    const view = new DataView(buffer);
                    const jsonLen = view.getUint32(0, true);
                    const jsonBytes = new Uint8Array(buffer, 4, jsonLen);
                    const jsonStr = textDecoderRef.current.decode(jsonBytes);
                    const meta = JSON.parse(jsonStr);

                    const imageBytes = new Uint8Array(buffer, 4 + jsonLen);
                    const blob = new Blob([imageBytes], { type: "image/jpeg" });

                    setMetaData(meta);
                    setFrame(blob);
                    setIsCameraConnected(true);
                    setStatus("Ready...");

                    frameCountRef.current += 1;
                    const now = performance.now();
                    lastFrameTimeRef.current = now;
                    if (!lastFpsUpdateTimeRef.current) {
                        lastFpsUpdateTimeRef.current = now;
                    }
                    if (now - lastFpsUpdateTimeRef.current >= 1000) {
                        setFpsDisplay(frameCountRef.current);
                        frameCountRef.current = 0;
                        lastFpsUpdateTimeRef.current = now;
                    }
                } catch (err) {
                    console.error("Parse error:", err);
                }
            };

            ws.onclose = () => {
                if (isMounted) {
                    if (mainConnected) {
                        setStatus("Reconnecting...");
                        reconnectTimeoutRef.current = setTimeout(() => {
                            connect();
                        }, 3000);
                    } else {
                        setStatus("Waiting for main connection...");
                    }
                }
            };

            ws.onerror = (err) => {
                console.error("StreamViewer WebSocket error:", err);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            };
        };

        connect();

        return () => {
            isMounted = false;
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            clearTimeout(reconnectTimeoutRef.current);
        };
    }, [cameraID, mainConnected, clearStreamState]);

    const contextValue = useMemo(() => ({
        frame,
        metaData,
        status,
        fpsDisplay,
        isCameraConnected,
        sendControlMessage,
    }), [frame, metaData, status, fpsDisplay, isCameraConnected, sendControlMessage]);

    return (
        <StreamViewerContext.Provider value={contextValue}>
            {children}
        </StreamViewerContext.Provider>
    );
}

export const useStreamViewer = () => {
  const context = useContext(StreamViewerContext);
  return context ?? {
    frame: null,
    metaData: null,
    status: 'Disconnected',
    fpsDisplay: 0,
    isCameraConnected: false,
    sendControlMessage: () => {},
  };
};