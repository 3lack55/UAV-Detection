export function DashboardOverlays({ toasts, alertMessage, showAlert, onCloseAlert }) {
  return (
    <>
      <div className="fixed bottom-4 right-4 z-[10000] space-y-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast-notification bg-gradient-to-r from-rose-600 to-red-600 text-white px-6 py-3 rounded-lg shadow-2xl border border-rose-400/50 backdrop-blur-sm pointer-events-auto"
          >
            <p className="text-sm font-semibold">{toast.message}</p>
          </div>
        ))}
      </div>

      {showAlert && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-sm w-[90%] animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-red-400">Access Denied</h3>
            </div>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">{alertMessage}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={onCloseAlert}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
