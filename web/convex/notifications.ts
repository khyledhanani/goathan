import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const INBOX_DEFAULT_LIMIT = 50;
const INBOX_MAX_LIMIT = 100;

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId)
      return { items: [], unreadCount: 0, hasMore: false } as const;

    const take = Math.min(
      Math.max(limit ?? INBOX_DEFAULT_LIMIT, 1),
      INBOX_MAX_LIMIT,
    );
    const items = await ctx.db
      .query("notifications")
      .withIndex("by_user_recent", (q) => q.eq("userId", userId))
      .order("desc")
      .take(take);

    const unreadCount = items.filter((n) => n.readAt === undefined).length;

    return {
      items: items.map((n) => ({
        _id: n._id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        deepLinkPath: n.deepLinkPath,
        createdAt: n.createdAt,
        readAt: n.readAt ?? null,
        groupId: n.groupId ?? null,
        completionId: n.completionId ?? null,
      })),
      unreadCount,
      hasMore: items.length === take,
    } as const;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", userId).eq("readAt", undefined),
      )
      .take(50);
    if (unread.length < 50) return unread.length;
    return 50;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");
    const notif = await ctx.db.get(notificationId);
    if (!notif || notif.userId !== userId) return { ok: true as const };
    if (notif.readAt !== undefined) return { ok: true as const };
    await ctx.db.patch(notificationId, { readAt: Date.now() });
    return { ok: true as const };
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");
    const now = Date.now();
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", userId).eq("readAt", undefined),
      )
      .take(500);
    for (const n of unread) {
      await ctx.db.patch(n._id, { readAt: now });
    }
    return { ok: true as const, marked: unread.length };
  },
});

// ---- Internal helpers used by the Node-runtime dispatch action ----

const STALE_CLAIM_MS = 30_000;

export const getForDispatch = internalQuery({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    return await ctx.db.get(notificationId);
  },
});

export const claimDispatch = internalMutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const notif = await ctx.db.get(notificationId);
    if (!notif) return { ok: false as const, reason: "missing" } as const;
    if (notif.pushDispatchCompletedAt !== undefined)
      return { ok: false as const, reason: "completed" } as const;
    if (
      notif.pushDispatchStartedAt !== undefined &&
      Date.now() - notif.pushDispatchStartedAt < STALE_CLAIM_MS
    ) {
      return { ok: false as const, reason: "in_flight" } as const;
    }
    await ctx.db.patch(notificationId, {
      pushDispatchStartedAt: Date.now(),
    });
    return { ok: true as const };
  },
});

export const completeDispatch = internalMutation({
  args: {
    notificationId: v.id("notifications"),
    delivered: v.number(),
    failed: v.number(),
  },
  handler: async (ctx, { notificationId, delivered, failed }) => {
    await ctx.db.patch(notificationId, {
      pushDispatchCompletedAt: Date.now(),
      pushDeliveredCount: delivered,
      pushFailedCount: failed,
    });
  },
});

export const prefsFor = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const subsFor = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const deleteSub = internalMutation({
  args: { subId: v.id("pushSubscriptions") },
  handler: async (ctx, { subId }) => {
    const sub = await ctx.db.get(subId);
    if (sub) await ctx.db.delete(subId);
  },
});

export const touchSubSuccess = internalMutation({
  args: { subId: v.id("pushSubscriptions") },
  handler: async (ctx, { subId }) => {
    const sub = await ctx.db.get(subId);
    if (!sub) return;
    await ctx.db.patch(subId, {
      failureCount: 0,
      lastError: undefined,
      lastSeenAt: Date.now(),
    });
  },
});

export const touchSubFailure = internalMutation({
  args: { subId: v.id("pushSubscriptions"), error: v.string() },
  handler: async (ctx, { subId, error }) => {
    const sub = await ctx.db.get(subId);
    if (!sub) return;
    const next = sub.failureCount + 1;
    if (next >= 5) {
      await ctx.db.delete(subId);
      return;
    }
    await ctx.db.patch(subId, {
      failureCount: next,
      lastError: error,
    });
  },
});
