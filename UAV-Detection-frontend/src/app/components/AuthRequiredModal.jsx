import { useAuth } from "../../context/useAuth";
import { useWebSocket } from "../../context/useWebSocket";

export default function AuthRequiredModal() {
  const { authRequired, clearAuthRequired } = useWebSocket();
  const { logout } = useAuth();

  if (!authRequired) return null;

  const handleLogout = () => {
    clearAuthRequired();
    logout();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-xl bg-slate-900 p-6 text-center shadow-2xl border border-slate-700">
        <h3 className="text-xl font-semibold text-white">การยืนยันตัวตนล้มเหลว</h3>
        <p className="mt-3 text-sm text-slate-300">
          เซสชันของคุณถูกยกเลิก กรุณาเข้าสู่ระบบอีกครั้ง
        </p>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
