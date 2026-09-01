import React from "react";
import { RefreshCw, Sparkles, X, CheckCircle2, ShieldCheck } from "lucide-react";
import { BRAND_LOGO } from "../constants/assets";

interface PWAUpdateModalProps {
  isOpen: boolean;
  isUpdating: boolean;
  onApplyUpdate: () => void;
  onDismiss: () => void;
  isStandalone?: boolean;
}

export const PWAUpdateModal: React.FC<PWAUpdateModalProps> = ({
  isOpen,
  isUpdating,
  onApplyUpdate,
  onDismiss,
  isStandalone = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn font-normal">
      <div className="bg-white dark:bg-slate-900 border border-teal-500/50 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden space-y-5">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-400" />

        {/* Close Button */}
        <button
          onClick={onDismiss}
          disabled={isUpdating}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          title="Dismiss for now"
          aria-label="Dismiss update"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="flex items-center gap-3.5 pt-1">
          <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center p-1.5 shrink-0 shadow-md relative">
            <img src={BRAND_LOGO} alt="Team Taraba River" className="w-full h-full object-contain" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                New Update Available!
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1 mt-0.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isStandalone ? "Installed App Modification Detected" : "App Upgrade Ready"}</span>
            </p>
          </div>
        </div>

        {/* Informative description */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2">
          <p>
            A fresh update for <strong>Team Taraba River</strong> has been published with the latest features, security patches, and performance enhancements.
          </p>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold pt-1">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Zero data loss • Seamless 1-second reload</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          <button
            onClick={onApplyUpdate}
            disabled={isUpdating}
            className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 active:scale-98 text-white font-bold text-sm shadow-md shadow-teal-600/30 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? "animate-spin" : ""}`} />
            <span>{isUpdating ? "Applying Update…" : "🚀 Update & Refresh Now"}</span>
          </button>
          <button
            onClick={onDismiss}
            disabled={isUpdating}
            className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition cursor-pointer text-center"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
};
