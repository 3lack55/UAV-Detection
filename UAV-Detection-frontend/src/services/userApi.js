import { API_BASE_URL } from "../config/api";
import { requestJson } from "./apiClient";

export function getUsersByIds(userIds, token) {
  return requestJson(`${API_BASE_URL}/api/auth/userQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userIds }),
  });
}
