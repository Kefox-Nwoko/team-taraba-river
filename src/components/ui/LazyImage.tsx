import React, { useState } from "react";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Optional blurred low-res placeholder shown until the full image decodes. */
  placeholderClassName?: string;
  referrerPolicy?: React.ImgHTMLAttributes<HTMLImageElement>["referrerPolicy"];
  onError?: React.ReactEventHandler<HTMLImageElement>;
}

/** Image that lazy-loads only when near the viewport and fades in once decoded.
 *  Keeps the main thread and bandwidth free on slow connections. */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = "",
  placeholderClassName = "bg-slate-200/70 dark:bg-slate-700/40",
  referrerPolicy,
  onError,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && !errored && (
        <div
          className={`absolute inset-0 animate-pulse ${placeholderClassName}`}
          aria-hidden="true"
        />
      )}
      {!errored && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy={referrerPolicy}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            setErrored(true);
            onError?.(e);
          }}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
};
