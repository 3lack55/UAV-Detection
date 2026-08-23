const HOST = import.meta.env.VITE_API_HOST || "localhost";
const PORT = import.meta.env.VITE_API_PORT;
const API_PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";
const WEBSOCKET_PROTOCOL =
	import.meta.env.VITE_WS_PROTOCOL || (API_PROTOCOL === "https" ? "wss" : "ws");

// Omit the port when it's unset, e.g. behind a tunnel/proxy on the protocol's default port.
const PORT_SUFFIX = PORT ? `:${PORT}` : "";

export const API_BASE_URL = `${API_PROTOCOL}://${HOST}${PORT_SUFFIX}`;
export const WEBSOCKET_BASE_URL = `${WEBSOCKET_PROTOCOL}://${HOST}${PORT_SUFFIX}`;
