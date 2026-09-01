import { useState, useEffect, useCallback } from "react";

export type DevicePlatform = "ios" | "huawei" | "android" | "desktop";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState<DevicePlatform>("desktop");
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // Detect platform and standalone status
  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";

    // 1. Check standalone mode
    const isRunningStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://") ||
      window.location.search.includes("source=pwa");

    setIsStandalone(isRunningStandalone);

    // 2. Identify platform
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    const isHuawei =
      /HuaweiBrowser|HUAWEI|HONOR|HMSCore/i.test(ua) ||
      (ua.includes("Android") && ua.includes("HW"));

    const isAndroid = /Android/i.test(ua) && !isHuawei;

    if (isIOS) {
      setPlatform("ios");
    } else if (isHuawei) {
      setPlatform("huawei");
    } else if (isAndroid) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }

    // 3. Listen for Android/Chrome beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setIsInstallModalOpen(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const triggerNativeInstall = useCallback(async (): Promise<boolean> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
          setIsInstallModalOpen(false);
          return true;
        }
      } catch (err) {
        console.error("Native install prompt error:", err);
      }
    }
    return false;
  }, [deferredPrompt]);

  const openInstallModal = useCallback(() => {
    setIsInstallModalOpen(true);
  }, []);

  const closeInstallModal = useCallback(() => {
    setIsInstallModalOpen(false);
  }, []);

  return {
    isStandalone,
    platform,
    hasNativePrompt: !!deferredPrompt,
    isInstallModalOpen,
    openInstallModal,
    closeInstallModal,
    triggerNativeInstall,
  };
}
