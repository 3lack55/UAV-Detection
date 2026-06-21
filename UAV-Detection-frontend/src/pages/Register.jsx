import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

const validate = (form) => {
    const errors = {};
    if (!form.username.trim()) {
        errors.username = "กรุณากรอก Username";
    } else if (form.username.length < 3) {
        errors.username = "Username ต้องมีอย่างน้อย 3 ตัวอักษร";
    }
    if (!form.password) {
        errors.password = "กรุณากรอกรหัสผ่าน";
    } else if (form.password.length < 6) {
        errors.password = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
    }
    if (!form.confirmPassword) {
        errors.confirmPassword = "กรุณายืนยันรหัสผ่าน";
    } else if (form.password !== form.confirmPassword) {
        errors.confirmPassword = "รหัสผ่านไม่ตรงกัน";
    }
    return errors;
};

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
                ctx.fillStyle = `rgba(167,139,250,${p.opacity})`;
                ctx.fill();
            });

            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 130) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(167,139,250,${0.15 * (1 - dist / 130)})`;
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
            style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
        />
    );
}

// Password strength indicator
function PasswordStrength({ password }) {
    if (!password) return null;
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    const labels = ["", "อ่อนมาก", "อ่อน", "พอใช้", "ดี", "แข็งแกร่ง"];
    const colors = ["", "#f87171", "#fb923c", "#fbbf24", "#34d399", "#10b981"];
    const widths = ["0%", "20%", "40%", "60%", "80%", "100%"];

    return (
        <div style={{ marginTop: 6 }}>
            <div style={{
                height: 3,
                borderRadius: 99,
                background: "rgba(255,255,255,0.08)",
                overflow: "hidden",
            }}>
                <div style={{
                    height: "100%",
                    width: widths[strength],
                    background: colors[strength],
                    borderRadius: 99,
                    transition: "width 0.4s ease, background 0.4s ease",
                }} />
            </div>
            {strength > 0 && (
                <p style={{
                    fontSize: "0.72rem",
                    color: colors[strength],
                    marginTop: 4,
                    paddingLeft: 2,
                    transition: "color 0.3s",
                }}>
                    ความปลอดภัย: {labels[strength]}
                </p>
            )}
        </div>
    );
}

export default function Register() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: "", password: "", confirmPassword: "" });
    const [fieldErrors, setFieldErrors] = useState({});
    const [serverError, setServerError] = useState("");
    const [success, setSuccess] = useState("");
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
            const response = await fetch(`${PROTOCOL}://${HOST}:${HOST_PORT}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: form.username, password: form.password }),
            });
            const data = await response.json();
            if (!response.ok) return setServerError(data.message || "การสมัครสมาชิกล้มเหลว กรุณาลองใหม่อีกครั้ง");
            setSuccess("สมัครสมาชิกสำเร็จแล้ว กำลังพาไปหน้าเข้าสู่ระบบ...");
            setTimeout(() => navigate("/login"), 2000);
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

                .register-bg {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: radial-gradient(ellipse at 80% 30%, #1a0d3c 0%, #050a1a 50%, #000510 100%);
                    font-family: 'Kanit', sans-serif;
                    position: relative;
                    overflow: hidden;
                    padding: 20px 0;
                }

                .blob-r {
                    position: fixed;
                    border-radius: 50%;
                    filter: blur(80px);
                    pointer-events: none;
                    z-index: 0;
                    animation: blobFloat 8s ease-in-out infinite;
                }
                .blob-r1 {
                    width: 500px; height: 500px;
                    background: radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%);
                    top: -100px; right: -100px;
                    animation-delay: 0s;
                }
                .blob-r2 {
                    width: 400px; height: 400px;
                    background: radial-gradient(circle, rgba(99,179,237,0.08) 0%, transparent 70%);
                    bottom: -100px; left: -80px;
                    animation-delay: -4s;
                }
                .blob-r3 {
                    width: 250px; height: 250px;
                    background: radial-gradient(circle, rgba(236,72,153,0.06) 0%, transparent 70%);
                    top: 40%; right: 15%;
                    animation-delay: -2s;
                }
                @keyframes blobFloat {
                    0%, 100% { transform: translateY(0px) scale(1); }
                    33% { transform: translateY(-30px) scale(1.05); }
                    66% { transform: translateY(20px) scale(0.95); }
                }

                .register-card {
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
                        0 0 0 1px rgba(139,92,246,0.05),
                        0 25px 60px rgba(0,0,0,0.5),
                        0 0 100px rgba(139,92,246,0.05) inset;
                    transform: translateY(${mounted ? "0" : "30px"});
                    opacity: ${mounted ? 1 : 0};
                    transition: transform 0.7s cubic-bezier(0.34,1.56,0.64,1), opacity 0.6s ease;
                }

                .register-card::before {
                    content: '';
                    position: absolute;
                    inset: -1px;
                    border-radius: 25px;
                    background: linear-gradient(135deg, rgba(139,92,246,0.3), transparent 40%, rgba(99,179,237,0.2) 80%, transparent);
                    z-index: -1;
                    pointer-events: none;
                }

                .register-title {
                    color: #fff;
                    font-size: 1.8rem;
                    font-weight: 700;
                    text-align: center;
                    margin-bottom: 6px;
                    letter-spacing: 0.02em;
                }
                .register-subtitle {
                    color: rgba(167,139,250,0.7);
                    font-size: 0.85rem;
                    text-align: center;
                    margin-bottom: 28px;
                    font-weight: 300;
                }

                .logo-ring-r {
                    width: 60px; height: 60px;
                    margin: 0 auto 20px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,179,237,0.2));
                    border: 1px solid rgba(139,92,246,0.35);
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 0 30px rgba(139,92,246,0.2);
                    animation: logoPulseR 3s ease-in-out infinite;
                }
                @keyframes logoPulseR {
                    0%, 100% { box-shadow: 0 0 20px rgba(139,92,246,0.15); }
                    50% { box-shadow: 0 0 40px rgba(139,92,246,0.35); }
                }
                .logo-ring-r svg {
                    width: 28px; height: 28px;
                    color: #a78bfa;
                }

                .field-group { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }

                .field-label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: rgba(148,163,184,0.8);
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    padding-left: 4px;
                }

                .input-wrapper-r {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .input-icon-r {
                    position: absolute;
                    left: 14px;
                    color: rgba(167,139,250,0.5);
                    width: 16px; height: 16px;
                    transition: color 0.2s;
                    pointer-events: none;
                }
                .input-wrapper-r.focused .input-icon-r {
                    color: #a78bfa;
                }

                .auth-input-r {
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
                .auth-input-r::placeholder { color: rgba(148,163,184,0.4); }
                .auth-input-r:focus {
                    background: rgba(139,92,246,0.08);
                    border-color: rgba(139,92,246,0.5);
                    box-shadow: 0 0 0 3px rgba(139,92,246,0.1), 0 0 20px rgba(139,92,246,0.08);
                }
                .auth-input-r.error {
                    border-color: rgba(248,113,113,0.6);
                    background: rgba(248,113,113,0.05);
                }
                .auth-input-r.error:focus {
                    box-shadow: 0 0 0 3px rgba(248,113,113,0.1);
                }
                .auth-input-r.valid {
                    border-color: rgba(52,211,153,0.4);
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

                .server-error-r {
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

                .success-msg {
                    padding: 10px 14px;
                    border-radius: 10px;
                    background: rgba(52,211,153,0.1);
                    border: 1px solid rgba(52,211,153,0.25);
                    color: #6ee7b7;
                    font-size: 0.85rem;
                    text-align: center;
                    margin-bottom: 16px;
                    animation: slideDown 0.3s ease;
                }

                .submit-btn-r {
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
                    background: linear-gradient(135deg, #7c3aed, #6d28d9);
                    box-shadow: 0 4px 20px rgba(124,58,237,0.4);
                    transition: all 0.3s ease;
                    letter-spacing: 0.03em;
                }
                .submit-btn-r::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                .submit-btn-r:hover:not(:disabled)::before { opacity: 1; }
                .submit-btn-r:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 30px rgba(124,58,237,0.5);
                }
                .submit-btn-r:active:not(:disabled) { transform: translateY(0); }
                .submit-btn-r:disabled {
                    background: linear-gradient(135deg, #3b1f6e, #3b1f6e);
                    cursor: not-allowed;
                    box-shadow: none;
                }

                .spinner-r {
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

                .divider-r {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin: 20px 0 14px;
                }
                .divider-line-r {
                    flex: 1;
                    height: 1px;
                    background: rgba(255,255,255,0.08);
                }
                .divider-text-r {
                    color: rgba(148,163,184,0.5);
                    font-size: 0.75rem;
                }

                .footer-text-r {
                    color: rgba(148,163,184,0.6);
                    font-size: 0.85rem;
                    text-align: center;
                }
                .footer-link-r {
                    color: #a78bfa;
                    text-decoration: none;
                    font-weight: 600;
                    transition: color 0.2s;
                }
                .footer-link-r:hover { color: #c4b5fd; text-decoration: underline; }

                /* Check icon for matching password */
                .check-icon {
                    position: absolute;
                    right: 12px;
                    color: #34d399;
                    width: 16px; height: 16px;
                    animation: popIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
                }
                @keyframes popIn {
                    from { transform: scale(0); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>

            <div className="register-bg">
                <ParticleCanvas />
                <div className="blob-r blob-r1" />
                <div className="blob-r blob-r2" />
                <div className="blob-r blob-r3" />

                <div className="register-card">
                    {/* Logo */}
                    <div className="logo-ring-r">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <line x1="19" y1="8" x2="19" y2="14" />
                            <line x1="22" y1="11" x2="16" y2="11" />
                        </svg>
                    </div>

                    <h2 className="register-title">สมัครสมาชิก</h2>
                    <p className="register-subtitle">สร้างบัญชีใหม่ได้เลย ฟรี!</p>

                    {serverError && <div className="server-error-r">{serverError}</div>}
                    {success && <div className="success-msg">✓ {success}</div>}

                    <form onSubmit={handleSubmit}>
                        {/* Username */}
                        <div className="field-group">
                            <label className="field-label">Username</label>
                            <div className={`input-wrapper-r ${focusedField === "username" ? "focused" : ""}`}>
                                <svg className="input-icon-r" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                <input
                                    className={`auth-input-r ${fieldErrors.username ? "error" : form.username.length >= 3 ? "valid" : ""}`}
                                    placeholder="อย่างน้อย 3 ตัวอักษร"
                                    value={form.username}
                                    onChange={handleChange("username")}
                                    onFocus={() => setFocusedField("username")}
                                    onBlur={() => setFocusedField(null)}
                                />
                                {form.username.length >= 3 && !fieldErrors.username && (
                                    <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </div>
                            {fieldErrors.username && <p className="field-error">⚠ {fieldErrors.username}</p>}
                        </div>

                        {/* Password */}
                        <div className="field-group">
                            <label className="field-label">รหัสผ่าน</label>
                            <div className={`input-wrapper-r ${focusedField === "password" ? "focused" : ""}`}>
                                <svg className="input-icon-r" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <input
                                    type="password"
                                    className={`auth-input-r ${fieldErrors.password ? "error" : ""}`}
                                    placeholder="อย่างน้อย 6 ตัวอักษร"
                                    value={form.password}
                                    onChange={handleChange("password")}
                                    onFocus={() => setFocusedField("password")}
                                    onBlur={() => setFocusedField(null)}
                                />
                            </div>
                            <PasswordStrength password={form.password} />
                            {fieldErrors.password && <p className="field-error">⚠ {fieldErrors.password}</p>}
                        </div>

                        {/* Confirm Password */}
                        <div className="field-group">
                            <label className="field-label">ยืนยันรหัสผ่าน</label>
                            <div className={`input-wrapper-r ${focusedField === "confirmPassword" ? "focused" : ""}`}>
                                <svg className="input-icon-r" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                                <input
                                    type="password"
                                    className={`auth-input-r ${fieldErrors.confirmPassword ? "error" : form.confirmPassword && form.password === form.confirmPassword ? "valid" : ""}`}
                                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                                    value={form.confirmPassword}
                                    onChange={handleChange("confirmPassword")}
                                    onFocus={() => setFocusedField("confirmPassword")}
                                    onBlur={() => setFocusedField(null)}
                                />
                                {form.confirmPassword && form.password === form.confirmPassword && !fieldErrors.confirmPassword && (
                                    <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </div>
                            {fieldErrors.confirmPassword && <p className="field-error">⚠ {fieldErrors.confirmPassword}</p>}
                        </div>

                        <button type="submit" className="submit-btn-r" disabled={loading}>
                            {loading && <span className="spinner-r" />}
                            {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
                        </button>
                    </form>

                    <div className="divider-r">
                        <div className="divider-line-r" />
                        <span className="divider-text-r">หรือ</span>
                        <div className="divider-line-r" />
                    </div>

                    <p className="footer-text-r">
                        มีบัญชีแล้ว?{" "}
                        <Link to="/login" className="footer-link-r">เข้าสู่ระบบ</Link>
                    </p>
                </div>
            </div>
        </>
    );
}