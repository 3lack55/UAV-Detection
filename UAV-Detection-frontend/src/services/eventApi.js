import { API_BASE_URL } from "../config/api";
import { requestJson } from "./apiClient";

export function getEvents() {
  return requestJson(`${API_BASE_URL}/api/event/getEvents`);
}

export function getEventDetails(eventId) {
  return requestJson(`${API_BASE_URL}/api/event/readEventData`, {
    method: "POST",
    body: JSON.stringify({ eventId }),
  });
}

export function markEventAsRead(eventId) {
  return requestJson(`${API_BASE_URL}/api/event/markEventRead`, {
    method: "PATCH",
    body: JSON.stringify({ eventId }),
  });
}
