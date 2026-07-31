const HOST = import.meta.env.VITE_API_HOST || "localhost";
const PORT = import.meta.env.VITE_API_PORT || "3000";
const API_PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";
const WEBSOCKET_PROTOCOL =
	import.meta.env.VITE_WS_PROTOCOL || (API_PROTOCOL === "https" ? "wss" : "ws");

export const API_BASE_URL = `${API_PROTOCOL}://${HOST}:${PORT}`;
export const WEBSOCKET_BASE_URL = `${WEBSOCKET_PROTOCOL}://${HOST}:${PORT}`;
