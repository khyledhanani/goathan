import { internalMutation } from "./_generated/server";
import { enqueueNotification } from "./lib/notify";
import { dayKey, periodKeyFor } from "./lib/period";
import type { Id } from "./_generated/dataModel";

export const fanOutDailyReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const today = dayKey(now);
    const todayStart = new Date(now);
    const todayStartMs = Date.UTC(
      todayStart.getUTCFullYear(),
      todayStart.getUTCMonth(),
      todayStart.getUTCDate(),
    );

    const profiles = await ctx.db
      .query("profiles")
      .collect();

    let enqueued = 0;
    for (const profile of profiles) {
      if (!profile.onboardingCompleted) continue;

      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", profile.userId))
        .collect();
      if (memberships.length === 0) continue;

      const groupIds = memberships.map((m) => m.groupId);

      // Total daily tasks across all groups
      let totalDailyTasks = 0;
      const dailyTaskIdsByGroup = new Map<Id<"groups">, Set<Id<"tasks">>>();
      for (const gid of groupIds) {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_group", (q) => q.eq("groupId", gid))
          .collect();
        const ids = new Set<Id<"tasks">>();
        for (const t of tasks) {
          if (t.frequency === "DAILY") {
            ids.add(t._id);
            totalDailyTasks++;
          }
        }
        dailyTaskIdsByGroup.set(gid, ids);
      }
      if (totalDailyTasks === 0) continue;

      // Verified non-revoked daily completions today, across all groups
      const todayCompletions = await ctx.db
        .query("completions")
        .withIndex("by_user_recent", (q) =>
          q.eq("userId", profile.userId).gte("claimedAt", todayStartMs),
        )
        .collect();
      let doneToday = 0;
      for (const c of todayCompletions) {
        if (c.verifiedAt === undefined) continue;
        if (c.revokedAt !== undefined) continue;
        if (c.periodKey !== periodKeyFor("DAILY", now)) continue;
        const groupDailyIds = dailyTaskIdsByGroup.get(c.groupId);
        if (!groupDailyIds || !groupDailyIds.has(c.taskId)) continue;
        doneToday++;
      }

      const remaining = totalDailyTasks - doneToday;
      if (remaining <= 0) continue;

      await enqueueNotification(ctx, {
        userId: profile.userId,
        kind: "DAILY_RESET_REMINDER",
        title: "2 hours till reset",
        body: `${remaining} task${remaining === 1 ? "" : "s"} left today`,
        deepLinkPath: "/groups",
        dedupeKey: `daily_reset:${profile.userId}:${today}`,
      });
      enqueued++;
    }

    return { enqueued };
  },
});
