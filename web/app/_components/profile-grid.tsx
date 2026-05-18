"use client";

import { useState } from "react";
import { AiBadge, type AiVerification } from "./ai-badge";

export type ProfileGridItem = {
  completionId: string;
  taskName: string;
  taskCategory: "MORNING" | "MOVE" | "FUEL" | "MIND" | "REST";
  groupId: string;
  groupName: string;
  points: number;
  verifiedAt: number;
  proofUrl: string | null;
  aiVerification: AiVerification | null;
};

export function ProfileGrid({
  items,
  onOpenProof,
  emptyTitle,
  emptyLine,
}: {
  items: ProfileGridItem[];
  onOpenProof: (url: string) => void;
  emptyTitle?: string;
  emptyLine?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="activity-empty">
        <p className="eyebrow">{emptyTitle ?? "Empty grid"}</p>
        <p className="activity-empty-line">
          {emptyLine ?? "No receipts yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="profile-grid">
      {items.map((it) => (
        <GridTile key={it.completionId} item={it} onOpen={onOpenProof} />
      ))}
    </div>
  );
}

function GridTile({
  item: it,
  onOpen,
}: {
  item: ProfileGridItem;
  onOpen: (url: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      type="button"
      className="profile-grid-tile"
      onClick={() => it.proofUrl && onOpen(it.proofUrl)}
      aria-label={`${it.taskName} in ${it.groupName}, +${it.points}`}
    >
      {it.proofUrl && !loaded && (
        <span className="media-spinner" aria-hidden>
          <span className="media-spinner-ring" />
        </span>
      )}
      {it.proofUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={it.proofUrl}
          alt=""
          className={`profile-grid-img ${loaded ? "is-loaded" : ""}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      )}
      <span className="profile-grid-overlay">
        <span className="profile-grid-task">{it.taskName}</span>
        <span className="profile-grid-meta mono">
          {it.groupName} · +{it.points}
        </span>
      </span>
      {it.aiVerification && (
        <span className="profile-grid-ai">
          <AiBadge verification={it.aiVerification} />
        </span>
      )}
    </button>
  );
}
