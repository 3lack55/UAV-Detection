import express from "express";  
import { doQuery } from "../database/mysqlConnection.js";
import { protect } from "../middlewares/authMiddleware.js";

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
        if (!req.params.cameraId) return res.status(400).json({ success: false, message: "Camera ID is required."});
        const result = await doQuery(`UPDATE cameras SET camera_name = '${req.body.camera_name}', latitude = ${req.body.latitude}, longitude = ${req.body.longitude}, status = '${req.body.status}' WHERE camera_id = ${req.params.cameraId}`);
        if (result.affectedRows === 0) return res.status(400).json({ success: false, message: `Camera ID ${req.params.cameraId} not found.`});
        res.status(200).json({ success: true, message: `Updated camera with ID ${req.params.cameraId}.`});
    } catch (err) {
        console.error("Error updating camera:", err);
        res.status(500).json({ success: false, message: "Failed to update camera." });
    }
});

cameraRouter.post("/addCamera", protect, async (req, res) => {
    try {
        await doQuery(`INSERT INTO cameras (camera_name, latitude, longitude, status) VALUE ('${req.body.camera_name}', ${req.body.latitude}, ${req.body.longitude}, '${req.body.status}')`);
        res.status(201).json({ success: true, message: 'Added new camera.' });
    } catch (err) {
        console.error("Error adding new camera:", err);
        res.status(500).json({ success: false, message: "Failed to add new camera." });
    }
});

cameraRouter.post("/assignCamera", protect, async (req, res) => {
    try {
        const existingPermission = await doQuery(`SELECT * FROM camera_assignments WHERE user_id = ${req.body.user_id} AND camera_id = ${req.body.camera_id}`);
        console.log(existingPermission.length);
        if (existingPermission.length > 0) {
            if (req.body.permission_level === "unassigned") {
                const result = await doQuery(`DELETE FROM camera_assignments WHERE user_id = ${req.body.user_id} AND camera_id = ${req.body.camera_id}`);
                if (result.affectedRows === 0) return res.status(400).json({ success: false, message: `Failed unassign permission level.`});
                return res.status(200).json({ success: true, message: `Unassigned permission for user id ${req.body.user_id} to camera id ${req.body.camera_id}.`});
            }

            const result = await doQuery(`UPDATE camera_assignments SET permission_level = '${req.body.permission_level}' WHERE user_id = ${req.body.user_id} AND camera_id = ${req.body.camera_id}`);
            if (result.affectedRows === 0) return res.status(400).json({ success: false, message: `Failed assign permission level.`});
            res.status(200).json({ success: true, message: `Updated permission level for user id ${req.body.user_id} to camera id ${req.body.camera_id}, permission: ${req.body.permission_level}.`});
        }
        await doQuery(`INSERT INTO camera_assignments (user_id, camera_id, permission_level) VALUE (${req.body.user_id}, ${req.body.camera_id}, '${req.body.permission_level}')`);
        res.status(201).json({ success: true, message: `Assigned new permission to user id ${req.body.user_id}.` });
    } catch (err) {
        console.error("Error for permission assign:", err);
        res.status(500).json({ success: false, message: "Failed assign permission level." });
    }
});

export default cameraRouter;