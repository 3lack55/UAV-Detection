import { WebSocketServer } from "ws";
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const cameraSessions = new Map();
const clientSessions = new Map();

const events = new Map();
const eventTimeout = 0.5 * 60 * 1000; // 0.5 นาที

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
const HEARTBEAT_INTERVAL = process.env.HEARTBEAT_INTERVAL || 30000; // 30 วินาที

function heartbeat() {
    this.isAlive = true;
}

function getApiUrl() {
    const port = process.env.PORT || 3001;
    const host = process.env.API_HOST || 'localhost';
    return `http://${host}:${port}`;
}

function getOrCreateSession(cameraId) {
    if (!cameraSessions.has(cameraId)) {
        cameraSessions.set(cameraId, {
            viewers: new Set(),
            sender: null,
            stats: {
                framesRelayed: 0,
                bytesRelayed: 0
            },
            lastUnpacked: 0
        });
        console.log(`📦 Created session: ${cameraId}`);
    }
    return cameraSessions.get(cameraId);
}

function unpackage(received) {
    if (Buffer.isBuffer(received)) {
        if (received.length < 4) {
            console.log("Buffer เล็กเกินไป ไม่ใช่แพ็กเกจที่ถูกต้อง");
            return null;
        }

        try {
            const jsonLen = received.readUInt32LE(0);
            const jsonBuffer = received.subarray(4, 4 + jsonLen);

            let jsonStr = jsonBuffer.toString('utf-8');
            jsonStr = jsonStr.replace(/\0/g, '').trim();

            const data = JSON.parse(jsonStr);
            const imageBuffer = received.subarray(4 + jsonLen);

            return { meta: data, image: imageBuffer };

        } catch (error) {
            console.error("Server's unpackage error:", error);
            const len = received.readUInt32LE(0);
            if (len > 0 && len <= received.length) {
                const rawGarbage = received.subarray(4, 4 + len).toString('utf-8');
                console.log("Raw String ที่พังคือ:", rawGarbage);
            }
            return null;
        }
    }
}

function broadcastToViewers(cameraId, data, isBinary) {
    const session = cameraSessions.get(cameraId);
    if (!session || session.viewers.size === 0) return;

    // อัปเดตสถิติ
    session.stats.framesRelayed++;
    session.stats.bytesRelayed += isBinary ? data.byteLength : data.length;

    // วนลูปส่งให้คนดูทุกคน
    for (const client of session.viewers) {
        if (client.readyState === 1) { // 1 = OPEN
            // เช็ค Backpressure: ถ้าเน็ตคนดูช้ามาก (Buffer เต็ม) ให้ข้ามเฟรมนี้ไปเลย (Drop Frame)
            // ป้องกัน Server ความจำเต็ม
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
function broadcastToClients() {
    const detectingCameras = [];
    for (const e of events.entries()) {
        detectingCameras.push({cameraId: e[0]});
    }

    const onlineUsers = [];
    for (const [ws, userData] of clientSessions.entries()) {
        onlineUsers.push({
            userId: userData.userId,
            username: userData.username,
            role: userData.role
        });
    }

    const payload = {
        type: 'status_update',
        data: {
            detectingCameras: detectingCameras,
            onlineUsers: onlineUsers
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

async function createEvent(cameraId, start) {
    if (!cameraId) {
        console.warn("Camera ID is required to create event session.");
        return null;
    }

    const post_url = `${getApiUrl()}/api/event/createEvent`;

    const payload = {
        cameraId: cameraId,
        startTime: start || new Date()
    }

    try {
        const response = await fetch(post_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        return result.eventId;
    } catch (error) {
        console.error("Failed to create event session:", error);
    }
}

async function endEvent(cameraId) {
    if (!events.has(cameraId)) return;

    const patch_url = `${getApiUrl()}/api/event/endEvent`;

    const payload = {
        eventId: events.get(cameraId).eventId
    }

    try {
        const response = await fetch(patch_url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        events.delete(cameraId);
        broadcastToClients(); // Broadcast when event ends
    } catch (error) {
        console.error("Failed to end event session:", error);
    }
}

async function writeEventData(eventId, cameraId, data) {
    if (!events.has(cameraId)) return;

    const post_url = `${getApiUrl()}/api/event/writeEventData`;

    const payload = {
        eventId: eventId,
        data: {
            uavs: data.meta.uavs || [],
            image: data.image ? data.image.toString('base64') : null,
            modelSize: data.meta.image_size?.model_size || null,
            cameraInfo: data.meta.camera || {},
            timestamp: data.meta.timestamp || new Date()
        }
    }

    try {
        const response = await fetch(post_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error("Failed to write event data:", error);
    }
}

async function checkEventTimeouts() {
    const now = Date.now();
    for (const [cameraId, eventData] of events.entries()) {
        if (now - new Date(eventData.lastActivity).getTime() > eventTimeout) {
            console.log(`Event for camera${cameraId} has timed out. Ending event.`);
            await endEvent(cameraId);
        }
    }
}

setInterval(() => checkEventTimeouts(), 3000);

async function uavEventHandler(data) {
    const cameraId = data.meta?.camera?.camera_id || null;
    const timestamp = data.meta.timestamp || new Date();
    if (!cameraId) {
        console.warn("UAV event received but camera_id is missing");
        return;
    }

    try {
        const isNewEvent = !events.has(cameraId);
        
        if (isNewEvent) {
            const eventId = await createEvent(cameraId, timestamp);
            if (!eventId) {
                console.error(`Failed to create event for camera${cameraId}`);
                return;
            }
            events.set(cameraId, { lastActivity: timestamp, eventId: eventId });
            await writeEventData(eventId, cameraId, data);
            
            // Broadcast when new event detected
            broadcastToClients();
        } else {
            let eventData = events.get(cameraId);
            if (!eventData || !eventData.eventId) {
                console.error(`Invalid event data for camera${cameraId}`);
                return;
            }
            const eventId = eventData.eventId;
            events.set(cameraId, { lastActivity: timestamp, eventId: eventId });
            await writeEventData(eventId, cameraId, data);
        }
    } catch (error) {
        console.error(`Error handling UAV event for camera${cameraId}:`, error);
    }
}

export function initializeWebSocket(server) {
    const wss = new WebSocketServer({
        server,
        perMessageDeflate: false, // ปิดการบีบอัดเพื่อลด Latency
        maxPayload: 5 * 1024 * 1024 // รับไฟล์ใหญ่สุด 5MB
    });

    console.log('WebSocket Stream Server is running.');

    wss.on('connection', (ws, req) => {
        const parts = req.url.split('/').filter(p => p);
        if (parts.length === 0) return ws.close();

        const role = parts[0]; // 'camera1' หรือ 'streamViewer'

        if (role === 'streamViewer') {
            // --- กรณีเป็น Viewer (Frontend) ---
            const cameraId = parts[1];
            if (!cameraId) return ws.close();

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
                        const session = cameraSessions.get(cameraId);
                        if (session && session.sender && session.sender.readyState === 1) {
                            try {
                                session.sender.send(JSON.stringify(msg));
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

        } else if (role.startsWith('camera')) {
            // --- กรณีเป็น Sender (Camera/Python) ---
            const cameraId = role; // สมมติว่า url คือ /camera1 เลย
            console.log(`📷 Camera connected: ${cameraId}`);

            const session = getOrCreateSession(cameraId);
            session.sender = ws;

            ws.on('message', (message, isBinary) => {
                broadcastToViewers(cameraId, message, isBinary);

                if (session.lastUnpacked && (Date.now() - session.lastUnpacked < 3000)) {
                    return;
                }
                let unpacked = unpackage(message);
                session.lastUnpacked = Date.now();

                // console.log(`Received from camera${cameraId}:`, unpacked?.meta || "No metadata");   

                if (unpacked && unpacked.meta && unpacked.meta.uavs && unpacked.meta.uavs.length > 0) {
                    uavEventHandler(unpacked);
                }
            });

            ws.on('close', () => {
                console.log(`Camera disconnected: ${cameraId}`);
                const s = cameraSessions.get(cameraId);
                if (s) s.sender = null;
                console.log(`Total Camera Sessions: ${cameraSessions.size} | Total WebSocket Clients: ${wss.clients.size}`);
            });

            ws.on('error', (e) => console.error(`Camera error: ${e.message}`));
        } else if (role.startsWith("client")) {
            let isAuthenticated = false;
            let clientData = null;
            let authTimeout = null;

            // Wait for authentication message from client instead of checking URL params
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

    // (Optional) Loop แสดง Stat ทุก 10 วินาที
    // setInterval(() => {
    //     cameraSessions.forEach((session, id) => {
    //         if (session.stats.framesRelayed > 0) {
    //             console.log(`📊 [${id}] Relayed: ${session.stats.framesRelayed} frames, Viewers: ${session.viewers.size}`);
    //             session.stats.framesRelayed = 0; // Reset counter
    //         }
    //     });
    // }, 10000);
}