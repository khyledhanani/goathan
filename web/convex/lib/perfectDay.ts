import type { Doc, Id } from "../_generated/dataModel";

export const PERFECT_DAY_BONUS = 25;

export function countPerfectDays(
  completions: Doc<"completions">[],
  dailyTaskIds: Set<Id<"tasks">>,
): number {
  if (dailyTaskIds.size === 0) return 0;

  const byDay = new Map<string, Set<Id<"tasks">>>();
  for (const c of completions) {
    if (c.verifiedAt === undefined) continue;
    if (c.revokedAt !== undefined) continue;
    if (!dailyTaskIds.has(c.taskId)) continue;
    const set = byDay.get(c.periodKey);
    if (set) {
      set.add(c.taskId);
    } else {
      byDay.set(c.periodKey, new Set([c.taskId]));
    }
  }

  let count = 0;
  for (const taskSet of byDay.values()) {
    if (taskSet.size >= dailyTaskIds.size) count++;
  }
  return count;
}
