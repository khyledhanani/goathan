"use client";

import { useEffect, useState } from "react";

export function ProofLightbox({
  url,
  onClose,
}: {
  url: string | null;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!url) return;
    setLoaded(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url, onClose]);

  if (!url) return null;
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);

  return (
    <div className="lightbox-scrim" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lightbox" onClick={(e) => e.stopPropagation()}>
        {!loaded && (
          <span className="media-spinner media-spinner-dark" aria-hidden>
            <span className="media-spinner-ring" />
          </span>
        )}
        {isVideo ? (
          <video
            src={url}
            controls
            autoPlay
            className={`lightbox-media ${loaded ? "is-loaded" : ""}`}
            onLoadedData={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt="proof"
            className={`lightbox-media ${loaded ? "is-loaded" : ""}`}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        )}
        <button className="lightbox-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  );
}
