"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export type FeedComment = {
  _id: Id<"comments">;
  authorUserId: Id<"users">;
  authorName: string;
  isYou: boolean;
  body: string;
  createdAt: number;
};

export type FeedCardItem = {
  completionId: Id<"completions">;
  userId: Id<"users">;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  isYou: boolean;
  groupId: Id<"groups">;
  groupName: string;
  taskName: string;
  taskCategory: "MORNING" | "MOVE" | "FUEL" | "MIND" | "REST";
  points: number;
  verifiedAt: number;
  claimedAt: number;
  revokedAt: number | null;
  proofUrl: string | null;
  likeCount: number;
  likedByYou: boolean;
  challengeCount: number;
  challengedByYou: boolean;
  comments: FeedComment[];
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
  return `${Math.floor(day / 7)}w`;
}

export function FeedCard({
  item,
  onOpenProof,
  onToggleLike,
  onToggleCap,
  onComment,
}: {
  item: FeedCardItem;
  onOpenProof: (url: string) => void;
  onToggleLike: (id: Id<"completions">) => Promise<void> | void;
  onToggleCap: (id: Id<"completions">) => Promise<void> | void;
  onComment: (id: Id<"completions">, body: string) => Promise<void>;
}) {
  const [showThread, setShowThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await onComment(item.completionId, body);
      setDraft("");
    } finally {
      setBusy(false);
    }
  };

  const tapLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    try {
      await onToggleLike(item.completionId);
    } finally {
      setLikeBusy(false);
    }
  };

  const isRevoked = item.revokedAt !== null;

  return (
    <article className={`feed-card ${isRevoked ? "is-revoked" : ""}`}>
      {isRevoked && (
        <div className="feed-card-revoked-banner">
          <span className="feed-card-revoked-label">Revoked</span>
          <span className="feed-card-revoked-sub mono">
            {item.challengeCount} cap{item.challengeCount === 1 ? "" : "s"} —
            points pulled
          </span>
        </div>
      )}
      <header className="feed-card-head">
        <Link
          href={item.isYou ? "/profile" : `/u/${item.userId}`}
          className="feed-card-author"
        >
          {item.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.avatarUrl}
              alt=""
              width={36}
              height={36}
              className="avatar"
            />
          ) : (
            <span
              className="avatar avatar-fallback"
              style={{ width: 36, height: 36, fontSize: 15 }}
            >
              {item.displayName.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="feed-card-author-meta">
            <span className="feed-card-name">
              {item.isYou ? "You" : item.displayName}
            </span>
            <span className="feed-card-sub mono">
              <Link
                href={`/group/${item.groupId}`}
                className="feed-card-group"
                onClick={(e) => e.stopPropagation()}
              >
                in {item.groupName}
              </Link>
              <span aria-hidden> · </span>
              {timeAgo(item.verifiedAt)}
            </span>
          </div>
        </Link>
        <span className="feed-card-cat">{item.taskCategory}</span>
      </header>

      {item.proofUrl && (
        <FeedPhoto
          src={item.proofUrl}
          displayName={item.displayName}
          onOpen={() => onOpenProof(item.proofUrl!)}
        />
      )}

      <div className="feed-card-actions">
        <button
          type="button"
          className={`feed-action ${item.likedByYou ? "is-liked" : ""}`}
          onClick={tapLike}
          disabled={likeBusy}
          aria-pressed={item.likedByYou}
          aria-label={item.likedByYou ? "Unlike" : "Like"}
        >
          <HeartIcon filled={item.likedByYou} />
          {item.likeCount > 0 && (
            <span className="feed-action-count num">{item.likeCount}</span>
          )}
        </button>

        <button
          type="button"
          className="feed-action"
          onClick={() => setShowThread((s) => !s)}
          aria-expanded={showThread}
          aria-label="Toggle comments"
        >
          <ChatIcon />
          {item.comments.length > 0 && (
            <span className="feed-action-count num">
              {item.comments.length}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`feed-action feed-action-cap ${
            item.challengedByYou ? "is-capped" : ""
          }`}
          onClick={() => onToggleCap(item.completionId)}
          aria-pressed={item.challengedByYou}
          aria-label={item.challengedByYou ? "Retract cap" : "Call cap"}
          title="Call Cap — this looks suspicious"
        >
          <FlagIcon filled={item.challengedByYou} />
          {item.challengeCount > 0 && (
            <span className="feed-action-count num">
              {item.challengeCount}
            </span>
          )}
        </button>
      </div>

      <div className="feed-card-task-row">
        <span className="feed-card-task">{item.taskName}</span>
        <span
          className={`feed-card-pts num ${isRevoked ? "is-revoked" : ""}`}
        >
          +{item.points}
        </span>
      </div>

      {!showThread && item.comments.length > 0 && (
        <button
          type="button"
          className="feed-card-thread-toggle"
          onClick={() => setShowThread(true)}
        >
          View{" "}
          {item.comments.length === 1
            ? "1 comment"
            : `all ${item.comments.length} comments`}
        </button>
      )}

      {showThread && (
        <div className="feed-card-thread">
          {item.comments.length > 0 && (
            <ul className="thread-list">
              {item.comments.map((c) => (
                <li key={c._id} className="thread-comment">
                  <span className="thread-author">
                    {c.isYou ? "You" : c.authorName}
                  </span>
                  <span className="thread-body">{c.body}</span>
                  <span className="thread-time mono">
                    {timeAgo(c.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <form className="thread-form" onSubmit={submit}>
            <input
              className="thread-input"
              placeholder={
                item.comments.length > 0 ? "Reply…" : "Comment…"
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={240}
              disabled={busy}
            />
            <button
              type="submit"
              className="thread-submit"
              disabled={!draft.trim() || busy}
              aria-label="Post comment"
            >
              ↵
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

function FeedPhoto({
  src,
  displayName,
  onOpen,
}: {
  src: string;
  displayName: string;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      type="button"
      className="feed-card-image-btn"
      onClick={onOpen}
      aria-label={`View full proof from ${displayName}`}
    >
      {!loaded && (
        <span className="media-spinner" aria-hidden>
          <span className="media-spinner-ring" />
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`feed-card-image ${loaded ? "is-loaded" : ""}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24">
        <path
          d="M12 21s-7-4.5-9.5-9.4C.8 8.1 3 4 7 4c2 0 3.6 1 5 2.7C13.4 5 15 4 17 4c4 0 6.2 4.1 4.5 7.6C19 16.5 12 21 12 21z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 20s-6.4-4.2-8.8-8.7C1.9 8.6 3.7 5 7 5c1.9 0 3.4 1 5 2.7C13.6 6 15.1 5 17 5c3.3 0 5.1 3.6 3.8 6.3C18.4 15.8 12 20 12 20z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5.5h16v10H8l-4 3.5v-13.5z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlagIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24">
        <path d="M5 4v16h1.6V14h11.4l-2-3.5L18 7H6.6V4z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M5.5 4v16M5.5 5h11.5l-2 3.5L17 13H5.5"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
