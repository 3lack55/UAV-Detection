import { cameraSessions, JWT_SECRET } from '../state.js';
import { getOrCreateSession } from '../utils.js';
import { broadcastToClients } from '../broadcast.js';
import jwt from 'jsonwebtoken';

// --- กรณีเป็น Viewer (Frontend) ---
export function handleViewerConnection(ws, cameraId, wss) {
    let isAuthenticated = false;
    let viewerData = null;
    let authTimeout = null;

    ws.once('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'auth' && data.token) {
                try {
                    const decoded = jwt.verify(data.token, JWT_SECRET);
                    isAuthenticated = true;
                    viewerData = { userId: decoded.user_id, username: decoded.username, role: decoded.role, permission: data.permission || 'viewer' };
                    ws.viewerData = viewerData;
                    const session = getOrCreateSession(cameraId);
                    session.viewers.add(ws);
                    console.log(`Viewer connected: ${decoded.username} (ID: ${decoded.user_id}, Role: ${decoded.role}, Permission: ${viewerData.permission}) to camera ${cameraId}`);

                    if (authTimeout) clearTimeout(authTimeout);
                    ws.send(JSON.stringify({ type: 'auth_response', success: true, cameraId }));
                } catch (err) {
                    console.warn("Viewer connection rejected: Invalid token.");
                    if (authTimeout) clearTimeout(authTimeout);
                    ws.close(4002, "Unauthorized: Invalid token");
                    return;
                }
            } else {
                console.warn("Viewer connection rejected: No token provided.");
                if (authTimeout) clearTimeout(authTimeout);
                ws.close(4001, "Unauthorized: No token provided");
                return;
            }
        } catch (err) {
            console.warn("Viewer connection error:", err.message);
            if (authTimeout) clearTimeout(authTimeout);
            ws.close(4000, "Bad message format");
            return;
        }
    });

    authTimeout = setTimeout(() => {
        if (!isAuthenticated) {
            console.warn("Client connection timeout: No auth message received");
            ws.close(4003, "Authentication timeout");
        }
    }, 5000);

    ws.on('message', (message) => {
        if (!isAuthenticated) return;

        if (typeof message !== 'string' && !Buffer.isBuffer(message)) return;
        const msgStr = typeof message === 'string' ? message : message.toString();

        let msg;
        try {
            msg = JSON.parse(msgStr);
        } catch (err) {
            console.error("Invalid message from viewer:", err);
            return;
        }

        const userId = ws.viewerData?.userId;
        const permission = ws.viewerData?.permission;

        if (msg.type === 'control') {
            const targetSession = cameraSessions.get(cameraId);
            if (targetSession && targetSession.sender && targetSession.sender.readyState === WebSocket.OPEN) {
                try {
                    if (targetSession.currentController === null) {
                        targetSession.currentController = { userId: userId, permission: permission, ws: ws };
                        console.log(`Viewer with ID ${userId} is now controlling camera ${cameraId}`);
                        broadcastToClients();
                    } else if (targetSession.currentController.userId !== userId) {
                        if (permission !== 'admin') {
                            console.warn(`Viewer with ID ${userId} is trying to control camera ${cameraId} but is not the current controller.`);
                            ws.send(JSON.stringify({ type: 'control_denied', reason: 'You are not the current controller of this camera.' }));
                            return;
                        } else {
                            console.log(`Viewer with ID ${userId} is overriding control of camera ${cameraId} as admin.`);
                            targetSession.currentController = { userId: userId, permission: permission, ws: ws };
                            broadcastToClients();
                        }
                    }

                    targetSession.sender.send(JSON.stringify(msg));
                } catch (e) {
                    console.error(`Failed to forward to camera ${cameraId}: ${e.message}`);
                }
            }
        } else if (msg.type === 'ack') {
            const targetSession = cameraSessions.get(cameraId);
            if (targetSession?.sender?.readyState === WebSocket.OPEN) {
                targetSession.sender.send(JSON.stringify(msg));
            }
        }
    });

    ws.on('close', () => {
        if (isAuthenticated) {
            const session = cameraSessions.get(cameraId);
            if (session) {
                session.viewers.delete(ws);
                if (session.currentController?.ws === ws) {
                    session.currentController = null;
                }
                broadcastToClients();
            }
        }
    });

    ws.on('error', (e) => console.error(`Viewer error: ${e.message}`));
}