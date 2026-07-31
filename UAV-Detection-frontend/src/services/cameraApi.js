import { API_BASE_URL } from "../config/api";
import { requestJson } from "./apiClient";

export function getCameraPermissions(userId, token) {
  return requestJson(`${API_BASE_URL}/api/camera/getCameraPermissionsByUser/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getAllCameras() {
  return requestJson(`${API_BASE_URL}/api/camera/getAllCameras`);
}
