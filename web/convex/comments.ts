import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const MAX_LEN = 240;

export const add = mutation({
  args: { completionId: v.id("completions"), body: v.string() },
  handler: async (ctx, { completionId, body }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const completion = await ctx.db.get(completionId);
    if (!completion) throw new ConvexError("Activity not found");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", completion.groupId).eq("userId", userId),
      )
      .unique();
    if (!membership) throw new ConvexError("Not a member of this group");

    const trimmed = body.trim();
    if (!trimmed) return { ok: false as const, error: "Empty comment" };
    if (trimmed.length > MAX_LEN) {
      return {
        ok: false as const,
        error: `Keep it under ${MAX_LEN} characters`,
      };
    }

    await ctx.db.insert("comments", {
      completionId,
      authorUserId: userId,
      groupId: completion.groupId,
      body: trimmed,
      createdAt: Date.now(),
    });

    return { ok: true as const };
  },
});
