import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { enqueueNotification, truncate } from "./lib/notify";

export const REACTION_KINDS = ["HEART", "FIRE", "EYES"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

const reactionKindValidator = v.union(
  v.literal("HEART"),
  v.literal("FIRE"),
  v.literal("EYES"),
);

export const toggle = mutation({
  args: {
    completionId: v.id("completions"),
    kind: v.optional(reactionKindValidator),
  },
  handler: async (ctx, { completionId, kind }) => {
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

    const reactionKind: ReactionKind = kind ?? "HEART";

    const existing = await ctx.db
      .query("likes")
      .withIndex("by_completion_and_user", (q) =>
        q.eq("completionId", completionId).eq("userId", userId),
      )
      .collect();
    const mine = existing.find(
      (l) => (l.kind ?? "HEART") === reactionKind,
    );

    if (mine) {
      await ctx.db.delete(mine._id);
      return { state: "removed" as const, kind: reactionKind };
    }

    await ctx.db.insert("likes", {
      completionId,
      userId,
      groupId: completion.groupId,
      kind: reactionKind,
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
      const emoji =
        reactionKind === "HEART"
          ? "❤️"
          : reactionKind === "FIRE"
            ? "🔥"
            : "👀";
      await enqueueNotification(ctx, {
        userId: completion.userId,
        kind: "LIKE",
        actorUserId: userId,
        groupId: completion.groupId,
        completionId,
        title: actor?.displayName ?? "Someone",
        body: `reacted ${emoji} to your ${truncate(task?.name ?? "receipt", 40)}`,
        deepLinkPath: `/r/${completionId}`,
        dedupeKey: `like:${completionId}:${userId}:${reactionKind}`,
      });
    }

    return { state: "added" as const, kind: reactionKind };
  },
});
