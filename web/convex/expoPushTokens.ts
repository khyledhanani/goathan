import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const upsert = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const existing = await ctx.db
      .query("expoPushTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        userId,
        lastSeenAt: now,
        failureCount: 0,
        lastError: undefined,
      });
      return { ok: true as const, id: existing._id };
    }

    const id = await ctx.db.insert("expoPushTokens", {
      userId,
      token,
      createdAt: now,
      lastSeenAt: now,
      failureCount: 0,
    });
    return { ok: true as const, id };
  },
});

export const remove = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const existing = await ctx.db
      .query("expoPushTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!existing) return { ok: true as const };
    if (existing.userId !== userId) return { ok: true as const };

    await ctx.db.delete(existing._id);
    return { ok: true as const };
  },
});
