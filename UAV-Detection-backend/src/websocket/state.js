import dotenv from 'dotenv';

dotenv.config();

export const cameraSessions = new Map();
export const clientSessions = new Map();

export const events = new Map();
export const eventTimeout = 0.5 * 60 * 1000; // 0.5 นาที
export const controllerTimeout = 15 * 1000; // 15 วินาที

export const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';