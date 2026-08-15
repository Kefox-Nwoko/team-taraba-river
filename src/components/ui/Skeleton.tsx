import React from "react";

/** Shimmering skeleton block — used as loading placeholders for buttery,
 *  jank-free content swaps (no abrupt blank/spinner fl/c). */
export const Skeleton: React.FC<{
  className?: string;
  rounded?: string;
}> = ({ className = "", rounded = "rounded-xl" }) => (
  <div
    className={`relative overflow-hidden bg-slate-200/70 dark:bg-slate-700/40 ${rounded} ${className}`}
    aria-hidden="true"
  >
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
  </div>
);

/** Full-view placeholder for lazy-loaded routes (admin / media / profile). */
export const ViewSkeleton: React.FC<{ label?: string }> = ({ label }) => (
  <div className="space-y-6 sm:space-y-8 animate-fadeIn" aria-busy="true" aria-live="polite">
    <div className="flex items-center gap-4">
      <Skeleton className="w-16 h-16" rounded="rounded-2xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square w-full" />
      ))}
    </div>
    {label && (
      <p className="sr-only">{label} is loading…</p>
    )}
  </div>
);
