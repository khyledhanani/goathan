"use client";

import Link from "next/link";

export type ProofFeedItem = {
  completionId: string;
  userId: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  isYou: boolean;
  groupId: string;
  groupName: string;
  taskName: string;
  taskCategory: "MORNING" | "MOVE" | "FUEL" | "MIND" | "REST";
  points: number;
  verifiedAt: number;
  claimedAt: number;
  proofUrl: string | null;
  challengeCount: number;
};

function timeAgo(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const wk = Math.floor(day / 7);
  return `${wk}w`;
}

export function ProofFeed({
  items,
  onOpenProof,
}: {
  items: ProofFeedItem[];
  onOpenProof: (url: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="activity-empty">
        <p className="eyebrow">Nothing yet</p>
        <p className="activity-empty-line">No proof uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="proof-feed">
      {items.map((it) => (
        <article key={it.completionId} className="proof-feed-card">
          <header className="proof-feed-head">
            <Link
              href={it.isYou ? "/profile" : `/u/${it.userId}`}
              className="proof-feed-author"
            >
              {it.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="avatar"
                />
              ) : (
                <span
                  className="avatar avatar-fallback"
                  style={{ width: 32, height: 32, fontSize: 14 }}
                >
                  {it.displayName.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="proof-feed-author-meta">
                <span className="proof-feed-name">
                  {it.isYou ? "You" : it.displayName}
                </span>
                <span className="proof-feed-sub mono">
                  in {it.groupName} · {timeAgo(it.verifiedAt)}
                </span>
              </div>
            </Link>
            <span className="proof-feed-cat">{it.taskCategory}</span>
          </header>

          {it.proofUrl && (
            <button
              type="button"
              className="proof-feed-image-btn"
              onClick={() => onOpenProof(it.proofUrl!)}
              aria-label={`View full proof from ${it.displayName}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.proofUrl}
                alt=""
                className="proof-feed-image"
                loading="lazy"
              />
            </button>
          )}

          <footer className="proof-feed-foot">
            <span className="proof-feed-task">{it.taskName}</span>
            <span className="proof-feed-meta">
              <span className="proof-feed-pts num">+{it.points}</span>
              {it.challengeCount > 0 && (
                <span className="proof-feed-cap">
                  · {it.challengeCount} cap{it.challengeCount > 1 ? "s" : ""}
                </span>
              )}
            </span>
          </footer>
        </article>
      ))}
    </div>
  );
}
