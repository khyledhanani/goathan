import { mutation, type MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { enqueueNotification, truncate } from "./lib/notify";
import type { Id } from "./_generated/dataModel";

const MAX_LEN = 240;
const MENTION_RE = /(^|[\s([{,.:;!?])@([a-z0-9_.]{2,20})/gi;

function extractMentionUsernames(body: string): string[] {
  const usernames = new Set<string>();
  for (const match of body.matchAll(MENTION_RE)) {
    usernames.add(match[2].toLowerCase());
  }
  return Array.from(usernames);
}

async function resolveGroupMentionUserIds(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  usernames: string[],
): Promise<Id<"users">[]> {
  if (usernames.length === 0) return [];

  const wanted = new Set(usernames);
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();

  const matched: Id<"users">[] = [];
  for (const membership of memberships) {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", membership.userId))
      .unique();
    const username = profile?.username?.toLowerCase();
    if (!username || !wanted.has(username)) continue;
    matched.push(membership.userId);
  }
  return matched;
}

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

    const actor = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const task = await ctx.db.get(completion.taskId);
    const notified = new Set<Id<"users">>();

    // Resolve mentions first so we can give them the "mentioned you" message
    const mentionUserIds = new Set(
      await resolveGroupMentionUserIds(
        ctx,
        completion.groupId,
        extractMentionUsernames(trimmed),
      ),
    );

    // Notify post owner about the comment (if not the commenter themselves)
    if (
      completion.userId !== userId &&
      completion.revokedAt === undefined
    ) {
      const isMentioned = mentionUserIds.has(completion.userId);
      await enqueueNotification(ctx, {
        userId: completion.userId,
        kind: "COMMENT",
        actorUserId: userId,
        groupId: completion.groupId,
        completionId,
        commentId,
        title: actor?.displayName ?? "Someone",
        body: isMentioned
          ? `mentioned you on ${truncate(task?.name ?? "a receipt", 28)}: "${truncate(trimmed, 80)}"`
          : `on your ${truncate(task?.name ?? "receipt", 28)}: "${truncate(trimmed, 80)}"`,
        deepLinkPath: `/r/${completionId}`,
        dedupeKey: isMentioned
          ? `mention:${commentId}:${completion.userId}`
          : `comment:${commentId}`,
      });
      notified.add(completion.userId);
    }

    // Notify other @mentioned users (skip self and already-notified owner)
    for (const mentionedUserId of mentionUserIds) {
      if (mentionedUserId === userId || notified.has(mentionedUserId)) {
        continue;
      }
      await enqueueNotification(ctx, {
        userId: mentionedUserId,
        kind: "COMMENT",
        actorUserId: userId,
        groupId: completion.groupId,
        completionId,
        commentId,
        title: actor?.displayName ?? "Someone",
        body: `mentioned you on ${truncate(task?.name ?? "a receipt", 28)}: "${truncate(trimmed, 80)}"`,
        deepLinkPath: `/r/${completionId}`,
        dedupeKey: `mention:${commentId}:${mentionedUserId}`,
      });
    }

    return { ok: true as const };
  },
});
