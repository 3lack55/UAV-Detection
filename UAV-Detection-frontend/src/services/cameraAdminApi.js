import { API_BASE_URL } from "../config/api";
import { requestJson } from "./apiClient";

const authOptions = (token, options = {}) => ({
  ...options,
  headers: {
    Authorization: `Bearer ${token}`,
    ...options.headers,
  },
});

export function getAllPermissions(token) {
  return requestJson(`${API_BASE_URL}/api/camera/getAllPermissions`, authOptions(token));
}

export function getAllCameras() {
  return requestJson(`${API_BASE_URL}/api/camera/getAllCameras`);
}

export function getAllUsers(token) {
  return requestJson(`${API_BASE_URL}/api/systemControl/allUsers`, authOptions(token));
}

export function saveCamera(camera, isEdit, token) {
  const path = isEdit
    ? `${API_BASE_URL}/api/camera/updateCamera/${camera.camera_id}`
    : `${API_BASE_URL}/api/camera/addCamera`;

  return requestJson(path, authOptions(token, {
    method: isEdit ? "PATCH" : "POST",
    body: JSON.stringify(camera),
  }));
}

export function assignCamera(cameraId, userId, permission, token) {
  return requestJson(`${API_BASE_URL}/api/camera/assignCamera`, authOptions(token, {
    method: "POST",
    body: JSON.stringify({
      camera_id: cameraId,
      user_id: userId,
      permission_level: permission,
    }),
  }));
}

export function deleteCamera(cameraId, token) {
  return requestJson(`${API_BASE_URL}/api/camera/deleteCamera/${cameraId}`, authOptions(token, {
    method: "DELETE",
  }));
}
