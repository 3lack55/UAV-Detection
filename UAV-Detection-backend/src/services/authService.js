import express from 'express';
import { doQuery } from '../database/mysqlConnection.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { protect } from '../middlewares/authMiddleware.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const authRouter = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const targetDir = path.join(__dirname, '../../uploads/user_profile');
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true }); 
        }
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        cb(null, `profile_${req.user.user_id}_${timestamp}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('รองรับเฉพาะรูปภาพประเภท JPG, PNG, GIF และ WEBP เท่านั้น'));
        }
    }
});

authRouter.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await doQuery('SELECT * FROM users WHERE username = ?', [username]);
        if (user.length === 0) {
            return res.status(401).json({ success: false, message: 'ไม่พบผู้ใช้งาน' });
        }
        const isMatch = await bcrypt.compare(password, user[0].password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
        const token = jwt.sign({ user_id: user[0].user_id, username: user[0].username, role: user[0].role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, user: { user_id: user[0].user_id, username: user[0].username, role: user[0].role, profile_image: user[0].profile_image, deleted: user[0].deleted } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

authRouter.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const existingUser = await doQuery('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้งานนี้ถูกใช้แล้ว' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await doQuery('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        res.status(201).json({ success: true, message: 'สมัครสมาชิกสำเร็จ' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Get user details
authRouter.get('/user/:id', protect, async (req, res) => {
    try {
        const user = await doQuery('SELECT user_id, username, role, profile_image FROM users WHERE user_id = ?', [req.params.id]);
        if (user.length === 0) {
            return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
        }
        res.json({ success: true, data: user[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Update user profile
authRouter.put('/user/:id', protect, async (req, res) => {
    try {
        // Ensure user can only update their own profile
        if (req.user.user_id !== parseInt(req.params.id)) {
            return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์' });
        }

        const updates = {};
        if (req.body.username) {
            updates.username = req.body.username;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'ไม่มีข้อมูลที่จะอัปเดต' });
        }

        // Check if username already exists
        if (updates.username) {
            const existing = await doQuery('SELECT * FROM users WHERE username = ? AND user_id != ?', [updates.username, req.params.id]);
            if (existing.length > 0) {
                return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
            }
        }

        const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const updateValues = Object.values(updates);
        updateValues.push(req.params.id);

        await doQuery(`UPDATE users SET ${updateFields} WHERE user_id = ?`, updateValues);
        res.json({ success: true, message: 'อัปเดตโปรไฟล์สำเร็จ', data: updates });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Change password
authRouter.post('/change-password', protect, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'ระบุรหัสผ่านปัจจุบันและรหัสผ่านใหม่' });
        }

        const user = await doQuery('SELECT * FROM users WHERE user_id = ?', [req.user.user_id]);
        if (user.length === 0) {
            return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user[0].password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await doQuery('UPDATE users SET password = ? WHERE user_id = ?', [hashedPassword, req.user.user_id]);
        
        res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Upload profile image
authRouter.post('/upload-profile-image', protect, (req, res, next) => {
    upload.single('profileImage')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'ไม่มีรูปภาพ' });
            }

            const filename = req.file.filename;
            await doQuery('UPDATE users SET profile_image = ? WHERE user_id = ?', [filename, req.user.user_id]);
            
            res.json({ success: true, message: 'อัปโหลดรูปภาพสำเร็จ', filename });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Server error', error: error.message });
        }
    });
});

authRouter.post('/userQuery', protect, async (req, res) => {
    const { query } = req.body;
    try {
        const results = await doQuery(query);
        res.json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

export default authRouter;