import { mutation, type MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

async function recomputeRevocation(
  ctx: MutationCtx,
  completionId: Id<"completions">,
): Promise<void> {
  const completion = await ctx.db.get(completionId);
  if (!completion) return;

  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_group", (q) => q.eq("groupId", completion.groupId))
    .collect();
  const nonPosterCount = memberships.filter(
    (m) => m.userId !== completion.userId,
  ).length;

  const caps = await ctx.db
    .query("challenges")
    .withIndex("by_completion", (q) => q.eq("completionId", completionId))
    .collect();
  const capCount = caps.length;

  const threshold = Math.floor(nonPosterCount / 2) + 1;
  const shouldRevoke = nonPosterCount > 0 && capCount >= threshold;

  if (shouldRevoke && completion.revokedAt === undefined) {
    await ctx.db.patch(completionId, { revokedAt: Date.now() });
  } else if (!shouldRevoke && completion.revokedAt !== undefined) {
    await ctx.db.patch(completionId, { revokedAt: undefined });
  }
}

export const toggle = mutation({
  args: { completionId: v.id("completions") },
  handler: async (ctx, { completionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const completion = await ctx.db.get(completionId);
    if (!completion) throw new ConvexError("Completion not found");

    if (completion.userId === userId) {
      throw new ConvexError("Can't call cap on yourself");
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", completion.groupId).eq("userId", userId),
      )
      .unique();
    if (!membership) throw new ConvexError("Not a member of this group");

    const existing = await ctx.db
      .query("challenges")
      .withIndex("by_completion_and_challenger", (q) =>
        q.eq("completionId", completionId).eq("challengerUserId", userId),
      )
      .unique();

    let state: "added" | "removed";
    if (existing) {
      await ctx.db.delete(existing._id);
      state = "removed";
    } else {
      await ctx.db.insert("challenges", {
        completionId,
        challengerUserId: userId,
        groupId: completion.groupId,
        createdAt: Date.now(),
      });
      state = "added";
    }

    await recomputeRevocation(ctx, completionId);

    const refreshed = await ctx.db.get(completionId);
    return {
      state,
      revoked: refreshed?.revokedAt !== undefined,
    };
  },
});
