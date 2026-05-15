import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
  },
});

export const create = mutation({
  args: { name: v.string(), sessionId: v.string() },
  handler: async (ctx, { name, sessionId }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (existing) {
      if (existing.name !== name) {
        await ctx.db.patch(existing._id, { name });
      }
      return existing._id;
    }
    return await ctx.db.insert("users", {
      name,
      sessionId,
      createdAt: Date.now(),
    });
  },
});
