import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

export type NotificationKind =
  | "LIKE"
  | "COMMENT"
  | "CAP_CALLED"
  | "CAP_REVOKED"
  | "CAP_RESTORED"
  | "MEDAL_AWARDED"
  | "MEMBER_JOINED"
  | "GROUP_INVITE"
  | "DAILY_RESET_REMINDER"
  | "FIRST_RECEIPT";

export type EnqueueArgs = {
  userId: Id<"users">;
  kind: NotificationKind;
  actorUserId?: Id<"users">;
  groupId?: Id<"groups">;
  completionId?: Id<"completions">;
  commentId?: Id<"comments">;
  medalKey?: string;
  title: string;
  body: string;
  deepLinkPath: string;
  dedupeKey: string;
};

export async function enqueueNotification(
  ctx: MutationCtx,
  args: EnqueueArgs,
): Promise<Id<"notifications"> | null> {
  const existing = await ctx.db
    .query("notifications")
    .withIndex("by_user_dedupe", (q) =>
      q.eq("userId", args.userId).eq("dedupeKey", args.dedupeKey),
    )
    .unique();
  if (existing) return existing._id;

  const notificationId = await ctx.db.insert("notifications", {
    userId: args.userId,
    kind: args.kind,
    actorUserId: args.actorUserId,
    groupId: args.groupId,
    completionId: args.completionId,
    commentId: args.commentId,
    medalKey: args.medalKey,
    title: args.title,
    body: args.body,
    deepLinkPath: args.deepLinkPath,
    dedupeKey: args.dedupeKey,
    createdAt: Date.now(),
  });

  await ctx.scheduler.runAfter(0, internal.notificationsPush.dispatchPush, {
    notificationId,
  });

  return notificationId;
}

/**
 * Notify other group members when a user posts their first verified receipt
 * of the day in a group. Deduped per recipient by actor+group+day.
 */
export async function notifyFirstReceipt(
  ctx: MutationCtx,
  opts: {
    userId: Id<"users">;
    groupId: Id<"groups">;
    dayKey: string;
    /** The triggering receipt — lets the app deep-link to & highlight the post. */
    completionId?: Id<"completions">;
  },
): Promise<void> {
  const { userId, groupId, dayKey: day, completionId } = opts;

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  const group = await ctx.db.get(groupId);
  if (!profile || !group) return;

  const displayName = profile.displayName ?? "Someone";

  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();

  for (const membership of memberships) {
    if (membership.userId === userId) continue;
    await enqueueNotification(ctx, {
      userId: membership.userId,
      kind: "FIRST_RECEIPT",
      actorUserId: userId,
      groupId,
      completionId,
      title: group.name,
      body: `${displayName} just posted their first receipt today`,
      deepLinkPath: completionId ? `/r/${completionId}` : `/group/${groupId}`,
      dedupeKey: `first_receipt:${userId}:${groupId}:${day}:${membership.userId}`,
    });
  }
}

export function truncate(s: string, n: number): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  if (trimmed.length <= n) return trimmed;
  return trimmed.slice(0, n - 1) + "…";
}
