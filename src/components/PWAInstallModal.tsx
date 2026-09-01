import React, { useState } from "react";
import { DevicePlatform } from "../hooks/usePWAInstall";
import { BRAND_LOGO } from "../constants/assets";
import {
  Download,
  Share,
  PlusSquare,
  Smartphone,
  CheckCircle2,
  X,
  Sparkles,
  Zap,
  ShieldCheck,
  Globe,
  Layers,
  MoreVertical,
} from "lucide-react";

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: DevicePlatform;
  hasNativePrompt: boolean;
  onTriggerNativeInstall: () => Promise<boolean>;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  platform,
  hasNativePrompt,
  onTriggerNativeInstall,
}) => {
  const [selectedTab, setSelectedTab] = useState<DevicePlatform>(platform);
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await onTriggerNativeInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn font-normal">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden space-y-5">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-cyan-500 to-amber-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* App Branding & Header */}
        <div className="flex items-center gap-3.5 pt-1">
          <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center p-1.5 shrink-0 shadow-md">
            <img src={BRAND_LOGO} alt="Taraba River Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Team Taraba River
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                PWA App
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Install directly to your device home screen
            </p>
          </div>
        </div>

        {/* Silicon Valley Feature Pills */}
        <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center gap-1">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>120fps Smooth</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center gap-1">
            <Layers className="w-4 h-4 text-teal-500" />
            <span>Zero Disk Bloat</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center gap-1">
            <Smartphone className="w-4 h-4 text-cyan-500" />
            <span>Full Screen App</span>
          </div>
        </div>

        {/* Platform Selector Tabs */}
        <div className="flex items-center justify-between p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
          <button
            onClick={() => setSelectedTab("ios")}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedTab === "ios"
                ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>iPhone / iPad</span>
          </button>
          <button
            onClick={() => setSelectedTab("android")}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedTab === "android"
                ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Android</span>
          </button>
          <button
            onClick={() => setSelectedTab("huawei")}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedTab === "huawei"
                ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Huawei</span>
          </button>
        </div>

        {/* Instructions Body */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-3.5">
          {/* iOS Safari Instructions */}
          {selectedTab === "ios" && (
            <div className="space-y-3">
              <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Share className="w-4 h-4 text-blue-500" />
                <span>3-step iOS Safari Installation:</span>
              </p>
              <div className="space-y-2.5 text-slate-600 dark:text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    Open this page in <strong>Safari</strong> and tap the <strong>Share</strong> button{" "}
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold">
                      <Share className="w-3 h-3 inline mr-1" /> Share
                    </span>{" "}
                    at the bottom of your screen.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    2
                  </span>
                  <p>
                    Scroll down and select{" "}
                    <strong className="text-teal-700 dark:text-teal-400 font-bold">
                      "Add to Home Screen"
                    </strong>{" "}
                    <PlusSquare className="w-3.5 h-3.5 inline text-teal-600 ml-0.5" />.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    3
                  </span>
                  <p>
                    Tap <strong>"Add"</strong> in the top right corner. The app icon will now appear on your home screen!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Android Instructions */}
          {selectedTab === "android" && (
            <div className="space-y-3">
              {hasNativePrompt ? (
                <div className="text-center space-y-3 py-1">
                  <p className="text-slate-700 dark:text-slate-300">
                    Your device supports instant 1-tap installation:
                  </p>
                  <button
                    onClick={handleInstallClick}
                    disabled={isInstalling}
                    className="w-full py-3 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-teal-600/25 flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isInstalling ? "Installing…" : "Install App Now"}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 text-slate-600 dark:text-slate-300">
                  <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <MoreVertical className="w-4 h-4 text-amber-500" />
                    <span>Android Chrome / Samsung Internet:</span>
                  </p>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <p>
                      Tap the <strong>three dots (⋮)</strong> menu in the top right of your browser.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <p>
                      Tap{" "}
                      <strong className="text-teal-700 dark:text-teal-400 font-bold">
                        "Install App"
                      </strong>{" "}
                      or <strong>"Add to Home screen"</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <p>Confirm the prompt to install the standalone app.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Huawei / HarmonyOS Instructions */}
          {selectedTab === "huawei" && (
            <div className="space-y-3">
              <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-red-500" />
                <span>Huawei Browser / HarmonyOS:</span>
              </p>
              <div className="space-y-2.5 text-slate-600 dark:text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    Open this portal in <strong>Huawei Browser</strong> or <strong>Petal</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    2
                  </span>
                  <p>
                    Tap the <strong>Menu (Four Dots ∷ or 3 Dots ⋮)</strong> at the bottom/top of the screen.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    3
                  </span>
                  <p>
                    Select{" "}
                    <strong className="text-teal-700 dark:text-teal-400 font-bold">
                      "Add to home screen"
                    </strong>{" "}
                    or <strong>"Install Fast App / Service"</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end pt-1">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
