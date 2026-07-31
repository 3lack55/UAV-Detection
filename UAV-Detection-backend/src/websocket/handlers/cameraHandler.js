import jwt from 'jsonwebtoken';
import { cameraSessions, JWT_SECRET } from '../state.js';
import { getOrCreateSession, unpackage } from '../utils.js';
import { broadcastToViewers, broadcastHolderImage, broadcastMetaData, broadcastToClients } from '../broadcast.js';
import { updateCameraStatus } from '../cameraStatus.js';
import { uavEventHandler } from '../eventManager.js';
import { doQuery } from '../../database/mysqlConnection.js';

// --- กรณีเป็น Sender (Camera/Python) ---
export function handleCameraConnection(ws, wss) {
    let isAuthenticated = false;
    let cameraId = null;
    let authTimeout = null;

    ws.once('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'auth' && data.token) {
                try {
                    const decoded = jwt.verify(data.token, JWT_SECRET);
                    cameraId = decoded.camera_id;

                    if (!cameraId) {
                        console.warn("Camera connection rejected: No camera_id in token.");
                        if (authTimeout) clearTimeout(authTimeout);
                        ws.close(4004, "Unauthorized: No camera_id in token");
                        return;
                    }

                    const cameraExists = await doQuery("SELECT camera_id FROM cameras WHERE camera_id = ? AND deleted != 1", [cameraId]);
                    if (cameraExists.length === 0) {
                        console.warn(`Camera connection rejected: Camera ${cameraId} not found in database.`);
                        if (authTimeout) clearTimeout(authTimeout);
                        ws.close(4005, "Unauthorized: Camera not found");
                        return;
                    }

                    const statusUpdated = await updateCameraStatus(cameraId, 'active', data.metaData || null);
                    if (!statusUpdated) {
                        console.error(`Rejected camera ${cameraId}. Failed to update status.`);
                        if (authTimeout) clearTimeout(authTimeout);
                        ws.close(4006, "Failed to update camera status");
                        return;
                    }

                    isAuthenticated = true;
                    console.log(`Camera connected and authenticated: camera${cameraId}`);

                    const session = getOrCreateSession(`camera${cameraId}`);
                    session.sender = ws;

                    if (authTimeout) clearTimeout(authTimeout);

                    ws.send(JSON.stringify({ type: 'auth_response', success: true, cameraId }));

                } catch (err) {
                    console.warn("Camera connection rejected: Invalid token.");
                    if (authTimeout) clearTimeout(authTimeout);
                    ws.close(4002, "Unauthorized: Invalid token");
                    return;
                }
            } else {
                console.warn("Camera connection rejected: No token provided.");
                if (authTimeout) clearTimeout(authTimeout);
                ws.close(4001, "Unauthorized: No token provided");
                return;
            }
        } catch (err) {
            console.warn("Camera connection error:", err.message);
            if (authTimeout) clearTimeout(authTimeout);
            ws.close(4000, "Bad message format");
            return;
        }
    });

    // กำหนด timeout สำหรับการยืนยันตัวตน
    authTimeout = setTimeout(() => {
        if (!isAuthenticated) {
            console.warn("Camera connection timeout: No auth message received");
            ws.close(4003, "Authentication timeout");
        }
    }, 5000);

    ws.on('message', (message, isBinary) => {
        if (!isAuthenticated) return;

        broadcastToViewers(`camera${cameraId}`, message, isBinary);

        const session = cameraSessions.get(`camera${cameraId}`);
        if (!session) return;

        if (session.lastBoardcastHolderImage && (Date.now() - session.lastBoardcastHolderImage > 10000) && session.holderImage) {
            broadcastHolderImage();
            session.lastBoardcastHolderImage = Date.now();
        }

        if (session.lastUnpacked && (Date.now() - session.lastUnpacked < 3000)) {
            return;
        }
        let unpacked = unpackage(message);
        session.lastUnpacked = Date.now();
        session.holderImage = unpacked?.image || null;
        session.metaData = unpacked?.meta || null;

        broadcastMetaData();

        if (unpacked && unpacked.meta && unpacked.meta.uavs && unpacked.meta.uavs.length > 0) {
            uavEventHandler(unpacked);
        }
    });

    ws.on('close', async () => {
        if (isAuthenticated && cameraId) {
            console.log(`Camera disconnected: camera${cameraId}`);
            const s = cameraSessions.get(`camera${cameraId}`);

            await updateCameraStatus(cameraId, 'inactive', s.metaData || null);

            if (s) {
                s.sender = null;
                s.holderImage = null;
                s.metaData = null;
                s.currentController = null;
            }
            
            broadcastHolderImage();
            broadcastMetaData();
            broadcastToClients();
            
            console.log(`Total Camera Sessions: ${cameraSessions.size} | Total WebSocket Clients: ${wss.clients.size}`);
        } else {
            console.log("Unauthenticated camera connection closed");
            if (authTimeout) clearTimeout(authTimeout);
        }
    });

    ws.on('error', (e) => {
        if (authTimeout) clearTimeout(authTimeout);
        console.error(`Camera error: ${e.message}`);
    });
}