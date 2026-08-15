import React, { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

/** Subtle, non-blocking banner shown when the device loses connectivity.
 *  Reassures users the app still works from cached data and re-syncs on return. */
export const NetworkStatusBanner: React.FC = () => {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setReconnecting(true);
      // brief "reconnecting" flash, then settle
      const t = setTimeout(() => setReconnecting(false), 1600);
      return () => clearTimeout(t);
    };
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online && !reconnecting) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-[10000] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all duration-300 ${
        online
          ? "bg-emerald-600 animate-fadeIn"
          : "bg-amber-600"
      }`}
    >
      {online ? (
        <>
          <RefreshCw className="w-4 h-4" />
          <span>Back online — syncing latest updates…</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>You&apos;re offline — showing saved content. We&apos;ll reconnect automatically.</span>
        </>
      )}
    </div>
  );
};
