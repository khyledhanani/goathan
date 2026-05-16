import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { periodKeyFor, weekKey } from "./lib/period";

export const toggle = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const task = await ctx.db.get(taskId);
    if (!task) throw new ConvexError("Task not found");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", task.groupId).eq("userId", userId),
      )
      .unique();
    if (!membership) throw new ConvexError("Not a member of this group");

    const now = Date.now();
    const pk = periodKeyFor(task.frequency, now);

    const existing = await ctx.db
      .query("completions")
      .withIndex("by_user_task_period", (q) =>
        q.eq("userId", userId).eq("taskId", taskId).eq("periodKey", pk),
      )
      .unique();

    if (existing) {
      const linkedChallenges = await ctx.db
        .query("challenges")
        .withIndex("by_completion", (q) => q.eq("completionId", existing._id))
        .collect();
      for (const ch of linkedChallenges) {
        await ctx.db.delete(ch._id);
      }
      const linkedComments = await ctx.db
        .query("comments")
        .withIndex("by_completion", (q) => q.eq("completionId", existing._id))
        .collect();
      for (const cm of linkedComments) {
        await ctx.db.delete(cm._id);
      }
      await ctx.db.delete(existing._id);
      return { state: "removed" as const };
    }

    await ctx.db.insert("completions", {
      taskId,
      userId,
      groupId: task.groupId,
      periodKey: pk,
      weekKey: weekKey(now),
      points: task.points,
      completedAt: now,
    });

    return { state: "added" as const };
  },
});
