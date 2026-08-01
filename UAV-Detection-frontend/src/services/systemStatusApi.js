import { API_BASE_URL } from "../config/api";
import { requestJson } from "./apiClient";

export function getSystemStatus(token) {
  return requestJson(`${API_BASE_URL}/api/systemStatus/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}