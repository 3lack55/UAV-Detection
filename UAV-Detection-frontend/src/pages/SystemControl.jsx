import { useEffect, useState } from "react";
import { MoveLeft, Settings, Users, Camera, Info } from "lucide-react";
import UserList from "../components/Userlist";
import CameraList from "../components/CameraList";
import { Link } from "react-router-dom";

export default function SystemControl() {
    const [activeTab, setActiveTab] = useState("users");

    {/* UsersList */ }
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [stats, setStats] = useState({ total: 0, admin: 0, banned: 0 });

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                    .parent-container {overflow-x: hidden;}
                    .parent-container::-webkit-scrollbar { width: 0px; }
                    .parent-container::-webkit-scrollbar-track { background: #0f172a; }
                    .parent-container::-webkit-scrollbar-thumb { background: rgb(255 255 255 / 0.3); border-radius: 10px; }

                    .custom-scrollbar::-webkit-scrollbar { height: 0px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
                
                    .right-content-scroll::-webkit-scrollbar { width: 6px; }
                    .right-content-scroll::-webkit-scrollbar-track { background: transparent; }
                    .right-content-scroll::-webkit-scrollbar-thumb { background: rgb(148 163 184 / 0.5); border-radius: 10px; }
                    .right-content-scroll::-webkit-scrollbar-thumb:hover { background: rgb(148 163 184 / 0.7); }

                    /* Stats */
                    .ul-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 1.25rem; }
                    .ul-stat { background: rgba(255,255,255,0.04); border: 0.5px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 16px; }
                    .ul-stat-label { font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: ui-monospace, monospace; letter-spacing: 0.04em; text-transform: uppercase; }
                    .ul-stat-val { font-size: 24px; font-weight: 500; color: #f1f5f9; }

                    /* Toolbar */
                    .ul-toolbar { display: flex; gap: 10px; margin-bottom: 1.25rem; align-items: center; }
                    .ul-search { flex: 1; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.04); border: 0.5px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 0 12px; height: 38px; }
                    .ul-search svg { flex-shrink: 0; opacity: 0.4; }
                    .ul-search input { border: none; background: transparent; outline: none; font-size: 14px; color: #f1f5f9; flex: 1; font-family: inherit; }
                    .ul-search input::placeholder { color: #475569; }
                    .ul-filter { height: 38px; border: 0.5px solid rgba(255,255,255,0.12); border-radius: 8px; background: rgba(255,255,255,0.04); color: #94a3b8; font-size: 13px; padding: 0 10px; font-family: inherit; cursor: pointer; outline: none; }
                    .ul-filter:focus { border-color: rgba(255,255,255,0.25); }
                    option { background: #334155}
                `
            }} />


            <div className="min-h-full w-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 pt-6 lg:h-screen lg:overflow-hidden lg:flex lg:flex-col">
                <div className="mb-6 px-4 lg:mb-0 h-40 flex items-center w-full">
                    <div className="flex w-full items-center text-right lg:text-left justify-between lg:justify-start">
                        <div>
                            <Link to="/">
                                <button className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg transition-colors duration-300 lg:hidden" title="กลับไปที่หน้าหลัก">
                                    <MoveLeft className="w-5 h-5" />
                                </button>
                            </Link>
                        </div>
                        <div className="lg:w-[320px]">
                            <h1 className="text-5xl font-bold text-white mb-2">จัดการระบบ</h1>
                            <p className="text-slate-400 text-lg">การตั้งค่าระบบ</p>
                        </div>

                        {activeTab === "users" && (
                            <div className="hidden lg:block lg:flex-grow">
                                {/* Stats */}
                                <div className="ul-stats">
                                    <div className="ul-stat">
                                        <div className="ul-stat-label">ทั้งหมด</div>
                                        <div className="ul-stat-val">{stats.total}</div>
                                    </div>
                                    <div className="ul-stat">
                                        <div className="ul-stat-label">Admin</div>
                                        <div className="ul-stat-val">{stats.admin}</div>
                                    </div>
                                    <div className="ul-stat">
                                        <div className="ul-stat-label">Banned</div>
                                        <div className="ul-stat-val">{stats.banned}</div>
                                    </div>
                                </div>

                                {/* Toolbar */}
                                <div className="ul-toolbar">
                                    <div className="ul-search">
                                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                                            <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                        </svg>
                                        <input
                                            type="text"
                                            placeholder="ค้นหาชื่อผู้ใช้..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                        />
                                    </div>
                                    <select
                                        className="ul-filter"
                                        value={roleFilter}
                                        onChange={e => setRoleFilter(e.target.value)}
                                    >
                                        <option value="all">ทุก Role</option>
                                        <option value="admin">Admin</option>
                                        <option value="user">User</option>
                                        <option value="banned">Banned</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col w-full lg:flex-row flex-grow lg:gap-4 lg:flex-grow lg:min-h-0 relative pb-6 ">
                    <div className="lg:w-[320px] w-full lg:flex lg:flex-col justify-between lg:px-4 lg:m-0 lg:pb-0 lg:border-r lg:border-b-0 lg:border-slate-700 sticky top-0 bg-slate-900 lg:bg-transparent" >
                        <div className="flex gap-4 lg:flex-col lg:gab">
                            {[
                                // { id: "general", label: "ทั่วไป", icon: Settings },
                                { id: "users", label: "ผู้ใช้งาน", icon: Users },
                                { id: "camera", label: "กล้อง", icon: Camera },
                                // { id: "about", label: "เกี่ยวกับ", icon: Info },
                            ].map((tab) => {
                                const IconComponent = tab.icon;
                                return (
                                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                        className={`flex justify-center lg:justify-start items-center gap-3 px-4 py-4 rounded-[4px] w-full lg:min-w-[160px] border-t-4 lg:border-t-0 transition-all duration-300 text-left ${activeTab === tab.id
                                            ? "border-t-blue-500 text-blue-400 bg-blue-500/10"
                                            : "border-t-transparent text-slate-400 hover:text-slate-300 hover:bg-white/10"
                                            }`}
                                        title={tab.label}
                                    >
                                        <IconComponent className="w-5 h-5" />
                                        <span className="whitespace-nowrap font-medium text-sm hidden sm:block">{tab.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                        <Link to="/">
                            <button
                                className="hidden group lg:flex items-center gap-3 cursor-pointer bg-slate-500/20 border border-slate-700/50 rounded-xl px-4 py-3 w-[55px] whitespace-nowrap transition-all duration-300 hover:w-full overflow-hidden"
                            >
                                <MoveLeft className="w-5 h-5 flex-shrink-0 " />
                                <p className="text-sm font-medium text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300">กลับไปที่หน้าหลัก</p>
                            </button>
                        </Link>

                    </div>

                    <div className="flex-grow p-4 lg:p-[0px_16px_0px_0px]  justify-center lg:overflow-y-auto lg:min-h-0 right-content-scroll">
                        {activeTab == "general" && (
                            <div>
                                <p>General</p>
                            </div>
                        )}

                        {activeTab === "users" && (
                            <UserList search={search} setSearch={setSearch} roleFilter={roleFilter} setRoleFilter={setRoleFilter} onStatsUpdate={setStats} />
                        )}

                        {activeTab === "camera" && (
                            <CameraList />
                        )}
                    </div>

                </div>
            </div>
        </>
    );
}
