import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ════════════════════════════════════════════════════════════════════════
// Aggregates each group's pending (un-claimed, image) tasks into baskets for
// the add-receipt sheets. claimBasketOptions requires a seed task, so instead
// we read groups.todayView per group via tiny loader components (keeps the
// hook count stable — one useQuery per mounted loader, not a dynamic loop).
// ════════════════════════════════════════════════════════════════════════

export interface GroupRef {
  _id: Id<"groups">;
  name: string;
}
export interface PendingTask {
  _id: Id<"tasks">;
  name: string;
  category: string;
  points: number;
}
export interface PendingBasket {
  groupId: Id<"groups">;
  groupName: string;
  tasks: PendingTask[];
}

interface RawSlot {
  _id: Id<"tasks">;
  name: string;
  category: string;
  points: number;
  proof: string;
  claimedThisPeriod: boolean;
}

function SlateLoader({
  groupId,
  onResult,
}: {
  groupId: Id<"groups">;
  onResult: (groupId: Id<"groups">, tasks: PendingTask[] | undefined) => void;
}) {
  const today = useQuery(api.groups.todayView, { groupId });
  useEffect(() => {
    if (today === undefined) {
      onResult(groupId, undefined); // still loading
      return;
    }
    const slate = (today?.slate ?? []) as RawSlot[];
    const tasks = slate
      .filter((s) => !s.claimedThisPeriod && s.proof !== "VIDEO")
      .map((s) => ({ _id: s._id, name: s.name, category: s.category, points: s.points }));
    onResult(groupId, tasks);
  }, [today, groupId, onResult]);
  return null;
}

export function usePendingBaskets(
  groups: GroupRef[],
  active: boolean,
): { baskets: PendingBasket[]; loaders: ReactNode; loading: boolean } {
  const [map, setMap] = useState<Record<string, PendingTask[] | undefined>>({});

  const onResult = useCallback(
    (groupId: Id<"groups">, tasks: PendingTask[] | undefined) => {
      setMap((prev) => {
        const prevTasks = prev[groupId];
        // shallow-equal guard to avoid render loops
        if (tasks === undefined && prevTasks === undefined && groupId in prev) return prev;
        if (
          prevTasks &&
          tasks &&
          prevTasks.length === tasks.length &&
          prevTasks.every((t, i) => t._id === tasks[i]._id)
        ) {
          return prev;
        }
        return { ...prev, [groupId]: tasks };
      });
    },
    [],
  );

  const loaders = active
    ? groups.map((g) => <SlateLoader key={g._id} groupId={g._id} onResult={onResult} />)
    : null;

  const baskets: PendingBasket[] = active
    ? groups
        .map((g) => ({ groupId: g._id, groupName: g.name, tasks: map[g._id] ?? [] }))
        .filter((b) => b.tasks.length > 0)
    : [];

  const loading = active && groups.some((g) => map[g._id] === undefined);

  return { baskets, loaders, loading };
}
