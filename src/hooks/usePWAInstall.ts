import { useState, useEffect, useCallback, useRef } from "react";

export type DevicePlatform = "ios" | "huawei" | "android" | "desktop";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const INSTALL_DISMISS_KEY = "taraba_pwa_install_dismissed_at";
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours cooldown

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState<DevicePlatform>("desktop");
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [showAutoInstallPrompt, setShowAutoInstallPrompt] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // 1. Detect platform and standalone status
  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";

    // Check standalone mode
    const isRunningStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://") ||
      window.location.search.includes("source=pwa");

    setIsStandalone(isRunningStandalone);

    // Identify platform
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

    // Auto-prompt opportunity for uninstalled devices
    if (!isRunningStandalone) {
      const dismissedAt = localStorage.getItem(INSTALL_DISMISS_KEY);
      const isCooldownActive = dismissedAt && Date.now() - parseInt(dismissedAt, 10) < DISMISS_COOLDOWN_MS;

      if (!isCooldownActive) {
        // Show non-intrusive install prompt after a short 1.8s delay on launch
        const timer = setTimeout(() => {
          setShowAutoInstallPrompt(true);
        }, 1800);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // 2. Listen for native browser install prompts
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setIsInstallModalOpen(false);
      setShowAutoInstallPrompt(false);
      try {
        localStorage.removeItem(INSTALL_DISMISS_KEY);
      } catch {}
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // 3. Service Worker Update Detection & Management
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const trackWorker = (reg: ServiceWorkerRegistration) => {
      registrationRef.current = reg;

      // Check if an updated worker is already waiting
      if (reg.waiting) {
        waitingWorkerRef.current = reg.waiting;
        setUpdateAvailable(true);
      }

      // Listen for newly discovered service workers installing in background
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            waitingWorkerRef.current = newWorker;
            setUpdateAvailable(true);
          }
        });
      });
    };

    // Obtain current registration or register
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        trackWorker(reg);
      } else if (import.meta.env.PROD) {
        navigator.serviceWorker.register("/sw.js").then((newReg) => {
          trackWorker(newReg);
        }).catch(() => {});
      }
    });

    // When the active controller changes (new SW took over), reload cleanly
    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    // Actively check for updates on app focus, visibility change, online event, and periodic interval
    const checkRegistrationUpdate = () => {
      if (registrationRef.current) {
        registrationRef.current.update().catch(() => {});
      } else {
        navigator.serviceWorker.getRegistration().then((r) => {
          if (r) {
            registrationRef.current = r;
            r.update().catch(() => {});
          }
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkRegistrationUpdate();
      }
    };

    window.addEventListener("focus", checkRegistrationUpdate);
    window.addEventListener("online", checkRegistrationUpdate);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Periodic background update check every 15 minutes
    const interval = setInterval(checkRegistrationUpdate, 15 * 60 * 1000);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      window.removeEventListener("focus", checkRegistrationUpdate);
      window.removeEventListener("online", checkRegistrationUpdate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
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
          setShowAutoInstallPrompt(false);
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
    setShowAutoInstallPrompt(false);
  }, []);

  const closeInstallModal = useCallback(() => {
    setIsInstallModalOpen(false);
  }, []);

  const dismissAutoInstallPrompt = useCallback(() => {
    setShowAutoInstallPrompt(false);
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, Date.now().toString());
    } catch {}
  }, []);

  const applyUpdate = useCallback(() => {
    setIsUpdating(true);
    if (waitingWorkerRef.current) {
      waitingWorkerRef.current.postMessage({ type: "SKIP_WAITING" });
    } else if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } else {
      window.location.reload();
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  const checkForUpdates = useCallback(() => {
    if (registrationRef.current) {
      registrationRef.current.update().catch(() => {});
    }
  }, []);

  return {
    isStandalone,
    platform,
    hasNativePrompt: !!deferredPrompt,
    isInstallModalOpen,
    showAutoInstallPrompt,
    updateAvailable,
    isUpdating,
    openInstallModal,
    closeInstallModal,
    dismissAutoInstallPrompt,
    triggerNativeInstall,
    applyUpdate,
    dismissUpdate,
    checkForUpdates,
  };
}
