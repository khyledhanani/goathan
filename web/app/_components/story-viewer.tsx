"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { StoryBundle } from "./stories-rail";

function StoryPhoto({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && (
        <span className="media-spinner media-spinner-dark" aria-hidden>
          <span className="media-spinner-ring" />
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`story-photo ${loaded ? "is-loaded" : ""}`}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </>
  );
}

function timeAgo(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return "today";
}

export function StoryViewer({
  stories,
  startIndex,
  onClose,
}: {
  stories: StoryBundle[];
  startIndex: number | null;
  onClose: () => void;
}) {
  const [userIdx, setUserIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);

  useEffect(() => {
    if (startIndex !== null) {
      setUserIdx(Math.max(0, Math.min(startIndex, stories.length - 1)));
      setItemIdx(0);
    }
  }, [startIndex, stories.length]);

  useEffect(() => {
    if (startIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIndex, userIdx, itemIdx, stories.length]);

  if (startIndex === null || stories.length === 0) return null;
  const bundle = stories[userIdx];
  if (!bundle) return null;
  const item = bundle.items[itemIdx];
  if (!item || !item.proofUrl) return null;

  function goPrev() {
    if (itemIdx > 0) {
      setItemIdx(itemIdx - 1);
    } else if (userIdx > 0) {
      const prev = stories[userIdx - 1];
      setUserIdx(userIdx - 1);
      setItemIdx(Math.max(0, prev.items.length - 1));
    }
  }

  function goNext() {
    if (itemIdx < bundle.items.length - 1) {
      setItemIdx(itemIdx + 1);
    } else if (userIdx < stories.length - 1) {
      setUserIdx(userIdx + 1);
      setItemIdx(0);
    } else {
      onClose();
    }
  }

  return (
    <div
      className="story-scrim"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="story-frame" onClick={(e) => e.stopPropagation()}>
        <div className="story-progress">
          {bundle.items.map((_, i) => (
            <span
              key={i}
              className={`story-progress-seg ${
                i < itemIdx
                  ? "done"
                  : i === itemIdx
                    ? "current"
                    : "upcoming"
              }`}
            />
          ))}
        </div>

        <header className="story-head">
          <Link
            href={bundle.isYou ? "/profile" : `/u/${bundle.userId}`}
            className="story-author"
            onClick={onClose}
          >
            {bundle.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bundle.avatarUrl}
                alt=""
                width={32}
                height={32}
                className="avatar"
              />
            ) : (
              <span
                className="avatar avatar-fallback"
                style={{ width: 32, height: 32, fontSize: 13 }}
              >
                {bundle.displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="story-author-meta">
              <span className="story-author-name">
                {bundle.isYou ? "You" : bundle.displayName}
              </span>
              <span className="story-author-sub mono">
                {item.groupName} · {timeAgo(item.verifiedAt)}
              </span>
            </span>
          </Link>
          <button
            className="story-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="story-photo-wrap">
          <StoryPhoto
            src={item.proofUrl}
            key={item.completionId}
          />
          <button
            className="story-nav story-nav-prev"
            onClick={goPrev}
            aria-label="Previous"
          />
          <button
            className="story-nav story-nav-next"
            onClick={goNext}
            aria-label="Next"
          />
        </div>

        <footer className="story-footer">
          <span className="story-cat">{item.taskCategory}</span>
          <span className="story-task">{item.taskName}</span>
          <span className="story-pts num">+{item.points}</span>
        </footer>
      </div>
    </div>
  );
}
