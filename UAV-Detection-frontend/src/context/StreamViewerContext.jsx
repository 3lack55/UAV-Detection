import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useWebSocket } from "./useWebSocket";
import { WEBSOCKET_BASE_URL } from "../config/api";
import { StreamViewerContext } from "./stream-viewer-context-definition";

export function StreamViewerProvider({ cameraID, permission, children }) {
    const { connected: mainConnected } = useWebSocket();
    const [status, setStatus] = useState("Disconnected");
    const [fpsDisplay, setFpsDisplay] = useState(0);
    const [frame, setFrame] = useState(null);
    const [metaData, setMetaData] = useState(null);
    const [isCameraConnected, setIsCameraConnected] = useState(false);
    const [controlFeedback, setControlFeedback] = useState(null);

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
        setControlFeedback(null);
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
            const resetTimeout = setTimeout(clearStreamState, 0);
            return () => clearTimeout(resetTimeout);
        }

        if (!mainConnected) {
            const resetTimeout = setTimeout(clearStreamState, 0);
            return () => clearTimeout(resetTimeout);
        }

        let isMounted = true;

        const connect = () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }

            setStatus("Connecting...");
            clearStreamState();

            const ws = new WebSocket(`${WEBSOCKET_BASE_URL}/streamViewer/camera${cameraID}`);
            ws.binaryType = "arraybuffer";
            wsRef.current = ws;

            ws.onopen = () => {
                ws.send(JSON.stringify({ type: "auth", token: sessionStorage.getItem("token"), permission: permission }));
                if (isMounted) {
                    setStatus("Ready...");
                    clearTimeout(reconnectTimeoutRef.current);
                }
            };

            ws.onmessage = (event) => {
                if (!isMounted) return;

                try {
                    if (typeof event.data === "string") {
                        const parsedData = JSON.parse(event.data);
                        if (parsedData?.type === "control_feedback") {
                            setControlFeedback(parsedData);
                            return;
                        }
                    }

                    if (!(event.data instanceof ArrayBuffer)) return;

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
    }, [cameraID, mainConnected, permission, clearStreamState]);

    const displayStatus = cameraID === "None"
        ? "No Camera Selected"
        : !mainConnected ? "Waiting for main connection..." : status;

    const contextValue = useMemo(() => ({
        frame,
        metaData,
        status: displayStatus,
        fpsDisplay,
        isCameraConnected,
        sendControlMessage,
        controlFeedback,
    }), [frame, metaData, displayStatus, fpsDisplay, isCameraConnected, sendControlMessage, controlFeedback]);

    return (
        <StreamViewerContext.Provider value={contextValue}>
            {children}
        </StreamViewerContext.Provider>
    );
}