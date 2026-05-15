import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { periodKey, weekKey } from "./lib/period";

export const toggle = mutation({
  args: {
    taskId: v.id("tasks"),
    userId: v.id("users"),
  },
  handler: async (ctx, { taskId, userId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_group_user", (q) =>
        q.eq("groupId", task.groupId).eq("userId", userId),
      )
      .unique();
    if (!membership) throw new Error("Not a member of this group");

    const now = Date.now();
    const pk = periodKey(task.frequency, now);

    const existing = await ctx.db
      .query("completions")
      .withIndex("by_user_task_period", (q) =>
        q.eq("userId", userId).eq("taskId", taskId).eq("periodKey", pk),
      )
      .unique();

    if (existing) {
      const challenges = await ctx.db
        .query("challenges")
        .withIndex("by_completion", (q) => q.eq("completionId", existing._id))
        .collect();
      for (const c of challenges) await ctx.db.delete(c._id);
      await ctx.db.delete(existing._id);
      return { state: "removed" as const };
    }

    await ctx.db.insert("completions", {
      taskId,
      userId,
      groupId: task.groupId,
      points: task.points,
      periodKey: pk,
      weekKey: weekKey(now),
      completedAt: now,
    });
    return { state: "added" as const };
  },
});
