import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const toggle = mutation({
  args: { completionId: v.id("completions") },
  handler: async (ctx, { completionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const completion = await ctx.db.get(completionId);
    if (!completion) throw new ConvexError("Receipt not found");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", completion.groupId).eq("userId", userId),
      )
      .unique();
    if (!membership) throw new ConvexError("Not a member of this group");

    const existing = await ctx.db
      .query("likes")
      .withIndex("by_completion_and_user", (q) =>
        q.eq("completionId", completionId).eq("userId", userId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { state: "removed" as const };
    }

    await ctx.db.insert("likes", {
      completionId,
      userId,
      groupId: completion.groupId,
      createdAt: Date.now(),
    });
    return { state: "added" as const };
  },
});
