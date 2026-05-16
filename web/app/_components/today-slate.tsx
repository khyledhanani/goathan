"use client";

import type { Id } from "../../convex/_generated/dataModel";

type SlateItem = {
  _id: Id<"tasks">;
  name: string;
  description?: string;
  category: "GYM" | "CARDIO" | "NUTRITION" | "RECOVERY" | "PROGRESS";
  points: number;
  frequency: "DAILY" | "WEEKLY";
  proof: "PHOTO" | "SCREENSHOT" | "MANUAL" | "VIDEO";
  done: boolean;
};

export function TodaySlate({
  slate,
  onToggle,
}: {
  slate: SlateItem[];
  onToggle: (id: Id<"tasks">) => void;
}) {
  if (slate.length === 0) {
    return (
      <div className="slate-empty">
        <p className="eyebrow">No tasks yet</p>
        <p className="slate-empty-line">
          An admin needs to drop a few lines for the squad.
        </p>
      </div>
    );
  }

  return (
    <ol className="slate">
      {slate.map((task) => (
        <li
          key={task._id}
          className={`slate-row ${task.done ? "done" : ""}`}
          onClick={() => onToggle(task._id)}
        >
          <button
            className={`task-check ${task.done ? "checked" : ""}`}
            aria-label={task.done ? "Mark not done" : "Mark done"}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(task._id);
            }}
          >
            {task.done && (
              <svg viewBox="0 0 24 24">
                <path d="M5 12l5 5L20 7" />
              </svg>
            )}
          </button>
          <div className="slate-main">
            <h3 className="slate-name">{task.name}</h3>
            <div className="slate-meta">
              <span>
                <b>{task.category}</b>
              </span>
              <span className="sep">·</span>
              <span>{task.frequency === "DAILY" ? "Daily" : "Weekly"}</span>
              <span className="sep">·</span>
              <span>
                Proof <b>{task.proof}</b>
              </span>
            </div>
          </div>
          <div className="slate-pts">
            <span className="num">+{task.points}</span>
            <span className="pts-label">pts</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
