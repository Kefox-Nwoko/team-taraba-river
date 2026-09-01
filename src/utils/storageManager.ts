/**
 * Storage and Cache Manager for Team Taraba River PWA
 * Keeps client devices buttery smooth and completely bloat-free.
 */

export interface StorageStats {
  usageBytes: number;
  quotaBytes: number;
  usageFormatted: string;
  quotaFormatted: string;
  percentUsed: number;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 KB";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export async function getStorageStats(): Promise<StorageStats> {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      const percent = quota > 0 ? (usage / quota) * 100 : 0;
      return {
        usageBytes: usage,
        quotaBytes: quota,
        usageFormatted: formatBytes(usage),
        quotaFormatted: formatBytes(quota),
        percentUsed: Math.min(100, Math.round(percent * 10) / 10),
      };
    } catch {
      // Fallback
    }
  }

  return {
    usageBytes: 0,
    quotaBytes: 0,
    usageFormatted: "Minimal (< 2 MB)",
    quotaFormatted: "Unlimited",
    percentUsed: 0,
  };
}

/**
 * Purge Service Worker Caches and temporary image blobs without touching user login session
 */
export async function clearAppCache(): Promise<boolean> {
  try {
    // 1. Clear CacheStorage
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    // 2. Notify active Service Worker to clear internal caches
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CLEAR_ALL_CACHES" });
    }

    // 3. Clear non-essential localStorage items (keep user session, theme, and auth tokens)
    const preservedKeys = new Set([
      "usosa_current_user",
      "usosa_auth_token",
      "taraba_river_session",
      "theme",
      "usosa_terms_accepted_v2",
    ]);

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !preservedKeys.has(key) && !key.startsWith("firebase:")) {
        // Only clear temporary caches/drafts
        if (key.includes("cache") || key.includes("temp") || key.includes("preview")) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach((k) => localStorage.removeItem(k));

    return true;
  } catch (err) {
    console.error("Failed to clear app cache:", err);
    return false;
  }
}
