import { useContext } from "react";
import { WebSocketContext } from "./websocket-context-definition";

export const useWebSocket = () => useContext(WebSocketContext);
