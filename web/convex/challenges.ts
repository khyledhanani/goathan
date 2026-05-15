import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const toggle = mutation({
  args: {
    completionId: v.id("completions"),
    userId: v.id("users"),
  },
  handler: async (ctx, { completionId, userId }) => {
    const completion = await ctx.db.get(completionId);
    if (!completion) throw new Error("Completion not found");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_group_user", (q) =>
        q.eq("groupId", completion.groupId).eq("userId", userId),
      )
      .unique();
    if (!membership) throw new Error("Not a member of this group");

    const existing = await ctx.db
      .query("challenges")
      .withIndex("by_completion", (q) => q.eq("completionId", completionId))
      .filter((q) => q.eq(q.field("challengerUserId"), userId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { state: "removed" as const };
    }

    await ctx.db.insert("challenges", {
      completionId,
      challengerUserId: userId,
      groupId: completion.groupId,
      createdAt: Date.now(),
    });
    return { state: "added" as const };
  },
});
