"use client";

import type { Id } from "../../convex/_generated/dataModel";

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
};

const verbFor = (category: FeedItem["taskCategory"]): string => {
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

export function ActivityFeed({
  items,
  onCallCap,
}: {
  items: FeedItem[];
  onCallCap: (completionId: Id<"completions">) => void;
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

  return (
    <ul className="activity-feed">
      {items.map((item) => (
        <li
          key={item.completionId}
          className={`activity-row ${item.challengeCount > 0 ? "challenged" : ""}`}
        >
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
              <span className="activity-verb">{verbFor(item.taskCategory)}</span>{" "}
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
        </li>
      ))}
    </ul>
  );
}
