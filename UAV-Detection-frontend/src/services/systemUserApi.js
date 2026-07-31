import { API_BASE_URL } from "../config/api";
import { requestJson } from "./apiClient";

const authOptions = (token, options = {}) => ({
  ...options,
  headers: {
    Authorization: `Bearer ${token}`,
    ...options.headers,
  },
});

export function getAllUsers(token) {
  return requestJson(`${API_BASE_URL}/api/systemControl/allUsers`, authOptions(token));
}

export function createUser(username, role, token) {
  return requestJson(`${API_BASE_URL}/api/auth/admin/create-user`, authOptions(token, {
    method: "POST",
    body: JSON.stringify({ username, role }),
  }));
}

export function changeUserRole(userId, role, token) {
  return requestJson(`${API_BASE_URL}/api/systemControl/changeRole/${userId}`, authOptions(token, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  }));
}

export function deleteUser(userId, token) {
  return requestJson(`${API_BASE_URL}/api/systemControl/deleteUser/${userId}`, authOptions(token, {
    method: "DELETE",
  }));
}
