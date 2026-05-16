"use client";

import { useEffect, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export const VERIFICATION_WINDOW_MS = 15 * 60 * 1000;

type SlateItem = {
  _id: Id<"tasks">;
  name: string;
  description?: string;
  category: "MORNING" | "MOVE" | "FUEL" | "MIND" | "REST";
  points: number;
  frequency: "DAILY" | "WEEKLY";
  proof: "PHOTO" | "SCREENSHOT" | "VIDEO";
  claimedThisPeriod: boolean;
  completionId: Id<"completions"> | null;
  claimedAt: number | null;
  verifiedAt: number | null;
  proofUrl: string | null;
};

type Mode = "untouched" | "claimed" | "verified" | "expired";

function deriveMode(item: SlateItem, now: number): Mode {
  if (!item.claimedThisPeriod) return "untouched";
  if (item.verifiedAt !== null) return "verified";
  if (item.claimedAt !== null && now > item.claimedAt + VERIFICATION_WINDOW_MS) {
    return "expired";
  }
  return "claimed";
}

function formatMs(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min >= 1) return `${min}m`;
  return `${remSec}s`;
}

export function TodaySlate({
  slate,
  onClaim,
  onUnclaim,
  onUpload,
  onOpenProof,
}: {
  slate: SlateItem[];
  onClaim: (taskId: Id<"tasks">) => void;
  onUnclaim: (completionId: Id<"completions">) => void;
  onUpload: (completionId: Id<"completions">, file: File) => void;
  onOpenProof: (url: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
      {slate.map((task) => {
        const mode = deriveMode(task, now);
        return (
          <SlateRow
            key={task._id}
            task={task}
            mode={mode}
            now={now}
            onClaim={onClaim}
            onUnclaim={onUnclaim}
            onUpload={onUpload}
            onOpenProof={onOpenProof}
          />
        );
      })}
    </ol>
  );
}

function SlateRow({
  task,
  mode,
  now,
  onClaim,
  onUnclaim,
  onUpload,
  onOpenProof,
}: {
  task: SlateItem;
  mode: Mode;
  now: number;
  onClaim: (id: Id<"tasks">) => void;
  onUnclaim: (id: Id<"completions">) => void;
  onUpload: (id: Id<"completions">, file: File) => void;
  onOpenProof: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onCircle = () => {
    if (mode === "untouched") {
      onClaim(task._id);
    } else if (mode === "claimed" && task.completionId) {
      onUnclaim(task.completionId);
    }
  };

  const onPickFile = () => fileInputRef.current?.click();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && task.completionId) {
      onUpload(task.completionId, file);
    }
    e.target.value = "";
  };

  const timeLeftMs =
    task.claimedAt !== null
      ? task.claimedAt + VERIFICATION_WINDOW_MS - now
      : 0;

  return (
    <li className={`slate-row slate-${mode}`}>
      <button
        className={`task-check ${mode === "verified" ? "verified" : mode === "claimed" ? "claimed" : mode === "expired" ? "expired" : ""}`}
        aria-label={
          mode === "untouched"
            ? "Claim task"
            : mode === "claimed"
              ? "Unclaim"
              : ""
        }
        onClick={onCircle}
        disabled={mode === "verified" || mode === "expired"}
      >
        {mode === "verified" && (
          <svg viewBox="0 0 24 24">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
        {mode === "claimed" && <span className="check-dot" />}
        {mode === "expired" && <span className="check-x">×</span>}
      </button>

      <div className="slate-main">
        <h3 className="slate-name">{task.name}</h3>
        <div className="slate-meta">
          <span><b>{task.category}</b></span>
          <span className="sep">·</span>
          <span>{task.frequency === "DAILY" ? "Daily" : "Weekly"}</span>
          <span className="sep">·</span>
          <span>Proof <b>{task.proof}</b></span>
          {mode === "claimed" && (
            <span className="slate-tag claim-tag">
              Unverified · {formatMs(timeLeftMs)} left
            </span>
          )}
          {mode === "verified" && (
            <span className="slate-tag verify-tag">Verified</span>
          )}
          {mode === "expired" && (
            <span className="slate-tag expired-tag">Claim expired</span>
          )}
        </div>
      </div>

      <div className="slate-tail">
        {mode === "verified" && task.proofUrl && (
          <button
            className="proof-thumb"
            onClick={() => onOpenProof(task.proofUrl!)}
            aria-label="View proof"
          >
            <img src={task.proofUrl} alt="" />
          </button>
        )}
        {mode === "claimed" && (
          <button className="btn-upload" onClick={onPickFile}>
            Upload proof
          </button>
        )}
        <div className="slate-pts">
          <span className="num">+{task.points}</span>
          <span className="pts-label">pts</span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={onFile}
      />
    </li>
  );
}
