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
    const [realtimeEvent, setRealtimeEvent] = useState(null);
    const [systemEvent, setSystemEvent] = useState(null);
    const [reconnecting, setReconnecting] = useState(false);

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
                    setRealtimeEvent(parsedData);
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
                    setStatusUpdate(parsedData.data);
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

    const contextValue = useMemo(() => ({
        connected,
        statusUpdate,
        realtimeEvent,
        systemEvent,
        sendMessage,
        reconnecting,
    }), [connected, statusUpdate, realtimeEvent, systemEvent, sendMessage, reconnecting]);

    return (
        <WebSocketContext.Provider value={contextValue}>
            {children}
        </WebSocketContext.Provider>
    );
}

export const useWebSocket = () => useContext(WebSocketContext);