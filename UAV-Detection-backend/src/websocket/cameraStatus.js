import { getApiUrl } from './utils.js';

export async function updateCameraStatus(cameraId, status, meta = null) {
    const patch_url = `${getApiUrl()}/api/camera/updateStatus/${cameraId}`;

    const payload = {
        status: status,
        latitude: meta?.camera?.lat || null,
        longitude: meta?.camera?.lon || null,
        heading: meta?.heading?.installFace || null,
        controllable: meta?.controllable || false
    };

    try {
        const response = await fetch(patch_url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log(`Camera ${cameraId} status updated to ${status}.`);
        return true;
    } catch (error) {
        console.error(`Failed to update camera ${cameraId} status:`, error);
        return false;
    }
}