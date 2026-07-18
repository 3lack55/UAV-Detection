import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useAuth } from "./AuthContext";

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "ws";

const WebSocketContext = createContext();

export function WebSocketProvider({ children }) {
    const socketRef = useRef(null);
    const reconnectIntervalRef = useRef(null);
    const shouldReconnectRef = useRef(true);
    const isInitializedRef = useRef(false);
    const { user, logout } = useAuth();
    const [connected, setConnected] = useState(false);
    const [statusUpdate, setStatusUpdate] = useState(null);
    const [systemEvent, setSystemEvent] = useState(null);
    const holderImageRef = useRef(null);
    const [reconnecting, setReconnecting] = useState(false);

    const audioContextRef = useRef(null);
    const audioInitializedRef = useRef(false);
    const prevDetectingCountRef = useRef(0);

    const getAudioContext = useCallback(() => {
        if (audioContextRef.current) return audioContextRef.current;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        audioContextRef.current = new AudioContext();
        return audioContextRef.current;
    }, []);

    const resumeAudioContext = useCallback(() => {
        if (audioInitializedRef.current) return;
        const audioCtx = getAudioContext();
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => { });
        }
        audioInitializedRef.current = true;
    }, [getAudioContext]);

    useEffect(() => {
        const activateAudio = () => resumeAudioContext();
        window.addEventListener('click', activateAudio, { once: true, capture: true });
        window.addEventListener('keydown', activateAudio, { once: true, capture: true });
        window.addEventListener('touchstart', activateAudio, { once: true, capture: true });
        return () => {
            window.removeEventListener('click', activateAudio, { capture: true });
            window.removeEventListener('keydown', activateAudio, { capture: true });
            window.removeEventListener('touchstart', activateAudio, { capture: true });
        };
    }, [resumeAudioContext]);

    const playDroneAlarm = useCallback(() => {
        const audioCtx = getAudioContext();
        if (!audioCtx) return;

        const ensureAudio = audioCtx.state === 'suspended'
            ? audioCtx.resume()
            : Promise.resolve();

        ensureAudio.then(() => {
            const now = audioCtx.currentTime;
            const duration = 0.8;

            const mainOsc = audioCtx.createOscillator();
            const subOsc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            mainOsc.type = 'sawtooth';
            subOsc.type = 'sawtooth';

            mainOsc.frequency.setValueAtTime(600, now);
            subOsc.frequency.setValueAtTime(610, now);

            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
            gainNode.gain.setValueAtTime(0.3, now + duration - 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

            mainOsc.frequency.linearRampToValueAtTime(1000, now + 0.2);
            subOsc.frequency.linearRampToValueAtTime(1010, now + 0.2);
            mainOsc.frequency.linearRampToValueAtTime(500, now + 0.4);
            subOsc.frequency.linearRampToValueAtTime(510, now + 0.4);

            mainOsc.frequency.linearRampToValueAtTime(1200, now + 0.6);
            subOsc.frequency.linearRampToValueAtTime(1210, now + 0.6);
            mainOsc.frequency.linearRampToValueAtTime(400, now + duration);
            subOsc.frequency.linearRampToValueAtTime(410, now + duration);

            mainOsc.connect(gainNode);
            subOsc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            mainOsc.start(now);
            subOsc.start(now);
            mainOsc.stop(now + duration);
            subOsc.stop(now + duration);
        }).catch(() => { });
    }, [getAudioContext]);

    const RECONNECT_INTERVAL = 5000; // 5 seconds

    const connectWebSocket = (token) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            return;
        }

        const ws = new WebSocket(`${PROTOCOL}://${HOST}:${HOST_PORT}/client`);
        socketRef.current = ws;

        ws.onopen = () => {
            // Send token as message after connection
            ws.send(JSON.stringify({ type: 'auth', token }));
        };

        ws.onmessage = (event) => {
            try {
                const parsedData = JSON.parse(event.data);

                // Handle auth response
                if (parsedData.type === 'auth_response') {
                    if (parsedData.success) {
                        console.log("Client WebSocket authenticated");
                        setConnected(true);
                        setReconnecting(false);
                        if (reconnectIntervalRef.current) {
                            clearInterval(reconnectIntervalRef.current);
                            reconnectIntervalRef.current = null;
                        }
                    } else {
                        console.error("Authentication failed");
                        ws.close();
                    }
                    return;
                }

                if (parsedData.type === 'system_update') {
                    setSystemEvent(parsedData);
                    return;
                }

                if (parsedData.type === 'auth_required') {
                    shouldReconnectRef.current = false;
                    logout();
                    setConnected(false);
                    setReconnecting(false);
                    return;
                }

                if (parsedData.type === 'status_update') {
                    const nextStatus = parsedData.data;
                    const nextDetecting = Array.isArray(nextStatus?.detectingCameras)
                        ? nextStatus.detectingCameras.length
                        : 0;
                    const previousDetecting = prevDetectingCountRef.current ?? 0;

                    if (nextDetecting > previousDetecting) {
                        playDroneAlarm();
                    }
                    prevDetectingCountRef.current = nextDetecting;
                    setStatusUpdate(nextStatus);
                    return;
                }

                if (parsedData.type === 'holder_image') {
                    holderImageRef.current = parsedData.data.holderImages || {};
                    return;
                }
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };

        ws.onclose = () => {
            console.log("Client WebSocket disconnected.");
            setConnected(false);
            setReconnecting(true);

            // Schedule reconnect attempts every 5 seconds
            if (shouldReconnectRef.current && token) {
                if (reconnectIntervalRef.current) {
                    clearInterval(reconnectIntervalRef.current);
                }
                reconnectIntervalRef.current = setInterval(() => {
                    if (shouldReconnectRef.current && socketRef.current?.readyState !== WebSocket.OPEN) {
                        console.log("Attempting to reconnect...");
                        connectWebSocket(token);
                    }
                }, RECONNECT_INTERVAL);
            }
        };

        ws.onerror = (error) => {
            console.error("Client WebSocket error:", error);
            setConnected(false);
        };
    };

    // Initialize connection once when user is authenticated
    useEffect(() => {
        if (!user || !user.token) {
            shouldReconnectRef.current = false;
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
            if (reconnectIntervalRef.current) {
                clearInterval(reconnectIntervalRef.current);
                reconnectIntervalRef.current = null;
            }
            isInitializedRef.current = false;
            setConnected(false);
            setReconnecting(false);
            return;
        }

        // Only initialize connection once
        if (!isInitializedRef.current) {
            isInitializedRef.current = true;
            shouldReconnectRef.current = true;
            connectWebSocket(user.token);
        }

        return () => {
            // Cleanup only on unmount or logout
            shouldReconnectRef.current = false;
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
            if (reconnectIntervalRef.current) {
                clearInterval(reconnectIntervalRef.current);
                reconnectIntervalRef.current = null;
            }
            isInitializedRef.current = false;
        };
    }, [user?.token]);

    const sendMessage = useCallback((data) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            const payload = typeof data === 'object' ? JSON.stringify(data) : data;
            socketRef.current.send(payload);
        } else {
            console.warn("Cannot send message: WebSocket is not connected.");
        }
    }, []);

    // console.log("WebSocketContext Rendered: ");

    const contextValue = useMemo(() => ({
        connected,
        statusUpdate,
        systemEvent,
        holderImageRef,
        sendMessage,
        reconnecting,
    }), [connected, statusUpdate, systemEvent, holderImageRef, sendMessage, reconnecting]);

    return (
        <WebSocketContext.Provider value={contextValue}>
            {children}
        </WebSocketContext.Provider>
    );
}

export const useWebSocket = () => useContext(WebSocketContext);