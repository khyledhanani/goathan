"use client";

import { useEffect } from "react";

export function ProofLightbox({
  url,
  onClose,
}: {
  url: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!url) return;
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
        {isVideo ? (
          <video src={url} controls autoPlay className="lightbox-media" />
        ) : (
          <img src={url} alt="proof" className="lightbox-media" />
        )}
        <button className="lightbox-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  );
}
