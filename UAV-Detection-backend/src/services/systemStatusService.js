import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { doQuery } from '../database/mysqlConnection.js';
import { protect } from '../middlewares/authMiddleware.js';
import { getRequestMetrics } from '../middlewares/request-info.js';
import { cameraSessions, clientSessions, events } from '../websocket/state.js';

const systemStatusRouter = express.Router();

function getCpuUsagePercent() {
    return new Promise((resolve) => {
        const start = os.cpus();
        setTimeout(() => {
            const end = os.cpus();
            let idleDiff = 0;
            let totalDiff = 0;
            for (let i = 0; i < start.length; i++) {
                const s = start[i].times;
                const e = end[i].times;
                const startTotal = s.user + s.nice + s.sys + s.idle + s.irq;
                const endTotal = e.user + e.nice + e.sys + e.idle + e.irq;
                totalDiff += endTotal - startTotal;
                idleDiff += e.idle - s.idle;
            }
            const usage = totalDiff > 0 ? 100 - (100 * idleDiff / totalDiff) : 0;
            resolve(Math.round(usage * 10) / 10);
        }, 150);
    });
}

function getDiskUsage() {
    try {
        const output = execSync('df -k .').toString().trim().split('\n');
        const parts = output[1].split(/\s+/);
        const totalKb = parseInt(parts[1], 10);
        const usedKb = parseInt(parts[2], 10);
        const availKb = parseInt(parts[3], 10);
        if (isNaN(totalKb) || isNaN(usedKb)) return null;
        return {
            totalBytes: totalKb * 1024,
            usedBytes: usedKb * 1024,
            freeBytes: availKb * 1024,
            usedPercent: Math.round((usedKb / totalKb) * 1000) / 10,
        };
    } catch (err) {
        return null;
    }
}

async function getDatabaseInfo() {
    const startTime = Date.now();
    try {
        const sizeResult = await doQuery(
            `SELECT
                SUM(data_length + index_length) AS size_bytes,
                COUNT(*) AS table_count
             FROM information_schema.TABLES
             WHERE table_schema = DATABASE()`
        );
        const latencyMs = Date.now() - startTime;
        return {
            status: 'connected',
            latencyMs,
            sizeBytes: Number(sizeResult[0]?.size_bytes) || 0,
            tableCount: Number(sizeResult[0]?.table_count) || 0,
        };
    } catch (err) {
        return {
            status: 'error',
            latencyMs: Date.now() - startTime,
            error: err.message,
        };
    }
}

function getUploadsInfo() {
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');

    if (!fs.existsSync(uploadsRoot)) {
        return {
            available: false,
            path: uploadsRoot,
            totalBytes: 0,
            fileCount: 0,
            error: 'Uploads directory not found',
        };
    }

    const walk = (dirPath) => {
        let totalBytes = 0;
        let fileCount = 0;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        entries.forEach((entry) => {
            const entryPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                const child = walk(entryPath);
                totalBytes += child.totalBytes;
                fileCount += child.fileCount;
            } else if (entry.isFile()) {
                const stats = fs.statSync(entryPath);
                totalBytes += stats.size;
                fileCount += 1;
            }
        });

        return { totalBytes, fileCount };
    };

    const stats = walk(uploadsRoot);
    return {
        available: true,
        path: uploadsRoot,
        totalBytes: stats.totalBytes,
        fileCount: stats.fileCount,
    };
}

function getDockerInfo() {
    try {
        const output = execSync('docker ps --format "{{.Names}}|{{.Status}}|{{.Image}}"', { encoding: 'utf8' }).trim();
        const containers = output
            ? output.split('\n').map((line) => {
                const [name, status, image] = line.split('|');
                return { name, status, image };
            }).filter((item) => item.name)
            : [];

        return {
            available: true,
            containerCount: containers.length,
            running: containers.filter((container) => /up/i.test(container.status)).length,
            containers,
        };
    } catch (err) {
        return {
            available: false,
            containerCount: 0,
            running: 0,
            containers: [],
            error: err.message,
        };
    }
}

function getProcessInfo() {
    try {
        const platform = os.platform();
        let output = '';

        if (platform === 'win32') {
            output = execSync('tasklist /FO CSV /NH', { encoding: 'utf8' });
            return {
                available: true,
                source: 'tasklist',
                processes: output
                    .split(/\r?\n/)
                    .filter(Boolean)
                    .slice(0, 8)
                    .map((line) => {
                        const [name] = line.split(',');
                        return { name: name?.replace(/^"|"$/g, '') || 'process' };
                    }),
            };
        }

        output = execSync('ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -n 8', { encoding: 'utf8' });
        const processes = output
            .split(/\r?\n/)
            .filter(Boolean)
            .slice(1)
            .map((line) => {
                const parts = line.trim().split(/\s+/);
                return {
                    pid: parts[0],
                    name: parts[1],
                    cpu: parts[2],
                    memory: parts[3],
                };
            });

        return {
            available: true,
            source: 'ps',
            processes,
        };
    } catch (err) {
        return {
            available: false,
            source: 'unavailable',
            processes: [],
            error: err.message,
        };
    }
}

async function getOperationalInfo() {
    const [cameras, eventStats] = await Promise.all([
        doQuery(`
            SELECT
                c.camera_id,
                c.camera_name,
                c.status,
                c.controllable,
                c.latitude,
                c.longitude,
                c.heading,
                c.last_update,
                COUNT(DISTINCT e.event_id) AS event_count,
                MAX(ed.time_stamp) AS last_detection_at
            FROM cameras c
            LEFT JOIN events e ON e.camera_id = c.camera_id
            LEFT JOIN event_datas ed ON ed.camera_id = c.camera_id
            WHERE c.deleted != 1
            GROUP BY c.camera_id, c.camera_name, c.status, c.controllable,
                c.latitude, c.longitude, c.heading, c.last_update
            ORDER BY c.camera_id;
        `),
        doQuery(`
            SELECT
                COUNT(*) AS total_events,
                SUM(CASE WHEN end_time IS NULL THEN 1 ELSE 0 END) AS active_events,
                SUM(CASE WHEN start_time >= ? THEN 1 ELSE 0 END) AS events_last_24h,
                MAX(start_time) AS last_event_at
            FROM events
        `, [new Date(Date.now() - 24 * 60 * 60 * 1000)]),
    ]);

    const connectedCameraIds = new Set(
        [...cameraSessions.entries()]
            .filter(([, session]) => session.sender?.readyState === 1)
            .map(([cameraId]) => String(cameraId).replace(/^camera/, ''))
    );

    const cameraHealth = cameras.map((camera) => ({
        ...camera,
        camera_id: Number(camera.camera_id),
        controllable: Boolean(camera.controllable),
        event_count: Number(camera.event_count) || 0,
        connected: connectedCameraIds.has(String(camera.camera_id)),
    }));

    const onlineUsers = [...clientSessions.values()].map(({ userId, username, role }) => ({
        userId,
        username,
        role,
    }));

    const connectedCameras = cameraHealth.filter((camera) => camera.connected).length;
    const detectingCameras = [...events.keys()].map((cameraId) => ({ cameraId }));
    const controlledCameras = [...cameraSessions.entries()]
        .filter(([, session]) => session.currentController)
        .map(([cameraId, session]) => ({ cameraId, controller: session.currentController }));

    return {
        cameras: {
            total: cameraHealth.length,
            connected: connectedCameras,
            offline: Math.max(cameraHealth.length - connectedCameras, 0),
            detecting: detectingCameras.length,
            controllable: cameraHealth.filter((camera) => camera.controllable).length,
            list: cameraHealth,
        },
        realtime: {
            websocketStatus: 'online',
            connectedClients: clientSessions.size,
            connectedCameras,
            viewers: [...cameraSessions.values()].reduce((count, session) => count + (session.viewers?.size || 0), 0),
            detectingCameras,
            controlledCameras,
            onlineUsers,
        },
        detection: {
            totalEvents: Number(eventStats[0]?.total_events) || 0,
            activeEvents: Number(eventStats[0]?.active_events) || 0,
            eventsLast24h: Number(eventStats[0]?.events_last_24h) || 0,
            lastEventAt: eventStats[0]?.last_event_at || null,
        },
    };
}

systemStatusRouter.get('/status', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'เฉพาะ Admin เท่านั้นที่ดูข้อมูลนี้ได้' });
        }

        const [cpuUsagePercent, database, operational] = await Promise.all([
            getCpuUsagePercent(),
            getDatabaseInfo(),
            getOperationalInfo(),
        ]);
        const disk = getDiskUsage();
        const uploads = getUploadsInfo();
        const docker = getDockerInfo();
        const processes = getProcessInfo();
        const requestMetrics = getRequestMetrics();

        const totalMem = os.totalmem();
        const freeMem = os.freemem();

        const services = [
            { name: 'REST API', status: 'online' },
            { name: 'ฐานข้อมูล (MySQL)', status: database.status === 'connected' ? 'online' : 'offline' },
            { name: 'WebSocket', status: operational.realtime.websocketStatus },
        ];

        const heap = process.memoryUsage();
        const unhealthyServices = services.filter((service) => service.status !== 'online').length;
        const errorRate = requestMetrics.errorRatePercent || 0;
        const overallStatus = database.status !== 'connected' || unhealthyServices > 0 || errorRate > 10
            ? 'critical'
            : operational.cameras.total > 0 && operational.cameras.connected === 0
                ? 'degraded'
                : 'operational';

        res.json({
            success: true,
            data: {
                server: {
                    status: overallStatus,
                    nodeVersion: process.version,
                    platform: os.platform(),
                    arch: os.arch(),
                    hostname: os.hostname(),
                    osUptimeSeconds: os.uptime(),
                    processUptimeSeconds: process.uptime(),
                },
                resources: {
                    cpu: {
                        cores: os.cpus().length,
                        model: os.cpus()[0]?.model || 'ไม่ทราบรุ่น',
                        usagePercent: cpuUsagePercent,
                    },
                    memory: {
                        totalBytes: totalMem,
                        freeBytes: freeMem,
                        usedBytes: totalMem - freeMem,
                        usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 1000) / 10,
                        processRssBytes: process.memoryUsage().rss,
                        processHeapUsedBytes: heap.heapUsed,
                        processHeapTotalBytes: heap.heapTotal,
                    },
                    disk, 
                    loadAverage: os.loadavg(),
                },
                database,
                services,
                operational,
                network: {
                    latencyMs: Number(requestMetrics.averageResponseTimeMs || 0).toFixed(2),
                    bytesIn: requestMetrics.bytesIn,
                    bytesOut: requestMetrics.bytesOut,
                },
                api: {
                    requestCount: requestMetrics.totalRequests,
                    errorCount: requestMetrics.totalErrors,
                    errorRatePercent: Number(requestMetrics.errorRatePercent || 0).toFixed(2),
                    responseTimeMs: Number(requestMetrics.averageResponseTimeMs || 0).toFixed(2),
                },
                storage: {
                    uploads,
                },
                processes: {
                    docker,
                    systemProcesses: processes.processes || [],
                },
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

export default systemStatusRouter;