import express from "express";  
import { doQuery } from "../database/mysqlConnection.js";
import { protect } from "../middlewares/authMiddleware.js";
import { broadcastSystemUpdate, invalidateUserSession } from "../../socket.js";

const systemControlRouter = express.Router();

systemControlRouter.get("/allUsers", protect, async (req, res) => {
    try {
        const users = await doQuery("SELECT user_id, username, role, profile_image, created_at, deleted FROM users");
        res.status(200).json({ success: true, data: users });

    } catch (error) {
        console.log("Error fetching users: ", error);
        return res.status(500).json({ success: false, message: "Failed to fetch all users."});
    }
});

systemControlRouter.patch("/changeRole/:userId", protect, async (req, res) => {
    if (!req.params.userId) return res.status(400).json({ success: false, message: "User ID is required."});
    try {
        const result = await doQuery(`UPDATE users SET role = "${req.body.role}" WHERE user_id = ${req.params.userId}`);
        if (result.affectedRows === 0) return res.status(400).json({ success: false, message: `User ID ${req.params.userId} not found.`});
        broadcastSystemUpdate("role_changed", { userId: req.params.userId, role: req.body.role, changedBy: req.user?.user_id || null });
        invalidateUserSession(req.params.userId, "Your account permissions were updated. Please sign in again.");
        res.status(200).json({ success: true, message: `Changed user's role with ID ${req.params.userId} to ${req.body.role}`});
    } catch (error) {
        console.log(`Error change role for user id ${req.params.userId}: `, error);
        res.status(500).json({ success: false, message: `Failed to change role for user id ${req.params.userId}.`});
    }
});

systemControlRouter.delete("/deleteUser/:userId", protect, async (req, res) => {
    if (!req.params.userId) return res.status(400).json({ success: false, message: "User ID is required."});
    try {
        const result = await doQuery(`UPDATE users SET deleted = 1 WHERE user_id = ${req.params.userId}`);
        if (result.affectedRows === 0) return res.status(400).json({ success: false, message: `User ID ${req.params.userId} not found.`});
        broadcastSystemUpdate("user_deleted", { userId: req.params.userId });
        invalidateUserSession(req.params.userId, "Your account was removed. Please sign in again.");
        res.status(204).send();
    } catch (error) {
        console.log(`Error delete for user id ${req.params.userId}: `, error);
        res.status(500).json({ success: false, message: `Failed to deletefor user id ${req.params.userId}.`});
    }
});

export default systemControlRouter;
