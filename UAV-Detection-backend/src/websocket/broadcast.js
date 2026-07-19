import { cameraSessions, clientSessions, events } from './state.js';

export function broadcastToViewers(cameraId, data, isBinary) {
    const session = cameraSessions.get(cameraId);
    if (!session || session.viewers.size === 0) return;

    for (const client of session.viewers) {
        if (client.readyState === 1) { // 1 = OPEN
            if (client.bufferedAmount > 256 * 1024) { // ถ้าค้างเกิน 256KB
                continue;
            }

            try {
                client.send(data, { binary: isBinary });
            } catch (e) {
                console.error(`Broadcast error: ${e.message}`);
            }
        }
    }
}

// อัพเดตสถานะของการเชื่อมต่องของทุกๆ client และสถานะการตรวจพบ UAV ของกล้องไปให้ทุกๆ client ที่เชื่อมต่ออยู่
export function broadcastToClients() {
    const detectingCameras = [];
    for (const e of events.entries()) {
        detectingCameras.push({ cameraId: e[0] });
    }

    const onlineUsers = [];
    for (const [ws, userData] of clientSessions.entries()) {
        onlineUsers.push({
            userId: userData.userId,
            username: userData.username,
            role: userData.role
        });
    }

    const onControlCameras = [];
    for (const [cameraId, session] of cameraSessions.entries()) {
        if (session.currentController) {
            onControlCameras.push({ cameraId, controller: session.currentController });
        }
    }

    const payload = {
        type: 'status_update',
        data: {
            detectingCameras: detectingCameras,
            onlineUsers: onlineUsers,
            onControlCameras: onControlCameras
        }
    }

    for (const [ws, userData] of clientSessions.entries()) {
        if (ws.readyState === 1) { // 1 = OPEN
            try {
                ws.send(JSON.stringify(payload));
            } catch (e) {
                console.error(`Broadcast to client error: ${e.message}`);
            }
        }
    }
}

export function broadcastSystemUpdate(event, data = {}) {
    const payload = {
        type: 'system_update',
        event,
        data: {
            ...data,
            timestamp: new Date().toISOString()
        }
    };

    for (const [ws] of clientSessions.entries()) {
        if (ws.readyState === 1) {
            try {
                ws.send(JSON.stringify(payload));
            } catch (e) {
                console.error(`Broadcast system update error: ${e.message}`);
            }
        }
    }
}

export function broadcastHolderImage() {
    const holderImages = {};
    for (const [cameraId, session] of cameraSessions.entries()) {
        if (session.holderImage) {
            holderImages[cameraId] = { imageBuffer: session.holderImage.toString('base64') };
        }
    }

    const payload = {
        type: 'holder_image',
        data: {
            holderImages
        }
    };

    for (const [ws] of clientSessions.entries()) {
        if (ws.readyState === 1) {
            try {
                ws.send(JSON.stringify(payload));
            } catch (e) {
                console.error(`Broadcast holder image error: ${e.message}`);
            }
        }
    }
}

export function invalidateUserSession(userId, reason = 'Your session has been invalidated.') {
    const targetSessions = [];
    for (const [ws, userData] of clientSessions.entries()) {
        if (String(userData.userId) === String(userId)) {
            targetSessions.push(ws);
        }
    }

    targetSessions.forEach((ws) => {
        clientSessions.delete(ws);
        try {
            ws.send(JSON.stringify({
                type: 'auth_required',
                success: false,
                reason,
                timestamp: new Date().toISOString()
            }));
        } catch (e) {
            console.error(`Failed to notify session invalidation: ${e.message}`);
        }

        try {
            ws.close(4005, reason);
        } catch (e) {
            console.error(`Failed to close invalidated session: ${e.message}`);
        }
    });

    broadcastToClients();
}

export function broadcastMetaData() {
    const metaDataPayload = {};
    for (const [cameraId, session] of cameraSessions.entries()) {
        if (session.metaData) {
            metaDataPayload[cameraId] = session.metaData;
        }
    }

    const payload = {
        type: 'meta_data',
        data: {
            metaData: metaDataPayload
        }
    };

    for (const [ws] of clientSessions.entries()) {
        if (ws.readyState === 1) {
            try {
                ws.send(JSON.stringify(payload));
            } catch (e) {
                console.error(`Broadcast meta data error: ${e.message}`);
            }
        }
    }
}