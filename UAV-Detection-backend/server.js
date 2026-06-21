import { createServer } from 'http';
import dotenv from 'dotenv';
import app from './app.js';
import { initializeWebSocket } from './socket.js';

dotenv.config();

const server = createServer(app);

initializeWebSocket(server);

const PORT = process.env.PORT || 3001 || 3002;

server.listen(PORT, () => {
  console.log(`Server (HTTP + WebSocket) is running on http://localhost:${PORT}`);
});