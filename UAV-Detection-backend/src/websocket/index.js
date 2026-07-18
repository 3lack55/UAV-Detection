import { WebSocketServer } from 'ws';
import { cameraSessions } from './state.js';
import { handleViewerConnection } from './handlers/viewerHandler.js';
import { handleCameraConnection } from './handlers/cameraHandler.js';
import { handleClientConnection } from './handlers/clientHanler.js';

export { broadcastSystemUpdate, broadcastHolderImage, invalidateUserSession } from './broadcast.js';

export function initializeWebSocket(server) {
    const wss = new WebSocketServer({
        server,
        perMessageDeflate: false,
        maxPayload: 5 * 1024 * 1024
    });

    console.log('WebSocket Stream Server is running.');

    wss.on('connection', (ws, req) => {
        const parts = req.url.split('/').filter(p => p);
        if (parts.length === 0) return ws.close();

        const role = parts[0]; // 'camera' หรือ 'streamViewer' หรือ 'client'

        if (role === 'streamViewer') {
            const cameraId = parts[1];
            if (!cameraId) return ws.close();
            handleViewerConnection(ws, cameraId, wss);
        } else if (role.startsWith('camera')) {
            handleCameraConnection(ws, wss);
        } else if (role.startsWith('client')) {
            handleClientConnection(ws, wss);
        } else {
            console.warn(`Unknown role in URL: ${role}. Closing connection.`);
            return ws.close();
        }

        console.log(`Total Camera Sessions: ${cameraSessions.size} | Total WebSocket Clients: ${wss.clients.size}`);
    });

    wss.on('error', (error) => {
        console.error("WebSocket server error:", error);
    });

    wss.on('close', () => {
        console.log("WebSocket server closed.");
    });
}