"use client";

import { useState, type FormEvent } from "react";
import type { Id } from "../../convex/_generated/dataModel";

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
  taskCategory: "GYM" | "CARDIO" | "NUTRITION" | "RECOVERY" | "PROGRESS";
  points: number;
  completedAt: number;
  challengeCount: number;
  challengedByYou: boolean;
  comments: CommentItem[];
};

type ActivityBlock = {
  key: string;
  memberUserId: Id<"users">;
  memberDisplayName: string;
  memberAvatarUrl?: string;
  isYou: boolean;
  items: FeedItem[];
  latestAt: number;
  latestCompletionId: Id<"completions">;
  totalChallenges: number;
  aggregatedComments: CommentItem[];
};

const verbForSingle = (category: FeedItem["taskCategory"]): string => {
  if (category === "NUTRITION") return "hit";
  if (category === "RECOVERY") return "logged";
  return "locked in";
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

function groupConsecutive(items: FeedItem[]): ActivityBlock[] {
  const blocks: ActivityBlock[] = [];
  for (const item of items) {
    const last = blocks[blocks.length - 1];
    if (last && last.memberUserId === item.memberUserId) {
      last.items.push(item);
      last.totalChallenges += item.challengeCount;
      last.aggregatedComments.push(...item.comments);
    } else {
      blocks.push({
        key: item.completionId,
        memberUserId: item.memberUserId,
        memberDisplayName: item.memberDisplayName,
        memberAvatarUrl: item.memberAvatarUrl,
        isYou: item.isYou,
        items: [item],
        latestAt: item.completedAt,
        latestCompletionId: item.completionId,
        totalChallenges: item.challengeCount,
        aggregatedComments: [...item.comments],
      });
    }
  }
  for (const b of blocks) {
    b.aggregatedComments.sort((a, b) => a.createdAt - b.createdAt);
  }
  return blocks;
}

export function ActivityFeed({
  items,
  onCallCap,
  onComment,
}: {
  items: FeedItem[];
  onCallCap: (completionId: Id<"completions">) => void;
  onComment: (completionId: Id<"completions">, body: string) => Promise<void>;
}) {
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

  const blocks = groupConsecutive(items);

  return (
    <ul className="activity-feed">
      {blocks.map((block) =>
        block.items.length === 1 ? (
          <SingleRow
            key={block.key}
            item={block.items[0]}
            onCallCap={onCallCap}
            onComment={onComment}
          />
        ) : (
          <GroupedRow
            key={block.key}
            block={block}
            onCallCap={onCallCap}
            onComment={onComment}
          />
        ),
      )}
    </ul>
  );
}

function SingleRow({
  item,
  onCallCap,
  onComment,
}: {
  item: FeedItem;
  onCallCap: (id: Id<"completions">) => void;
  onComment: (id: Id<"completions">, body: string) => Promise<void>;
}) {
  return (
    <li
      className={`activity-row ${item.challengeCount > 0 ? "challenged" : ""}`}
    >
      <div className="activity-top">
        <Avatar
          name={item.memberDisplayName}
          src={item.memberAvatarUrl}
          size={32}
        />
        <div className="activity-main">
          <p className="activity-line">
            <span className="activity-name">{item.memberDisplayName}</span>{" "}
            <span className="activity-verb">{verbForSingle(item.taskCategory)}</span>{" "}
            <span className="activity-task">{item.taskName}</span>
            {item.challengeCount > 0 && (
              <span className="activity-cap-count">
                · {item.challengeCount} cap
                {item.challengeCount > 1 ? "s" : ""}
              </span>
            )}
          </p>
          <span className="activity-time mono">{timeAgo(item.completedAt)}</span>
        </div>
        {!item.isYou && (
          <button
            className={`btn-cap ${item.challengedByYou ? "called" : ""}`}
            onClick={() => onCallCap(item.completionId)}
          >
            {item.challengedByYou ? "Cap called" : "Call cap"}
          </button>
        )}
      </div>

      <CommentThread
        comments={item.comments}
        onSubmit={(body) => onComment(item.completionId, body)}
      />
    </li>
  );
}

function GroupedRow({
  block,
  onCallCap,
  onComment,
}: {
  block: ActivityBlock;
  onCallCap: (id: Id<"completions">) => void;
  onComment: (id: Id<"completions">, body: string) => Promise<void>;
}) {
  const count = block.items.length;
  return (
    <li
      className={`activity-row activity-row-grouped ${block.totalChallenges > 0 ? "challenged" : ""}`}
    >
      <div className="activity-top">
        <Avatar
          name={block.memberDisplayName}
          src={block.memberAvatarUrl}
          size={32}
        />
        <div className="activity-main">
          <p className="activity-line">
            <span className="activity-name">{block.memberDisplayName}</span>{" "}
            <span className="activity-verb">stacked</span>{" "}
            <span className="activity-task">
              {count} receipt{count > 1 ? "s" : ""}
            </span>
            {block.totalChallenges > 0 && (
              <span className="activity-cap-count">
                · {block.totalChallenges} cap
                {block.totalChallenges > 1 ? "s" : ""}
              </span>
            )}
          </p>
          <span className="activity-time mono">{timeAgo(block.latestAt)}</span>
        </div>
      </div>

      <ul className="activity-stack">
        {block.items.map((it) => (
          <li
            key={it.completionId}
            className={`activity-stack-item ${it.challengeCount > 0 ? "challenged" : ""}`}
          >
            <span className="activity-stack-name">{it.taskName}</span>
            <span className="activity-stack-cat">{it.taskCategory}</span>
            <span className="activity-stack-pts num">+{it.points}</span>
            {!block.isYou && (
              <button
                className={`btn-cap btn-cap-sm ${it.challengedByYou ? "called" : ""}`}
                onClick={() => onCallCap(it.completionId)}
              >
                {it.challengedByYou ? "Capped" : "Cap"}
              </button>
            )}
          </li>
        ))}
      </ul>

      <CommentThread
        comments={block.aggregatedComments}
        onSubmit={(body) => onComment(block.latestCompletionId, body)}
      />
    </li>
  );
}

function Avatar({
  name,
  src,
  size,
}: {
  name: string;
  src?: string;
  size: number;
}) {
  if (src) {
    return (
      <img src={src} alt="" width={size} height={size} className="avatar" />
    );
  }
  return (
    <span className="avatar avatar-fallback">
      {name.charAt(0).toUpperCase()}
    </span>
  );
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
