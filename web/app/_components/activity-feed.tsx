"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { VERIFICATION_WINDOW_MS } from "./today-slate";
import { AiBadge, type AiVerification } from "./ai-badge";

type CommentItem = {
  _id: Id<"comments">;
  authorUserId: Id<"users">;
  authorName: string;
  isYou: boolean;
  body: string;
  createdAt: number;
};

type FeedItem = {
  completionId: Id<"completions">;
  memberUserId: Id<"users">;
  memberDisplayName: string;
  memberAvatarUrl?: string;
  isYou: boolean;
  taskName: string;
  taskCategory: "MORNING" | "MOVE" | "FUEL" | "MIND" | "REST";
  points: number;
  claimedAt: number;
  verifiedAt: number | null;
  revokedAt: number | null;
  proofUrl: string | null;
  challengeCount: number;
  challengedByYou: boolean;
  comments: CommentItem[];
  aiVerification: AiVerification | null;
};

function timeAgo(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

type FeedMode = "claimed" | "verified" | "expired";

function deriveMode(item: FeedItem, now: number): FeedMode {
  if (item.verifiedAt !== null) return "verified";
  if (now > item.claimedAt + VERIFICATION_WINDOW_MS) return "expired";
  return "claimed";
}

export function ActivityFeed({
  items,
  onCallCap,
  onComment,
  onOpenProof,
}: {
  items: FeedItem[];
  onCallCap: (completionId: Id<"completions">) => void;
  onComment: (completionId: Id<"completions">, body: string) => Promise<void>;
  onOpenProof: (url: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (items.length === 0) {
    return (
      <div className="activity-empty">
        <p className="eyebrow">Nothing yet</p>
        <p className="activity-empty-line">
          Lock in a task and you&apos;ll show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="activity-feed">
      {items.map((item) => {
        const mode = deriveMode(item, now);
        return (
          <ActivityRow
            key={item.completionId}
            item={item}
            mode={mode}
            now={now}
            onCallCap={onCallCap}
            onComment={onComment}
            onOpenProof={onOpenProof}
          />
        );
      })}
    </ul>
  );
}

function ActivityRow({
  item,
  mode,
  now,
  onCallCap,
  onComment,
  onOpenProof,
}: {
  item: FeedItem;
  mode: FeedMode;
  now: number;
  onCallCap: (id: Id<"completions">) => void;
  onComment: (id: Id<"completions">, body: string) => Promise<void>;
  onOpenProof: (url: string) => void;
}) {
  const verb =
    mode === "claimed" ? "claimed" : mode === "verified" ? "verified" : "no-showed";
  const taskClass =
    mode === "claimed"
      ? "pending"
      : mode === "verified"
        ? ""
        : "expired";

  const isRevoked = item.revokedAt !== null;

  return (
    <li
      className={`activity-row activity-${mode} ${item.challengeCount > 0 ? "challenged" : ""} ${isRevoked ? "revoked" : ""}`}
    >
      <div className="activity-top">
        {item.memberAvatarUrl ? (
          <img
            src={item.memberAvatarUrl}
            alt=""
            width={32}
            height={32}
            className="avatar"
          />
        ) : (
          <span className="avatar avatar-fallback">
            {item.memberDisplayName.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="activity-main">
          <p className="activity-line">
            <span className="activity-name">{item.memberDisplayName}</span>{" "}
            <span className="activity-verb">{verb}</span>{" "}
            <span className={`activity-task ${taskClass}`}>{item.taskName}</span>
            {mode === "claimed" && (
              <span className="claim-window">
                {" "}· {formatLeft(item.claimedAt + VERIFICATION_WINDOW_MS - now)} to verify
              </span>
            )}
            {item.challengeCount > 0 && (
              <span className="activity-cap-count">
                · {item.challengeCount} cap{item.challengeCount > 1 ? "s" : ""}
              </span>
            )}
            {isRevoked && (
              <span className="activity-revoked-tag">· revoked</span>
            )}
            {item.aiVerification && (
              <span className="activity-ai-slot">
                <AiBadge verification={item.aiVerification} />
              </span>
            )}
          </p>
          <span className="activity-time mono">
            {timeAgo(mode === "verified" ? (item.verifiedAt ?? item.claimedAt) : item.claimedAt)}
          </span>
        </div>
        {mode === "verified" && (item.proofUrl || !item.isYou) && (
          <div className="activity-actions">
            {item.proofUrl && (
              <button
                className="proof-thumb proof-thumb-sm"
                onClick={() => onOpenProof(item.proofUrl!)}
                aria-label="View proof"
              >
                <img src={item.proofUrl} alt="" />
              </button>
            )}
            {!item.isYou && (
              <button
                className={`btn-cap ${item.challengedByYou ? "called" : ""}`}
                onClick={() => onCallCap(item.completionId)}
              >
                {item.challengedByYou ? "Cap called" : "Call cap"}
              </button>
            )}
          </div>
        )}
      </div>

      <CommentThread
        comments={item.comments}
        onSubmit={(body) => onComment(item.completionId, body)}
      />
    </li>
  );
}

function formatLeft(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(sec / 60);
  if (min >= 1) return `${min}m`;
  return `<1m`;
}

function CommentThread({
  comments,
  onSubmit,
}: {
  comments: CommentItem[];
  onSubmit: (body: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await onSubmit(body);
      setDraft("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="thread">
      {comments.length > 0 && (
        <ul className="thread-list">
          {comments.map((c) => (
            <li key={c._id} className="thread-comment">
              <span className="thread-author">{c.authorName}</span>
              <span className="thread-body">{c.body}</span>
              <span className="thread-time mono">{timeAgo(c.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
      <form className="thread-form" onSubmit={submit}>
        <input
          className="thread-input"
          placeholder={comments.length > 0 ? "Reply…" : "Comment…"}
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
  );
}
