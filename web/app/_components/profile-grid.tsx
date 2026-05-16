"use client";

export type ProfileGridItem = {
  completionId: string;
  taskName: string;
  taskCategory: "MORNING" | "MOVE" | "FUEL" | "MIND" | "REST";
  groupId: string;
  groupName: string;
  points: number;
  verifiedAt: number;
  proofUrl: string | null;
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
        <button
          key={it.completionId}
          type="button"
          className="profile-grid-tile"
          onClick={() => it.proofUrl && onOpenProof(it.proofUrl)}
          aria-label={`${it.taskName} in ${it.groupName}, +${it.points}`}
        >
          {it.proofUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={it.proofUrl}
              alt=""
              className="profile-grid-img"
              loading="lazy"
            />
          )}
          <span className="profile-grid-overlay">
            <span className="profile-grid-task">{it.taskName}</span>
            <span className="profile-grid-meta mono">
              {it.groupName} · +{it.points}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
