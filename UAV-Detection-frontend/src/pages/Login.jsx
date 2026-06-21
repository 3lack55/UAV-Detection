import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

const validate = (form) => {
    const errors = {};
    if (!form.username.trim()) errors.username = "กรุณากรอก Username";
    if (!form.password) errors.password = "กรุณากรอกรหัสผ่าน";
    return errors;
};

// Animated particle canvas background
function ParticleCanvas() {
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

        const NUM = 90;
        const particles = Array.from({ length: NUM }, () => ({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            r: Math.random() * 2 + 1,
            opacity: Math.random() * 0.5 + 0.2,
        }));

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach((p) => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

                // Mouse repel
                if (mouse.x !== null) {
                    const dx = p.x - mouse.x;
                    const dy = p.y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 100) {
                        p.x += (dx / dist) * 1.5;
                        p.y += (dy / dist) * 1.5;
                    }
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(99, 179, 237, ${p.opacity})`;
                ctx.fill();
            });

            // Draw connections
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 130) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(99, 179, 237, ${0.15 * (1 - dist / 130)})`;
                        ctx.lineWidth = 0.7;
                        ctx.stroke();
                    }
                }
            }

            animId = requestAnimationFrame(draw);
        };
        draw();

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
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap');

                .login-bg {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: radial-gradient(ellipse at 20% 50%, #0d1f3c 0%, #050d1a 50%, #000510 100%);
                    font-family: 'Kanit', sans-serif;
                    position: relative;
                    overflow: hidden;
                }

                /* Ambient glow blobs */
                .blob {
                    position: fixed;
                    border-radius: 50%;
                    filter: blur(80px);
                    pointer-events: none;
                    z-index: 0;
                    animation: blobFloat 8s ease-in-out infinite;
                }
                .blob-1 {
                    width: 500px; height: 500px;
                    background: radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%);
                    top: -150px; left: -100px;
                    animation-delay: 0s;
                }
                .blob-2 {
                    width: 400px; height: 400px;
                    background: radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%);
                    bottom: -100px; right: -80px;
                    animation-delay: -3s;
                }
                .blob-3 {
                    width: 300px; height: 300px;
                    background: radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%);
                    top: 50%; left: 60%;
                    animation-delay: -5s;
                }
                @keyframes blobFloat {
                    0%, 100% { transform: translateY(0px) scale(1); }
                    33% { transform: translateY(-30px) scale(1.05); }
                    66% { transform: translateY(20px) scale(0.95); }
                }

                /* Card */
                .login-card {
                    position: relative;
                    z-index: 10;
                    width: 380px;
                    padding: 40px 36px 36px;
                    border-radius: 24px;
                    background: rgba(255,255,255,0.04);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255,255,255,0.1);
                    box-shadow:
                        0 0 0 1px rgba(99,179,237,0.05),
                        0 25px 60px rgba(0,0,0,0.5),
                        0 0 100px rgba(56,189,248,0.05) inset;
                    transform: translateY(${mounted ? "0" : "30px"});
                    opacity: ${mounted ? 1 : 0};
                    transition: transform 0.7s cubic-bezier(0.34,1.56,0.64,1), opacity 0.6s ease;
                }

                /* Glow border on card */
                .login-card::before {
                    content: '';
                    position: absolute;
                    inset: -1px;
                    border-radius: 25px;
                    background: linear-gradient(135deg, rgba(99,179,237,0.3), transparent 40%, rgba(139,92,246,0.2) 80%, transparent);
                    z-index: -1;
                    pointer-events: none;
                }

                .login-title {
                    color: #fff;
                    font-size: 1.8rem;
                    font-weight: 700;
                    text-align: center;
                    margin-bottom: 6px;
                    letter-spacing: 0.02em;
                }
                .login-subtitle {
                    color: rgba(99,179,237,0.7);
                    font-size: 0.85rem;
                    text-align: center;
                    margin-bottom: 28px;
                    font-weight: 300;
                }

                /* Icon logo area */
                .logo-ring {
                    width: 60px; height: 60px;
                    margin: 0 auto 20px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, rgba(56,189,248,0.2), rgba(139,92,246,0.2));
                    border: 1px solid rgba(99,179,237,0.3);
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 0 30px rgba(56,189,248,0.15);
                    animation: logoPulse 3s ease-in-out infinite;
                }
                @keyframes logoPulse {
                    0%, 100% { box-shadow: 0 0 20px rgba(56,189,248,0.15); }
                    50% { box-shadow: 0 0 40px rgba(56,189,248,0.3); }
                }
                .logo-ring svg {
                    width: 28px; height: 28px;
                    color: #63b3ed;
                }

                /* Input group */
                .field-group { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }

                .field-label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: rgba(148,163,184,0.8);
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    padding-left: 4px;
                }

                .input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .input-icon {
                    position: absolute;
                    left: 14px;
                    color: rgba(99,179,237,0.5);
                    width: 16px; height: 16px;
                    transition: color 0.2s;
                    pointer-events: none;
                }
                .input-wrapper.focused .input-icon {
                    color: #63b3ed;
                }

                .auth-input {
                    width: 100%;
                    padding: 12px 14px 12px 42px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    color: #e2e8f0;
                    font-family: 'Kanit', sans-serif;
                    font-size: 0.95rem;
                    outline: none;
                    transition: all 0.3s ease;
                    box-sizing: border-box;
                }
                .auth-input::placeholder { color: rgba(148,163,184,0.4); }
                .auth-input:focus {
                    background: rgba(99,179,237,0.08);
                    border-color: rgba(99,179,237,0.5);
                    box-shadow: 0 0 0 3px rgba(99,179,237,0.1), 0 0 20px rgba(99,179,237,0.08);
                }
                .auth-input.error {
                    border-color: rgba(248,113,113,0.6);
                    background: rgba(248,113,113,0.05);
                }
                .auth-input.error:focus {
                    box-shadow: 0 0 0 3px rgba(248,113,113,0.1);
                }

                .field-error {
                    color: #f87171;
                    font-size: 0.75rem;
                    padding-left: 4px;
                    animation: slideDown 0.2s ease;
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Server error */
                .server-error {
                    padding: 10px 14px;
                    border-radius: 10px;
                    background: rgba(248,113,113,0.1);
                    border: 1px solid rgba(248,113,113,0.2);
                    color: #fca5a5;
                    font-size: 0.85rem;
                    text-align: center;
                    margin-bottom: 16px;
                    animation: slideDown 0.3s ease;
                }

                /* Submit button */
                .submit-btn {
                    width: 100%;
                    padding: 13px;
                    margin-top: 8px;
                    border: none;
                    border-radius: 12px;
                    font-family: 'Kanit', sans-serif;
                    font-size: 1rem;
                    font-weight: 600;
                    color: #fff;
                    cursor: pointer;
                    position: relative;
                    overflow: hidden;
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);
                    box-shadow: 0 4px 20px rgba(37,99,235,0.4);
                    transition: all 0.3s ease;
                    letter-spacing: 0.03em;
                }
                .submit-btn::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                .submit-btn:hover:not(:disabled)::before { opacity: 1; }
                .submit-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 30px rgba(37,99,235,0.5);
                }
                .submit-btn:active:not(:disabled) { transform: translateY(0); }
                .submit-btn:disabled {
                    background: linear-gradient(135deg, #1e3a6e, #1e3a6e);
                    cursor: not-allowed;
                    box-shadow: none;
                }

                /* Loading spinner */
                .spinner {
                    display: inline-block;
                    width: 14px; height: 14px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin-right: 8px;
                    vertical-align: middle;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* Divider */
                .divider {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin: 20px 0 14px;
                }
                .divider-line {
                    flex: 1;
                    height: 1px;
                    background: rgba(255,255,255,0.08);
                }
                .divider-text {
                    color: rgba(148,163,184,0.5);
                    font-size: 0.75rem;
                }

                .footer-text {
                    color: rgba(148,163,184,0.6);
                    font-size: 0.85rem;
                    text-align: center;
                }
                .footer-link {
                    color: #63b3ed;
                    text-decoration: none;
                    font-weight: 600;
                    transition: color 0.2s;
                }
                .footer-link:hover { color: #93c5fd; text-decoration: underline; }
            `}</style>

            <div className="login-bg">
                <ParticleCanvas />
                <div className="blob blob-1" />
                <div className="blob blob-2" />
                <div className="blob blob-3" />

                <div className="login-card">
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
        </>
    );
}