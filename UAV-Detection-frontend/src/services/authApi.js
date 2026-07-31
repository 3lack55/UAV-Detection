import { API_BASE_URL } from "../config/api";
import { requestJson } from "./apiClient";

export function loginUser(credentials) {
  return requestJson(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function registerUser(credentials) {
  return requestJson(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function updateUsername(userId, username, token) {
  return requestJson(`${API_BASE_URL}/api/auth/user/${userId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ username }),
  });
}

export function changePassword(currentPassword, newPassword, token) {
  return requestJson(`${API_BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function uploadProfileImage(formData, token) {
  return requestJson(`${API_BASE_URL}/api/auth/upload-profile-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}
