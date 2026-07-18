import { cameraSessions } from '../state.js';
import { getOrCreateSession } from '../utils.js';

// --- กรณีเป็น Viewer (Frontend) ---
export function handleViewerConnection(ws, cameraId, wss) {
    console.log(`Viewer connected to ${cameraId}`);
    const session = getOrCreateSession(cameraId);
    session.viewers.add(ws);

    ws.on('close', () => {
        console.log(`Viewer disconnected from ${cameraId}`);
        session.viewers.delete(ws);
        console.log(`Total Camera Sessions: ${cameraSessions.size} | Total WebSocket Clients: ${wss.clients.size}`);
    });

    ws.on('error', (e) => console.error(`Viewer error: ${e.message}`));

    ws.on('message', (message) => {
        if (typeof message !== 'string' && !Buffer.isBuffer(message)) return;

        let msgStr = typeof message === 'string' ? message : message.toString();
        try {
            const msg = JSON.parse(msgStr);
            if (msg.type === 'ack' || msg.type === 'control') {
                const targetSession = cameraSessions.get(cameraId);
                if (targetSession && targetSession.sender && targetSession.sender.readyState === 1) {
                    try {
                        targetSession.sender.send(JSON.stringify(msg));
                    } catch (e) {
                        console.error(`Failed to forward to camera ${cameraId}: ${e.message}`);
                    }
                } else {
                    console.warn(`No camera connected for ${cameraId}; cannot forward ${msg.type}`);
                }
            }
        } catch (err) {
            console.error("Invalid message from viewer:", err);
        }
    });
}