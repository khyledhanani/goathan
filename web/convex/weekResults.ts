import {
  internalMutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { previousPeriodBounds } from "./lib/period";
import { PERFECT_DAY_BONUS, countPerfectDays } from "./lib/perfectDay";
import { enqueueNotification } from "./lib/notify";

type Medal = "GOLD" | "SILVER" | "BRONZE";
const MEDALS: Medal[] = ["GOLD", "SILVER", "BRONZE"];

async function finalizeOneGroupPeriod(
  ctx: MutationCtx,
  group: Doc<"groups">,
  periodStart: number,
  periodEnd: number,
  periodKey: string,
): Promise<number> {
  const existing = await ctx.db
    .query("weekResults")
    .withIndex("by_group_week", (q) =>
      q.eq("groupId", group._id).eq("weekKey", periodKey),
    )
    .first();
  if (existing) return 0;

  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_group", (q) => q.eq("groupId", group._id))
    .collect();
  const dailyTaskIds = new Set(
    tasks.filter((t) => t.frequency === "DAILY").map((t) => t._id),
  );

  const completions = await ctx.db
    .query("completions")
    .withIndex("by_group_recent", (q) =>
      q
        .eq("groupId", group._id)
        .gte("claimedAt", periodStart)
        .lt("claimedAt", periodEnd),
    )
    .collect();

  const pointsByUser = new Map<Id<"users">, number>();
  const compsByUser = new Map<Id<"users">, Doc<"completions">[]>();
  for (const c of completions) {
    if (!compsByUser.has(c.userId)) compsByUser.set(c.userId, []);
    compsByUser.get(c.userId)!.push(c);
    if (c.verifiedAt === undefined) continue;
    if (c.revokedAt !== undefined) continue;
    pointsByUser.set(
      c.userId,
      (pointsByUser.get(c.userId) ?? 0) + c.points,
    );
  }

  for (const [uid, comps] of compsByUser.entries()) {
    const perfectDays = countPerfectDays(comps, dailyTaskIds);
    if (perfectDays > 0) {
      pointsByUser.set(
        uid,
        (pointsByUser.get(uid) ?? 0) + perfectDays * PERFECT_DAY_BONUS,
      );
    }
  }

  const ranked = Array.from(pointsByUser.entries())
    .filter(([, pts]) => pts > 0)
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) return 0;

  const now = Date.now();
  let inserted = 0;
  for (let i = 0; i < Math.min(3, ranked.length); i++) {
    const [userId, weekPoints] = ranked[i];
    const medal = MEDALS[i];
    await ctx.db.insert("weekResults", {
      groupId: group._id,
      groupName: group.name,
      weekKey: periodKey,
      userId,
      rank: i + 1,
      weekPoints,
      medal,
      weekEndMs: periodEnd,
      finalizedAt: now,
    });
    inserted++;

    const medalEmoji =
      medal === "GOLD" ? "🥇" : medal === "SILVER" ? "🥈" : "🥉";
    const medalLabel =
      medal === "GOLD"
        ? "took gold"
        : medal === "SILVER"
          ? "took silver"
          : "took bronze";
    await enqueueNotification(ctx, {
      userId,
      kind: "MEDAL_AWARDED",
      groupId: group._id,
      medalKey: `${group._id}:${periodKey}`,
      title: `${medalEmoji} You ${medalLabel} in ${group.name}`,
      body: `${weekPoints} pts last period`,
      deepLinkPath: `/profile`,
      dedupeKey: `medal:${group._id}:${periodKey}:${userId}`,
    });
  }
  return inserted;
}

export const finalizeAllGroupsForPriorWeek = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const groups = await ctx.db.query("groups").collect();
    let totalGroups = 0;
    let totalInserted = 0;
    for (const g of groups) {
      const prev = previousPeriodBounds(g, now);
      if (!prev) continue;
      const n = await finalizeOneGroupPeriod(
        ctx,
        g,
        prev.periodStart,
        prev.periodEnd,
        prev.periodKey,
      );
      if (n > 0) {
        totalGroups++;
        totalInserted += n;
      }
    }
    return {
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
