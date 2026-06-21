import express from "express";
import eventRouter from "../services/eventService.js";
import authRouter from "../services/authService.js";
import cameraRouter from "../services/cameraService.js";
import systemControlRouter from "../services/systemControlService.js";

const apiRouter = express.Router();

apiRouter.use("/event", eventRouter);

apiRouter.use("/auth", authRouter);

apiRouter.use("/camera", cameraRouter);

apiRouter.use("/systemControl", systemControlRouter);

export default apiRouter;