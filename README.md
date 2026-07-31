# UAV-Detection
 A web application project for viewing and controlling UAV detection cameras

## Deploy with Docker

On a fresh server with Docker Desktop or Docker Engine and the Compose plugin:

```powershell
git clone <repository-url>
cd UAV_DetectionAndPositioning
Copy-Item .env.example .env
notepad .env
docker compose up -d --build
```

In `.env`, set `VITE_API_HOST` to the server's public IP address or domain name,
then set strong values for `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, and
`JWT_SECRET`. Use `https` and `wss` for `VITE_API_PROTOCOL` and `VITE_WS_PROTOCOL`
when the site is served through TLS.

The frontend is available on `FRONTEND_PORT` (default `8080`) and the backend API
and WebSocket server on `BACKEND_PORT` (default `3000`). SQL files in
`database/init` run automatically when the MySQL volume is created for the first
time.

Useful commands:

```powershell
docker compose ps
docker compose logs -f backend
docker compose down
```

To re-run the database initialization scripts, remove the database volume first.
This deletes the existing database data:

```powershell
docker compose down -v
docker compose up -d --build
```
