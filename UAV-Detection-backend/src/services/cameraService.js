import express from "express";
import { doQuery } from "../database/mysqlConnection.js";
import { protect } from "../middlewares/authMiddleware.js";
import { broadcastSystemUpdate } from "../../socket.js";

const cameraRouter = express.Router();

cameraRouter.get("/getAllCameras", async (req, res) => {
    try {
        const cameras = await doQuery("SELECT * FROM cameras");
        res.status(200).json({ success: true, data: cameras });
    } catch (err) {
        console.error("Error fetching cameras:", err);
        res.status(500).json({ success: false, message: "Failed to fetch cameras." });
    }
});

cameraRouter.get("/getAllPermissions", protect, async (req, res) => {
    try {
        const permissions = await doQuery("SELECT * FROM camera_assignments");
        res.status(200).json({ success: true, data: permissions });
    } catch (err) {
        console.error("Error fetching camera permissions:", err);
        res.status(500).json({ success: false, message: "Failed to fetch camera permissions." });
    }
});

cameraRouter.get("/getCameraPermissionsByUser/:userId", protect, async (req, res) => {
    try {
        const { userId } = req.params;
        const permissions = await doQuery("SELECT * FROM camera_assignments WHERE user_id = ?", [userId]);
        res.status(200).json({ success: true, data: permissions });
    } catch (err) {
        console.error("Error fetching camera permissions:", err);
        res.status(500).json({ success: false, message: "Failed to fetch camera permissions." });
    }
});

cameraRouter.patch("/updateCamera/:cameraId", protect, async (req, res) => {
    try {
        if (!req.params.cameraId) return res.status(400).json({ success: false, message: "Camera ID is required." });

        const camera_name = req.body.camera_name ? req.body.camera_name : null;
        const latitude = req.body.latitude !== undefined ? req.body.latitude : null;
        const longitude = req.body.longitude !== undefined ? req.body.longitude : null;
        const status = req.body.status ? req.body.status : null;
        const heading = req.body.heading !== undefined ? req.body.heading : null;

        const updateFields = [];
        if (camera_name !== null) updateFields.push(`camera_name = '${camera_name}'`);
        if (latitude !== null) updateFields.push(`latitude = ${latitude}`);
        if (longitude !== null) updateFields.push(`longitude = ${longitude}`);
        if (status !== null) updateFields.push(`status = '${status}'`);
        if (heading !== null) updateFields.push(`heading = ${parseInt(heading)}`);

        const result = await doQuery(`UPDATE cameras SET ${updateFields.join(', ')}, last_update = NOW() WHERE camera_id = ${req.params.cameraId}`);
        if (result.affectedRows === 0) return res.status(400).json({ success: false, message: `Camera ID ${req.params.cameraId} not found.` });
        broadcastSystemUpdate("camera_changed", { action: "updated", cameraId: req.params.cameraId, camera: { camera_id: req.params.cameraId, ...req.body } });
        res.status(200).json({ success: true, message: `Updated camera with ID ${req.params.cameraId}.` });
    } catch (err) {
        console.error("Error updating camera:", err);
        res.status(500).json({ success: false, message: "Failed to update camera." });
    }
});

cameraRouter.post("/addCamera", protect, async (req, res) => {
    try {
        const result = await doQuery(`INSERT INTO cameras (camera_name, latitude, longitude, status, last_update) VALUES ('${req.body.camera_name}', ${req.body.latitude}, ${req.body.longitude}, '${req.body.status}', NOW())`);
        const cameraId = result.insertId;
        broadcastSystemUpdate("camera_changed", { action: "created", camera: { camera_id: cameraId, ...req.body } });
        res.status(201).json({ success: true, message: 'Added new camera.', data: { camera_id: cameraId, ...req.body } });
    } catch (err) {
        console.error("Error adding new camera:", err);
        res.status(500).json({ success: false, message: "Failed to add new camera." });
    }
});

cameraRouter.delete("/deleteCamera/:cameraId", protect, async (req, res) => {
    try {
        if (!req.params.cameraId) return res.status(400).json({ success: false, message: "Camera ID is required." });
        const result = await doQuery(`DELETE FROM cameras WHERE camera_id = ${req.params.cameraId}`);
        if (result.affectedRows === 0) return res.status(400).json({ success: false, message: `Camera ID ${req.params.cameraId} not found.` });
        broadcastSystemUpdate("camera_changed", { action: "deleted", cameraId: req.params.cameraId });
        res.status(200).json({ success: true, message: `Deleted camera with ID ${req.params.cameraId}.` });
    } catch (err) {
        console.error("Error deleting camera:", err);
        res.status(500).json({ success: false, message: "Failed to delete camera." });
    }
});

cameraRouter.post("/assignCamera", protect, async (req, res) => {
    try {
        const existingPermission = await doQuery(`SELECT * FROM camera_assignments WHERE user_id = ${req.body.user_id} AND camera_id = ${req.body.camera_id}`);
        if (existingPermission.length > 0) {
            if (req.body.permission_level === "unassigned") {
                const result = await doQuery(`DELETE FROM camera_assignments WHERE user_id = ${req.body.user_id} AND camera_id = ${req.body.camera_id}`);
                if (result.affectedRows === 0) return res.status(400).json({ success: false, message: `Failed unassign permission level.` });
                broadcastSystemUpdate("permission_changed", { userId: req.body.user_id, cameraId: req.body.camera_id, permissionLevel: null, action: "removed" });
                return res.status(200).json({ success: true, message: `Unassigned permission for user id ${req.body.user_id} to camera id ${req.body.camera_id}.` });
            }

            const result = await doQuery(`UPDATE camera_assignments SET permission_level = '${req.body.permission_level}' WHERE user_id = ${req.body.user_id} AND camera_id = ${req.body.camera_id}`);
            if (result.affectedRows === 0) return res.status(400).json({ success: false, message: `Failed assign permission level.` });
            broadcastSystemUpdate("permission_changed", { userId: req.body.user_id, cameraId: req.body.camera_id, permissionLevel: req.body.permission_level, action: "updated" });
            return res.status(200).json({ success: true, message: `Updated permission level for user id ${req.body.user_id} to camera id ${req.body.camera_id}, permission: ${req.body.permission_level}.` });
        }
        await doQuery(`INSERT INTO camera_assignments (user_id, camera_id, permission_level) VALUE (${req.body.user_id}, ${req.body.camera_id}, '${req.body.permission_level}')`);
        broadcastSystemUpdate("permission_changed", { userId: req.body.user_id, cameraId: req.body.camera_id, permissionLevel: req.body.permission_level, action: "created" });
        res.status(201).json({ success: true, message: `Assigned new permission to user id ${req.body.user_id}.` });
    } catch (err) {
        console.error("Error for permission assign:", err);
        res.status(500).json({ success: false, message: "Failed assign permission level." });
    }
});

cameraRouter.patch("/updateStatus/:cameraId", async (req, res) => {
    try {
        if (!req.params.cameraId) return res.status(400).json({ success: false, message: "Camera ID is required." });

        const camera_name = req.body.camera_name ? req.body.camera_name : null;
        const latitude = req.body.latitude !== undefined ? req.body.latitude : null;
        const longitude = req.body.longitude !== undefined ? req.body.longitude : null;
        const status = req.body.status ? req.body.status : null;
        const heading = req.body.heading !== undefined ? req.body.heading : null;
        const controllable = req.body.controllable !== undefined ? req.body.controllable : null;

        const updateFields = [];
        if (camera_name !== null) updateFields.push(`camera_name = '${camera_name}'`);
        if (latitude !== null) updateFields.push(`latitude = ${latitude}`);
        if (longitude !== null) updateFields.push(`longitude = ${longitude}`);
        if (status !== null) updateFields.push(`status = '${status}'`);
        if (heading !== null) updateFields.push(`heading = ${parseInt(heading)}`);
        if (controllable !== null) updateFields.push(`controllable = ${controllable}`);

        console.log("Updating camera with fields:", updateFields);

        const result = await doQuery(`UPDATE cameras SET ${updateFields.join(', ')}, last_update = NOW() WHERE camera_id = ${req.params.cameraId}`);
        if (result.affectedRows === 0) return res.status(400).json({ success: false, message: `Camera ID ${req.params.cameraId} not found.` });
        broadcastSystemUpdate("camera_changed", { action: "updated", cameraId: req.params.cameraId, camera: { camera_id: req.params.cameraId, ...req.body } });
        res.status(200).json({ success: true, message: `Updated camera with ID ${req.params.cameraId}.` });
    } catch (err) {
        console.error("Error updating camera:", err);
        res.status(500).json({ success: false, message: "Failed to update camera." });
    }
});

export default cameraRouter;