"use client";

import { useEffect, useMemo, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";

type BasketTask = {
  _id: Id<"tasks">;
  groupId: Id<"groups">;
  name: string;
  description: string | null;
  category: "MORNING" | "MOVE" | "FUEL" | "MIND" | "REST";
  points: number;
  frequency: "DAILY" | "WEEKLY";
  proof: "PHOTO" | "SCREENSHOT" | "VIDEO";
};

type BasketGroup = {
  groupId: Id<"groups">;
  groupName: string;
  tasks: BasketTask[];
};

export function ClaimBasketSheet({
  startingTaskId,
  completionId,
  previewUrl,
  options,
  submitting,
  onClose,
  onSubmit,
}: {
  startingTaskId: Id<"tasks">;
  completionId?: Id<"completions">;
  previewUrl: string;
  options: { groups: BasketGroup[] } | undefined;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (taskIds: Id<"tasks">[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set([String(startingTaskId)]),
  );

  useEffect(() => {
    setSelected(new Set([String(startingTaskId)]));
    setQuery("");
  }, [startingTaskId]);

  const availableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of options?.groups ?? []) {
      for (const task of group.tasks) ids.add(String(task._id));
    }
    return ids;
  }, [options]);

  const selectedTaskIds = useMemo(() => {
    const ids: Id<"tasks">[] = [];
    for (const id of selected) {
      if (availableIds.has(id)) ids.push(id as Id<"tasks">);
    }
    return ids;
  }, [availableIds, selected]);

  const selectedGroupCount = useMemo(() => {
    const groups = new Set<string>();
    for (const group of options?.groups ?? []) {
      if (group.tasks.some((task) => selected.has(String(task._id)))) {
        groups.add(String(group.groupId));
      }
    }
    return groups.size;
  }, [options, selected]);
  const visibleGroupCount = options ? selectedGroupCount : 1;

  const totalPoints = useMemo(() => {
    if (!options) return 0;
    let pts = 0;
    for (const group of options.groups) {
      for (const task of group.tasks) {
        if (selected.has(String(task._id))) pts += task.points;
      }
    }
    return pts;
  }, [options, selected]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!options) return [];
    if (!normalizedQuery) return options.groups;
    return options.groups
      .map((group) => {
        const groupMatches = group.groupName
          .toLowerCase()
          .includes(normalizedQuery);
        const tasks = group.tasks.filter(
          (task) =>
            groupMatches ||
            task.name.toLowerCase().includes(normalizedQuery) ||
            task.category.toLowerCase().includes(normalizedQuery),
        );
        return { ...group, tasks };
      })
      .filter((group) => group.tasks.length > 0);
  }, [normalizedQuery, options]);

  const toggle = (taskId: Id<"tasks">) => {
    if (taskId === startingTaskId) return;
    setSelected((current) => {
      const next = new Set(current);
      const key = String(taskId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const requestClose = () => {
    if (!submitting) onClose();
  };

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={requestClose}>
      <section
        className="modal claim-basket"
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-basket-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="claim-basket-head">
          <div>
            <span className="eyebrow">Claim basket</span>
            <h2 id="claim-basket-title" className="modal-title">
              Use this proof<span className="roman">.</span>
            </h2>
          </div>
          <button
            className="claim-basket-close"
            onClick={requestClose}
            aria-label="Close"
            disabled={submitting}
          >
            x
          </button>
        </div>

        <div className="claim-basket-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" />
          <p>
            This photo will be visible in{" "}
            <b>{visibleGroupCount}</b>{" "}
            {visibleGroupCount === 1 ? "group" : "groups"}.
          </p>
        </div>

        <label className="field claim-basket-search">
          <span className="field-label">Search tasks</span>
          <input
            className="field-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gym, steps, protein..."
          />
        </label>

        <div className="claim-basket-list">
          {!options ? (
            <p className="muted-line">Loading tasks...</p>
          ) : filteredGroups.length === 0 ? (
            <p className="muted-line">No matching unclaimed image tasks.</p>
          ) : (
            filteredGroups.map((group) => (
              <section key={group.groupId} className="claim-basket-group">
                <div className="claim-basket-group-title">
                  <span>{group.groupName}</span>
                  <span>{group.tasks.length}</span>
                </div>
                {group.tasks.map((task) => {
                  const checked = selected.has(String(task._id));
                  const locked = task._id === startingTaskId;
                  return (
                    <button
                      key={task._id}
                      className={`claim-basket-task ${checked ? "checked" : ""} ${locked ? "locked" : ""}`}
                      onClick={() => toggle(task._id)}
                      aria-pressed={checked}
                    >
                      <span className="claim-basket-check">
                        {checked && (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M5 12l5 5L20 7" />
                          </svg>
                        )}
                      </span>
                      <span className="claim-basket-task-main">
                        <span className="claim-basket-task-name">{task.name}</span>
                        <span className="claim-basket-task-meta">
                          {task.category} · {task.frequency.toLowerCase()} · {task.proof.toLowerCase()}
                        </span>
                      </span>
                      <span className="claim-basket-points">+{task.points}</span>
                    </button>
                  );
                })}
              </section>
            ))
          )}
        </div>

        <div className="modal-foot">
          <button className="btn-ghost" onClick={requestClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => onSubmit(selectedTaskIds)}
            disabled={submitting || selectedTaskIds.length === 0}
          >
            {submitting
              ? "Submitting..."
              : `Submit ${selectedTaskIds.length} log${selectedTaskIds.length === 1 ? "" : "s"} · +${totalPoints} pts`}
          </button>
        </div>
      </section>
    </div>
  );
}
