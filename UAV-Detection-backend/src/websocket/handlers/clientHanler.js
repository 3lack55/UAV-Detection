import jwt from 'jsonwebtoken';
import { cameraSessions, clientSessions, JWT_SECRET } from '../state.js';
import { broadcastToClients } from '../broadcast.js';

export function handleClientConnection(ws, wss) {
    let isAuthenticated = false;
    let clientData = null;
    let authTimeout = null;

    ws.once('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'auth' && data.token) {
                try {
                    const decoded = jwt.verify(data.token, JWT_SECRET);
                    clientData = { userId: decoded.user_id, username: decoded.username, role: decoded.role };
                    clientSessions.set(ws, clientData);
                    isAuthenticated = true;
                    console.log(`Client connected: ${decoded.username} (ID: ${decoded.user_id}, Role: ${decoded.role})`);

                    // Clear auth timeout on successful auth
                    if (authTimeout) clearTimeout(authTimeout);

                    ws.send(JSON.stringify({ type: 'auth_response', success: true }));

                    // Broadcast updated status to all clients
                    broadcastToClients();
                } catch (err) {
                    console.warn("Client connection rejected: Invalid token.");
                    if (authTimeout) clearTimeout(authTimeout);
                    ws.close(4002, "Unauthorized: Invalid token");
                    return;
                }
            } else {
                console.warn("Client connection rejected: No token provided.");
                if (authTimeout) clearTimeout(authTimeout);
                ws.close(4001, "Unauthorized: No token provided");
                return;
            }
        } catch (err) {
            console.warn("Client connection error:", err.message);
            if (authTimeout) clearTimeout(authTimeout);
            ws.close(4000, "Bad message format");
            return;
        }
    });

    // Set a timeout for auth message
    authTimeout = setTimeout(() => {
        if (!isAuthenticated) {
            console.warn("Client connection timeout: No auth message received");
            ws.close(4003, "Authentication timeout");
        }
    }, 5000);

    ws.on('message', (message) => {
        // Only process messages from authenticated clients
        if (!isAuthenticated) return;

        try {
            const data = JSON.parse(message);
            // Handle client messages here
        } catch (err) {
            console.error("Client message error:", err.message);
        }
    });

    ws.on('close', () => {
        if (authTimeout) clearTimeout(authTimeout);

        if (clientData) {
            console.log(`Client disconnected: ${clientData.username} (ID: ${clientData.userId})`);
            clientSessions.delete(ws);
            console.log(`Total Camera Sessions: ${cameraSessions.size} | Total WebSocket Clients: ${wss.clients.size}`);
            // Broadcast updated status to remaining clients
            broadcastToClients();
        } else {
            console.log("Unknown client disconnected");
        }
    });

    ws.on('error', (e) => console.error(`Client error: ${e.message}`));
}