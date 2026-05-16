import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

const CATEGORY = v.union(
  v.literal("MORNING"),
  v.literal("MOVE"),
  v.literal("FUEL"),
  v.literal("MIND"),
  v.literal("REST"),
);
const FREQUENCY = v.union(v.literal("DAILY"), v.literal("WEEKLY"));
const PROOF = v.union(
  v.literal("PHOTO"),
  v.literal("SCREENSHOT"),
  v.literal("VIDEO"),
);

async function requireMembership(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">,
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Not authenticated");
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_group_and_user", (q) =>
      q.eq("groupId", groupId).eq("userId", userId),
    )
    .unique();
  if (!membership) throw new ConvexError("Not a member of this group");
  return { userId, membership };
}

export const list = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireMembership(ctx, groupId);
    return await ctx.db
      .query("tasks")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
  },
});

export const create = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.string(),
    description: v.optional(v.string()),
    category: CATEGORY,
    points: v.number(),
    frequency: FREQUENCY,
    proof: PROOF,
  },
  handler: async (ctx, args) => {
    const { userId, membership } = await requireMembership(ctx, args.groupId);
    if (!membership.isAdmin) {
      return { ok: false as const, error: "Only admins can add tasks" };
    }

    const name = args.name.trim();
    if (!name) return { ok: false as const, error: "Task name is required" };
    if (name.length > 60) return { ok: false as const, error: "Task name is too long" };

    const points = Math.floor(args.points);
    if (!Number.isFinite(points) || points < 1) {
      return { ok: false as const, error: "Points must be at least 1" };
    }
    if (points > 200) {
      return { ok: false as const, error: "Points must be 200 or less" };
    }

    const description = args.description?.trim() || undefined;

    const taskId = await ctx.db.insert("tasks", {
      groupId: args.groupId,
      name,
      description,
      category: args.category,
      points,
      frequency: args.frequency,
      proof: args.proof,
      createdByUserId: userId,
      createdAt: Date.now(),
    });

    return { ok: true as const, taskId };
  },
});

export const remove = mutation({
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
    if (!membership || !membership.isAdmin) {
      return { ok: false as const, error: "Only admins can remove tasks" };
    }

    const allInGroup = await ctx.db
      .query("completions")
      .withIndex("by_group_recent", (q) => q.eq("groupId", task.groupId))
      .collect();
    const taskCompletions = allInGroup.filter((c) => c.taskId === taskId);

    for (const c of taskCompletions) {
      const challenges = await ctx.db
        .query("challenges")
        .withIndex("by_completion", (q) => q.eq("completionId", c._id))
        .collect();
      for (const ch of challenges) await ctx.db.delete(ch._id);

      const comments = await ctx.db
        .query("comments")
        .withIndex("by_completion", (q) => q.eq("completionId", c._id))
        .collect();
      for (const cm of comments) await ctx.db.delete(cm._id);

      if (c.proofStorageId) await ctx.storage.delete(c.proofStorageId);
      await ctx.db.delete(c._id);
    }

    await ctx.db.delete(taskId);

    return { ok: true as const, removedCompletions: taskCompletions.length };
  },
});
