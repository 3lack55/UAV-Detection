import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import "../css/login.css";

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

const validate = (form) => {
    const errors = {};
    if (!form.username.trim()) errors.username = "กรุณากรอก Username";
    if (!form.password) errors.password = "กรุณากรอกรหัสผ่าน";
    return errors;
};

// Animated drone swarm canvas background
function DroneCanvas() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        let animId;
        let mouse = { x: null, y: null };

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener("resize", resize);

        const onMouseMove = (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };
        window.addEventListener("mousemove", onMouseMove);

        const NUM = 26;
        const drones = Array.from({ length: NUM }, () => ({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 5 + 7,
            opacity: Math.random() * 0.4 + 0.35,
            rotorAngle: Math.random() * Math.PI * 2,
            blinkOffset: Math.random() * Math.PI * 2,
        }));

        const drawDrone = (d, time) => {
            const angle = Math.atan2(d.vy, d.vx);
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(angle);

            const s = d.size;
            const armColor = `rgba(99, 179, 237, ${d.opacity})`;
            const rotorColor = `rgba(147, 197, 253, ${d.opacity * 0.7})`;

            // Arms (X frame)
            ctx.strokeStyle = armColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-s, -s);
            ctx.lineTo(s, s);
            ctx.moveTo(s, -s);
            ctx.lineTo(-s, s);
            ctx.stroke();

            // Rotors + spinning blades
            const rotorR = s * 0.42;
            const arms = [[-s, -s], [s, -s], [s, s], [-s, s]];
            arms.forEach(([rx, ry]) => {
                ctx.beginPath();
                ctx.arc(rx, ry, rotorR, 0, Math.PI * 2);
                ctx.strokeStyle = rotorColor;
                ctx.lineWidth = 0.8;
                ctx.stroke();

                ctx.save();
                ctx.translate(rx, ry);
                ctx.rotate(d.rotorAngle);
                ctx.beginPath();
                ctx.moveTo(-rotorR, 0);
                ctx.lineTo(rotorR, 0);
                ctx.strokeStyle = rotorColor;
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.restore();
            });

            // Body
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2);
            ctx.fillStyle = armColor;
            ctx.fill();

            // Blinking light
            const blink = (Math.sin(time * 0.004 + d.blinkOffset) + 1) / 2;
            if (blink > 0.7) {
                ctx.beginPath();
                ctx.arc(0, 0, s * 0.15, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(248, 113, 113, ${blink})`;
                ctx.fill();
            }

            ctx.restore();
        };

        const draw = (time) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            drones.forEach((d) => {
                d.x += d.vx;
                d.y += d.vy;
                if (d.x < 0 || d.x > canvas.width) d.vx *= -1;
                if (d.y < 0 || d.y > canvas.height) d.vy *= -1;

                // Mouse repel — drones scatter away from the cursor
                if (mouse.x !== null) {
                    const dx = d.x - mouse.x;
                    const dy = d.y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 110) {
                        d.x += (dx / dist) * 1.5;
                        d.y += (dy / dist) * 1.5;
                    }
                }

                d.rotorAngle += 0.9;
                drawDrone(d, time);
            });

            // Signal links between nearby drones
            for (let i = 0; i < drones.length; i++) {
                for (let j = i + 1; j < drones.length; j++) {
                    const dx = drones[i].x - drones[j].x;
                    const dy = drones[i].y - drones[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150) {
                        ctx.beginPath();
                        ctx.moveTo(drones[i].x, drones[i].y);
                        ctx.lineTo(drones[j].x, drones[j].y);
                        ctx.strokeStyle = `rgba(99, 179, 237, ${0.12 * (1 - dist / 150)})`;
                        ctx.lineWidth = 0.6;
                        ctx.stroke();
                    }
                }
            }

            animId = requestAnimationFrame(draw);
        };
        draw(0);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener("resize", resize);
            window.removeEventListener("mousemove", onMouseMove);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 0,
                pointerEvents: "none",
            }}
        />
    );
}

export default function Login() {
    const { login, getRedirectUrl, clearRedirectUrl } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: "", password: "" });
    const [fieldErrors, setFieldErrors] = useState({});
    const [serverError, setServerError] = useState("");
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [focusedField, setFocusedField] = useState(null);

    useEffect(() => {
        setTimeout(() => setMounted(true), 50);
    }, []);

    const handleChange = (field) => (e) => {
        setForm((p) => ({ ...p, [field]: e.target.value }));
        if (fieldErrors[field]) setFieldErrors((p) => ({ ...p, [field]: "" }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError("");
        const errors = validate(form);
        if (Object.keys(errors).length > 0) return setFieldErrors(errors);
        setLoading(true);
        try {
            const response = await fetch(`${PROTOCOL}://${HOST}:${HOST_PORT}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await response.json();

            if (!response.ok) return setServerError(data.message || "เข้าสู่ระบบล้มเหลว กรุณาลองใหม่อีกครั้ง");

            const banned = data.user.role === "banned" ? true : false;
            const deleted = data.user.deleted;

            if (banned || deleted) {
                clearRedirectUrl();
                return setServerError("คุณไม่สามารถเข้าสู่ระบบได้ด้วยเหตุผลบางอย่าง กรุณาติดต่อผู้ดูแลระบบ");
            }

            login(data.token, data.user.username, data.user.user_id, data.user.role, data.user.profile_image || null);
            const redirectUrl = getRedirectUrl();
            clearRedirectUrl();
            navigate(redirectUrl || "/");
        } catch {
            setServerError("เซิร์ฟเวอร์มีปัญหา กรุณาลองใหม่อีกครั้งในภายหลัง");
        } finally {
            setLoading(false);
        }
    };

    return (
            <div className="login-bg">
                <DroneCanvas />
                <div className={`login-card ${mounted ? "mounted" : ""}`}>
                    {/* Logo */}
                    <div className="logo-ring">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </div>

                    <h2 className="login-title">เข้าสู่ระบบ</h2>
                    <p className="login-subtitle">ยินดีต้อนรับกลับมา</p>

                    {serverError && <div className="server-error">{serverError}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="field-group">
                            <label className="field-label">Username</label>
                            <div className={`input-wrapper ${focusedField === "username" ? "focused" : ""}`}>
                                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                <input
                                    className={`auth-input ${fieldErrors.username ? "error" : ""}`}
                                    placeholder="กรอก username ของคุณ"
                                    value={form.username}
                                    onChange={handleChange("username")}
                                    onFocus={() => setFocusedField("username")}
                                    onBlur={() => setFocusedField(null)}
                                />
                            </div>
                            {fieldErrors.username && <p className="field-error">⚠ {fieldErrors.username}</p>}
                        </div>

                        <div className="field-group">
                            <label className="field-label">รหัสผ่าน</label>
                            <div className={`input-wrapper ${focusedField === "password" ? "focused" : ""}`}>
                                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <input
                                    type="password"
                                    className={`auth-input ${fieldErrors.password ? "error" : ""}`}
                                    placeholder="กรอกรหัสผ่านของคุณ"
                                    value={form.password}
                                    onChange={handleChange("password")}
                                    onFocus={() => setFocusedField("password")}
                                    onBlur={() => setFocusedField(null)}
                                />
                            </div>
                            {fieldErrors.password && <p className="field-error">⚠ {fieldErrors.password}</p>}
                        </div>

                        <button type="submit" className="submit-btn" disabled={loading}>
                            {loading && <span className="spinner" />}
                            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                        </button>
                    </form>

                    <div className="divider">
                        <div className="divider-line" />
                        <span className="divider-text">หรือ</span>
                        <div className="divider-line" />
                    </div>

                    <p className="footer-text">
                        ยังไม่มีบัญชี?{" "}
                        <Link to="/register" className="footer-link">สมัครสมาชิก</Link>
                    </p>
                </div>
            </div>
    );
}