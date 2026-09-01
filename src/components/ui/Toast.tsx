import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  persistent?: boolean;
  duration?: number;
}

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  persistent?: boolean;
}

export interface ToastContextValue {
  notify: (message: string, tone?: ToastTone, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({
  notify: () => {},
});

export const useToast = () => useContext(ToastContext);

const toneStyles: Record<ToastTone, { ring: string; icon: React.ReactNode }> = {
  success: {
    ring: "border-emerald-300/70 dark:border-emerald-700/60",
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
  },
  error: {
    ring: "border-rose-300/70 dark:border-rose-700/60",
    icon: <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />,
  },
  info: {
    ring: "border-teal-300/70 dark:border-teal-700/60",
    icon: <Info className="w-5 h-5 text-teal-500 shrink-0" />,
  },
  warning: {
    ring: "border-amber-300/70 dark:border-amber-700/60",
    icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = "info", options?: ToastOptions) => {
      const id = Date.now() + Math.random();
      const isPersistent = options?.persistent ?? false;
      const duration = options?.duration ?? (isPersistent ? 0 : 4200);

      setToasts((prev) => [...prev, { id, message, tone, persistent: isPersistent }]);

      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-24 md:bottom-6 right-4 sm:right-6 z-[10001] flex flex-col gap-2 w-[min(92vw,22rem)] pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl px-4 py-3 shadow-2xl border ${toneStyles[t.tone]?.ring || toneStyles.info.ring} animate-slideUp`}
          >
            {toneStyles[t.tone]?.icon || toneStyles.info.icon}
            <p className="text-sm text-slate-800 dark:text-slate-100 leading-snug flex-1">
              {t.message}
            </p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0 p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer"
              aria-label="Dismiss notification"
              title="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
