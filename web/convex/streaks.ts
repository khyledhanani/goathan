import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { dayKey, previousDayKey } from "./lib/period";

const STREAK_SCAN_WEEKS = 52;

async function collectCompletedDays(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Set<string>> {
  const now = Date.now();
  const scanMs = STREAK_SCAN_WEEKS * 7 * 86_400_000;
  const rows = await ctx.db
    .query("completions")
    .withIndex("by_user_recent", (q) =>
      q.eq("userId", userId).gte("claimedAt", now - scanMs),
    )
    .collect();
  const days = new Set<string>();
  for (const c of rows) {
    if (c.verifiedAt === undefined) continue;
    if (c.revokedAt !== undefined) continue;
    days.add(dayKey(c.claimedAt));
  }
  return days;
}

function computeCurrentStreak(days: Set<string>, todayKey: string): number {
  let cursor: string;
  const yesterday = previousDayKey(todayKey);
  if (days.has(todayKey)) {
    cursor = todayKey;
  } else if (days.has(yesterday)) {
    cursor = yesterday;
  } else {
    return 0;
  }
  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = previousDayKey(cursor);
  }
  return count;
}

function computeLongestStreak(days: Set<string>): number {
  const sorted = Array.from(days).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev !== null && previousDayKey(d) === prev) {
      run++;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = d;
  }
  return longest;
}

export const forUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewerId = await getAuthUserId(ctx);
    if (!viewerId) return null;
    const days = await collectCompletedDays(ctx, userId);
    const today = dayKey(Date.now());
    return {
      current: computeCurrentStreak(days, today),
      longest: computeLongestStreak(days),
      doneToday: days.has(today),
    };
  },
});
