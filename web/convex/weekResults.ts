import {
  internalMutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { weekKey, weekStartMs, weekEndMs } from "./lib/period";

type Medal = "GOLD" | "SILVER" | "BRONZE";
const MEDALS: Medal[] = ["GOLD", "SILVER", "BRONZE"];

async function finalizeOneGroupWeek(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  targetWeekKey: string,
  targetWeekEndMs: number,
): Promise<number> {
  const existing = await ctx.db
    .query("weekResults")
    .withIndex("by_group_week", (q) =>
      q.eq("groupId", groupId).eq("weekKey", targetWeekKey),
    )
    .first();
  if (existing) return 0;

  const group = await ctx.db.get(groupId);
  if (!group) return 0;

  const completions = await ctx.db
    .query("completions")
    .withIndex("by_group_week", (q) =>
      q.eq("groupId", groupId).eq("weekKey", targetWeekKey),
    )
    .collect();

  const pointsByUser = new Map<Id<"users">, number>();
  for (const c of completions) {
    if (c.verifiedAt === undefined) continue;
    if (c.revokedAt !== undefined) continue;
    pointsByUser.set(
      c.userId,
      (pointsByUser.get(c.userId) ?? 0) + c.points,
    );
  }

  const ranked = Array.from(pointsByUser.entries())
    .filter(([, pts]) => pts > 0)
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) return 0;

  const now = Date.now();
  let inserted = 0;
  for (let i = 0; i < Math.min(3, ranked.length); i++) {
    const [userId, weekPoints] = ranked[i];
    await ctx.db.insert("weekResults", {
      groupId,
      groupName: group.name,
      weekKey: targetWeekKey,
      userId,
      rank: i + 1,
      weekPoints,
      medal: MEDALS[i],
      weekEndMs: targetWeekEndMs,
      finalizedAt: now,
    });
    inserted++;
  }
  return inserted;
}

export const finalizeAllGroupsForPriorWeek = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const currentWeekStart = weekStartMs(now);
    const priorWeekRef = currentWeekStart - 1;
    const priorWeekKey = weekKey(priorWeekRef);
    const priorWeekEnd = weekEndMs(priorWeekRef);

    const groups = await ctx.db.query("groups").collect();
    let totalGroups = 0;
    let totalInserted = 0;
    for (const g of groups) {
      const n = await finalizeOneGroupWeek(
        ctx,
        g._id,
        priorWeekKey,
        priorWeekEnd,
      );
      if (n > 0) {
        totalGroups++;
        totalInserted += n;
      }
    }
    return {
      weekKey: priorWeekKey,
      groupsFinalized: totalGroups,
      medalsAwarded: totalInserted,
    };
  },
});

export const trophiesForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: targetUserId }) => {
    const viewerId = await getAuthUserId(ctx);
    if (!viewerId) return null;

    const rows = await ctx.db
      .query("weekResults")
      .withIndex("by_user_end", (q) => q.eq("userId", targetUserId))
      .order("desc")
      .take(60);

    const counts = { gold: 0, silver: 0, bronze: 0 };
    for (const r of rows) {
      if (r.medal === "GOLD") counts.gold++;
      else if (r.medal === "SILVER") counts.silver++;
      else if (r.medal === "BRONZE") counts.bronze++;
    }

    return {
      counts,
      items: rows.map((r) => ({
        _id: r._id,
        weekKey: r.weekKey,
        weekEndMs: r.weekEndMs,
        groupId: r.groupId,
        groupName: r.groupName,
        rank: r.rank,
        weekPoints: r.weekPoints,
        medal: r.medal,
      })),
    };
  },
});
