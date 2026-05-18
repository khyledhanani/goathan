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
  | "DAILY_RESET_REMINDER";

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

export function truncate(s: string, n: number): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  if (trimmed.length <= n) return trimmed;
  return trimmed.slice(0, n - 1) + "…";
}
