import React from "react";
import { Download, Smartphone, X, Sparkles } from "lucide-react";
import { BRAND_LOGO } from "../constants/assets";
import { DevicePlatform } from "../hooks/usePWAInstall";

interface PWAInstallBannerProps {
  isOpen: boolean;
  platform: DevicePlatform;
  hasNativePrompt: boolean;
  onInstallClick: () => void;
  onDismiss: () => void;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({
  isOpen,
  platform,
  hasNativePrompt,
  onInstallClick,
  onDismiss,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[90] animate-slideUp font-normal">
      <div className="bg-slate-950/95 dark:bg-slate-900/95 text-white border border-teal-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl shadow-teal-950/50 backdrop-blur-2xl relative overflow-hidden space-y-3.5">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 via-cyan-400 to-amber-400" />

        {/* Close / Dismiss */}
        <button
          onClick={onDismiss}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
          title="Maybe later"
          aria-label="Close install prompt"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header content */}
        <div className="flex items-start gap-3.5 pr-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-center p-1.5 shrink-0 shadow-md">
            <img src={BRAND_LOGO} alt="Team Taraba River" className="w-full h-full object-contain" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Install Team Taraba App
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-900/80 text-teal-300 border border-teal-500/40">
                <Sparkles className="w-2.5 h-2.5" /> Fast PWA
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Install directly on your home screen for full-screen experience, offline access, and instant updates.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            onClick={onInstallClick}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 active:scale-98 text-white font-bold text-xs sm:text-sm shadow-md shadow-teal-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {hasNativePrompt ? (
              <>
                <Download className="w-4 h-4" />
                <span>1-Tap Install</span>
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4" />
                <span>How to Install ({platform === "ios" ? "iPhone" : platform === "huawei" ? "Huawei" : "Device"})</span>
              </>
            )}
          </button>
          <button
            onClick={onDismiss}
            className="py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
};
