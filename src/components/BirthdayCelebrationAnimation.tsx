import React, { useEffect, useRef, useState } from "react";

interface BirthdayCelebrationAnimationProps {
  children: React.ReactNode;
  autoPlay?: boolean;
  durationMs?: number;
}

export const BirthdayCelebrationAnimation: React.FC<BirthdayCelebrationAnimationProps> = ({
  children,
  autoPlay = true,
  durationMs = 3500,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!autoPlay || prefersReducedMotion || hasPlayedRef.current) return;

    const timer = setTimeout(() => {
      if (containerRef.current) {
        hasPlayedRef.current = true;
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), durationMs);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [autoPlay, prefersReducedMotion, durationMs]);

  const showEffects = isAnimating && !prefersReducedMotion;

  return (
    <span ref={containerRef} className="relative block">
      {children}
      {showEffects && (
        <span aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-visible">
          <span className="absolute inset-0 rounded-md animate-birthday-glow" />
          <span className="absolute -top-2 left-1/2 -translate-x-1/2">
            <span className="absolute animate-birthday-sparkle-1" />
            <span className="absolute animate-birthday-sparkle-2" />
            <span className="absolute animate-birthday-sparkle-3" />
          </span>
          <span className="absolute -bottom-3 left-1/2 -translate-x-1/2">
            <span className="absolute animate-birthday-confetti-1" />
            <span className="absolute animate-birthday-confetti-2" />
            <span className="absolute animate-birthday-confetti-3" />
            <span className="absolute animate-birthday-confetti-4" />
            <span className="absolute animate-birthday-confetti-5" />
          </span>
        </span>
      )}
    </span>
  );
};
