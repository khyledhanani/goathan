"use client";

import { useEffect, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { AiBadge, type AiVerification } from "./ai-badge";

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
  hasR2Proof?: boolean;
  aiVerification?: AiVerification | null;
};

type Mode = "untouched" | "claimed" | "verified" | "expired";

export type ProofUploadState = {
  phase: "preparing" | "uploading" | "saving";
  previewUrl: string;
};

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
  onClaimTask,
  onUnclaim,
  onStartBasket,
  onUpload,
  proofUploads,
  onOpenProof,
  onRemoveTask,
}: {
  slate: SlateItem[];
  onClaimTask: (taskId: Id<"tasks">) => void;
  onUnclaim: (completionId: Id<"completions">) => void;
  onStartBasket: (taskId: Id<"tasks">, completionId: Id<"completions">, file: File) => void;
  onUpload: (completionId: Id<"completions">, file: File) => Promise<void>;
  proofUploads: Record<string, ProofUploadState>;
  onOpenProof: (url: string) => void;
  onRemoveTask?: (taskId: Id<"tasks">, name: string) => void;
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
            onClaimTask={onClaimTask}
            onUnclaim={onUnclaim}
            onStartBasket={onStartBasket}
            onUpload={onUpload}
            uploadState={
              task.completionId ? proofUploads[String(task.completionId)] : undefined
            }
            onOpenProof={onOpenProof}
            onRemoveTask={onRemoveTask}
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
  onClaimTask,
  onUnclaim,
  onStartBasket,
  onUpload,
  uploadState,
  onOpenProof,
  onRemoveTask,
}: {
  task: SlateItem;
  mode: Mode;
  now: number;
  onClaimTask: (id: Id<"tasks">) => void;
  onUnclaim: (id: Id<"completions">) => void;
  onStartBasket: (id: Id<"tasks">, completionId: Id<"completions">, file: File) => void;
  onUpload: (id: Id<"completions">, file: File) => Promise<void>;
  uploadState?: ProofUploadState;
  onOpenProof: (url: string) => void;
  onRemoveTask?: (id: Id<"tasks">, name: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const supportsBasket = task.proof === "PHOTO" || task.proof === "SCREENSHOT";

  const onCircle = () => {
    if (uploadState) return;
    if (mode === "untouched" && supportsBasket) {
      onClaimTask(task._id);
    } else if ((mode === "claimed" || mode === "expired") && task.completionId) {
      onUnclaim(task.completionId);
    }
  };

  const onPickFile = () => fileInputRef.current?.click();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && mode === "claimed" && task.completionId && supportsBasket) {
      onStartBasket(task._id, task.completionId, file);
    } else if (file && task.completionId) {
      void onUpload(task.completionId, file);
    }
    e.target.value = "";
  };

  const timeLeftMs =
    task.claimedAt !== null
      ? task.claimedAt + VERIFICATION_WINDOW_MS - now
      : 0;

  const proofLabel = task.proof.toLowerCase();

  return (
    <li className={`slate-row slate-${mode}`}>
      <div className="slate-row-head">
        <button
          className={`task-check ${mode === "verified" ? "verified" : mode === "claimed" ? "claimed" : mode === "expired" ? "expired" : ""}`}
          aria-label={
            mode === "untouched"
              ? supportsBasket
                ? "Claim task"
                : "Video proof unavailable"
              : mode === "claimed"
                ? "Unclaim"
                : mode === "expired"
                  ? "Unclaim expired"
                  : ""
          }
          onClick={onCircle}
          disabled={mode === "verified" || (mode === "untouched" && !supportsBasket) || Boolean(uploadState)}
          aria-busy={uploadState ? true : undefined}
        >
          {mode === "verified" && (
            <svg viewBox="0 0 24 24">
              <path d="M5 12l5 5L20 7" />
            </svg>
          )}
          {mode === "claimed" && <span className="check-dot" />}
          {mode === "expired" && <span className="check-x">&times;</span>}
        </button>

        <div className="slate-row-title">
          <h3 className="slate-name">{task.name}</h3>
          <span className="slate-pts">
            <span className="num">+{task.points}</span>
          </span>
        </div>
      </div>

      <div className="slate-row-meta">
        <span><b>{task.category}</b></span>
        <span className="sep">&middot;</span>
        <span>{task.frequency === "DAILY" ? "Daily" : "Weekly"}</span>
        {mode === "untouched" && (
          <>
            <span className="sep">&middot;</span>
            <span>{proofLabel} proof</span>
          </>
        )}
        {mode === "claimed" && (
          <>
            <span className="sep">&middot;</span>
            <span className={`slate-tag ${uploadState ? "upload-tag" : "claim-tag"}`}>
              {uploadState ? uploadPhaseLabel(uploadState.phase) : `${formatMs(timeLeftMs)} left to verify`}
            </span>
          </>
        )}
        {mode === "verified" && (
          <>
            <span className="sep">&middot;</span>
            <span className="slate-tag verify-tag">Verified</span>
            {task.aiVerification && (
              <span className="slate-ai-slot">
                <AiBadge verification={task.aiVerification} />
              </span>
            )}
          </>
        )}
        {mode === "expired" && (
          <>
            <span className="sep">&middot;</span>
            <span className="slate-tag expired-tag">Claim expired</span>
          </>
        )}
        {onRemoveTask && (
          <button
            className="btn-link btn-link-danger slate-remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveTask(task._id, task.name);
            }}
            aria-label={`Remove ${task.name}`}
          >
            Remove
          </button>
        )}
      </div>

      {mode === "claimed" && (
        <div className={`slate-row-action ${uploadState ? "slate-row-uploading" : ""}`}>
          {uploadState ? (
            <ProofUploadPreview uploadState={uploadState} />
          ) : (
            <button
              className="btn-upload"
              onClick={onPickFile}
              disabled={!supportsBasket}
            >
              {supportsBasket ? `Upload ${proofLabel}` : "Video proof soon"}
            </button>
          )}
        </div>
      )}

      {mode === "verified" && task.proofUrl && (
        <div className="slate-row-action">
          <button
            className="proof-thumb proof-thumb-lg"
            onClick={() => onOpenProof(task.proofUrl!)}
            aria-label="View proof"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={task.proofUrl} alt="" />
          </button>
        </div>
      )}

      {mode === "verified" && !task.proofUrl && uploadState && (
        <div className="slate-row-action slate-row-uploading">
          <ProofUploadPreview uploadState={uploadState} />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={supportsBasket ? "image/*" : "video/*"}
        style={{ display: "none" }}
        onChange={onFile}
      />
    </li>
  );
}

function uploadPhaseLabel(phase: ProofUploadState["phase"]): string {
  if (phase === "preparing") return "Preparing...";
  if (phase === "uploading") return "Uploading...";
  return "Verifying...";
}

function ProofUploadPreview({ uploadState }: { uploadState: ProofUploadState }) {
  return (
    <div className="proof-upload-preview" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={uploadState.previewUrl} alt="" />
      <span className="proof-upload-preview-overlay">
        <span className="media-spinner media-spinner-dark">
          <span className="media-spinner-ring" />
        </span>
      </span>
    </div>
  );
}
