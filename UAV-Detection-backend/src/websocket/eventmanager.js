import { events, eventTimeout } from './state.js';
import { getApiUrl } from './utils.js';
import { broadcastToClients } from './broadcast.js';

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

export async function endEvent(cameraId) {
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
        broadcastToClients();
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

export async function checkEventTimeouts() {
    const now = Date.now();
    for (const [cameraId, eventData] of events.entries()) {
        if (now - eventData.lastActivity > eventTimeout) {
            console.log(`Event for camera${cameraId} has timed out. Ending event.`);
            await endEvent(cameraId);
        }
    }
}

setInterval(() => checkEventTimeouts(), 3000);

export async function uavEventHandler(data) {
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
            events.set(cameraId, { lastActivity: Date.now(), eventId: eventId });
            await writeEventData(eventId, cameraId, data);

            broadcastToClients();
        } else {
            let eventData = events.get(cameraId);
            if (!eventData || !eventData.eventId) {
                console.error(`Invalid event data for camera${cameraId}`);
                return;
            }
            const eventId = eventData.eventId;
            events.set(cameraId, { lastActivity: Date.now(), eventId: eventId });
            await writeEventData(eventId, cameraId, data);
        }
    } catch (error) {
        console.error(`Error handling UAV event for camera${cameraId}:`, error);
    }
}