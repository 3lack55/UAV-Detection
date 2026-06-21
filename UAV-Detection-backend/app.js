import express from "express";
import middleware from "./src/middlewares/middlewares.js";
import apiRouter from "./src/routes/apiRouter.js";

const app = express();

app.use(middleware);
app.use("/api", apiRouter);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Hello from Bobo's Server!",
    date: { timestamp: new Date() },
  });
});

export default app;
