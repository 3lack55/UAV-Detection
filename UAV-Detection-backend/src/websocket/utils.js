import { cameraSessions } from './state.js';

export function heartbeat() {
    this.isAlive = true;
}

export function getApiUrl() {
    const port = process.env.PORT || 3001;
    const host = process.env.API_HOST || 'localhost';
    return `http://${host}:${port}`;
}

export function getOrCreateSession(cameraId) {
    if (!cameraSessions.has(cameraId)) {
        cameraSessions.set(cameraId, {
            viewers: new Set(),
            sender: null,
            lastUnpacked: Date.now(),
            currentController: null,
            holderImage: null,
            lastBoardcastHolderImage: Date.now()
        });
        console.log(`Created session: ${cameraId}`);
    }
    return cameraSessions.get(cameraId);
}

export function unpackage(received) {
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