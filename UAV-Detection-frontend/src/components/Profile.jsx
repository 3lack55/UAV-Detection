import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import Account from "../pages/account";
import { User } from "lucide-react";

const HOST = import.meta.env.VITE_API_HOST || "localhost";
const HOST_PORT = import.meta.env.VITE_API_PORT || "3000";
const PROTOCOL = import.meta.env.VITE_API_PROTOCOL || "http";

export default function Profile() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <div className="relative">
            <div
                // className="group flex items-center gap-3 cursor-pointer p-1 pr-4 rounded-full transition-all duration-300 hover:bg-white/10 active:scale-95 border border-transparent hover:border-white/20" 
                className="group flex items-center gap-3 cursor-pointer p-1 pr-4 rounded-full transition-all duration-300 active:scale-95 border border-transparent"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
                <div className="relative">
                    {user?.profile_image && user.profile_image !== "null" ? (
                        <img
                            src={`${PROTOCOL}://${HOST}:${HOST_PORT}/uploads/user_profile/${user.profile_image}`}
                            alt="user"
                            className="w-10 h-10 rounded-full border-2 border-blue-400 object-cover shadow-md group-hover:ring-2 group-hover:ring-white/50 transition-all"
                        />
                    ) : (
                        <img
                            src="account.png"
                            alt="user"
                            className="w-10 h-10 rounded-full border-2 border-blue-400 object-cover shadow-md group-hover:ring-2 group-hover:ring-white/50 transition-all"
                        />
                    )}
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-blue-900 rounded-full"></span>
                </div>

                <div className="hidden sm:block">
                    <p className="text-sm font-semibold tracking-wide text-white group-hover:text-blue-200 transition-colors">
                        {user?.username}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-200 font-medium uppercase">
                            {user?.role}
                        </span>
                    </div>
                </div>

                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 text-white/50 group-hover:text-white transition-transform group-hover:translate-y-0.5 ${isMenuOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {isMenuOpen && (
                <>
                    <div className="fixed inset-0 z-[1005]" onClick={() => setIsMenuOpen(false)}></div>
                    <div className="absolute right-1.5 mt-2 w-52 top-full bg-[#1A1F2B]/60 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1 animate-in fade-in zoom-in duration-15 z-[1006]">
                        {user?.role === "admin" && (
                            <div className="p-1 border-b border-white/5">
                                <p className="text-xs text-slate-400 px-2 py-1">สำหรับผู้ดูแลระบบ (Admin)</p>
                                
                                <Link to="/system-control">
                                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-400 rounded-lg transition-colors">
                                        <span>จัดการระบบ</span>
                                    </button>
                                </Link>
                            </div>
                        )}
                        <div className="p-1">
                            <Link to="/account">
                                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-400 rounded-lg transition-colors">
                                    <span>จัดการบัญชี</span>
                                </button>
                            </Link>
                            
                        </div>

                        <div className="p-1 border-t border-white/5">
                            <button
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                onClick={handleLogout}
                            >
                                <span>ออกจากระบบ</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}