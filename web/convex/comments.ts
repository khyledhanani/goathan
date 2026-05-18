import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { enqueueNotification, truncate } from "./lib/notify";

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

    const commentId = await ctx.db.insert("comments", {
      completionId,
      authorUserId: userId,
      groupId: completion.groupId,
      body: trimmed,
      createdAt: Date.now(),
    });

    if (
      completion.userId !== userId &&
      completion.revokedAt === undefined
    ) {
      const actor = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      const task = await ctx.db.get(completion.taskId);
      await enqueueNotification(ctx, {
        userId: completion.userId,
        kind: "COMMENT",
        actorUserId: userId,
        groupId: completion.groupId,
        completionId,
        commentId,
        title: actor?.displayName ?? "Someone",
        body: `on your ${truncate(task?.name ?? "receipt", 28)}: "${truncate(trimmed, 80)}"`,
        deepLinkPath: `/r/${completionId}`,
        dedupeKey: `comment:${commentId}`,
      });
    }

    return { ok: true as const };
  },
});
