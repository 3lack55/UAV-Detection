import express from "express";
import fs from "fs";
import { doQuery } from "../database/mysqlConnection.js";

const eventRouter = express.Router();

eventRouter.post("/createEvent", async (req, res) => {
    const { cameraId, startTime} = req.body;
    if (!cameraId) {
        return res.status(400).json({ success: false, message: "Camera ID is required." });
    }

    const query = "INSERT INTO events (camera_id, start_time) VALUES (?, ?)";
    try {
        const result = await doQuery(query, [cameraId, startTime || new Date()]);
        res.status(201).json({
            success: true,
            message: "Event created successfully.",
            eventId: result.insertId
        })
    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

eventRouter.patch("/endEvent", async (req, res) => {
    const { eventId } = req.body;
    if (!eventId) {
        return res.status(400).json({ success: false, message: "Event ID is required." });
    }

    const query = "UPDATE events SET end_time = NOW() WHERE event_id = ?";
    try {
        const result = await doQuery(query, [eventId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        res.status(200).json({
            success: true,
            message: "Event ended successfully."
        })

    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

eventRouter.get("/getEvents", async (req, res) => {
    const query = "SELECT * FROM events"
    try {
        const events = await doQuery(query);
        res.status(200).json({
            success: true,
            data: events
        })

    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

eventRouter.patch("/markEventRead", async (req, res) => {
    const { eventId } = req.body;
    if (!eventId) {
        return res.status(400).json({ success: false, message: "Event ID is required." });
    }

    const query = "UPDATE events SET seen = 1 WHERE event_id = ?";
    try {
        const result = await doQuery(query, [eventId]);
        if (result.affectedRows === 0) {
            throw  new Error("Event not found.");
        }

        res.status(200).json({
            success: true,
            message: "Event marked as read successfully."
        });
    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

eventRouter.post("/writeEventData", async (req, res) => {
    const {eventId, data} = req.body;
    if (!eventId || !data) {
        return res.status(400).json({ success: false, message: "Event ID and data are required." });
    }

    const cameraInfo = data.cameraInfo || {};
    // Support both camelCase and snake_case field names
    const cameraId = cameraInfo.cameraId || cameraInfo.camera_id || null;
    const cameraPosition = [cameraInfo.lat || null, cameraInfo.lon || null];

    const uav = data.uavs || [];

    const image = data.image ? Buffer.from(data.image, 'base64') : null;
    const imagePath = image ? `uploads/event_images/event_${eventId}_${Date.now()}.jpg` : null;

    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();

    const modelSize = data.modelSize || data.model_size || null;

    const eventData = {
        uavs: uav,
        cameraPosition: cameraPosition,
        modelSize: modelSize,
    }

    if (imagePath) {
        try {
            // Ensure uploads directory exists
            await fs.promises.mkdir('uploads/event_images', { recursive: true });
            await fs.promises.writeFile(imagePath, image);
        } catch (error) {
            console.error("File write error:", error);
            return res.status(500).json({ success: false, message: "Failed to save image." });
        }
    } 

    const query = "INSERT INTO event_datas (event_id, camera_id, event_data, image_path, time_stamp) VALUES (?, ?, ?, ?, ?)";

    try {
        const result = await doQuery(query, [eventId, cameraId, JSON.stringify(eventData), imagePath, timestamp]);
        res.status(201).json({
            success: true,
            message: "Event data saved successfully.",
            dataId: result.insertId
        });

    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }

    });

eventRouter.post("/readEventData", async (req, res) => {
    const { eventId } = req.body;
    if (!eventId) {
        return res.status(400).json({ success: false, message: "Event ID is required." });
    }

    const query = "SELECT * FROM event_datas WHERE event_id = ?";
    try {
        const eventData = await doQuery(query, [eventId]);
        if (eventData.length === 0) {
            return res.status(404).json({ success: false, message: "Event data not found." });
        }
        res.status(200).json({
            success: true,
            data: eventData
        });
    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

export default eventRouter;