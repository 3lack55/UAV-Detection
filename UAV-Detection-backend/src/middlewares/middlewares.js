import express from "express";
import cors from "cors";
import logger from "./request-info.js";
// import { protect } from "./authMiddleware.js";
 
const middleware = express();

middleware.use(cors());
middleware.use(logger);
// middleware.use(protect);
middleware.use(express.json());
middleware.use(express.urlencoded({extended: true}));
middleware.use('/uploads', express.static('uploads'));

export default middleware;
