"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createLogger } from "./lib/logger";
import webpush from "web-push";

const logger = createLogger("convex.notificationsPush");

function ensureVapid(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:ops@receipts.app";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

export const dispatchPush = internalAction({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    if (!ensureVapid()) {
      logger.warn("push_dispatch_skipped_missing_vapid", { notificationId });
      return;
    }

    const notif = await ctx.runQuery(internal.notifications.getForDispatch, {
      notificationId,
    });
    if (!notif) return;
    if (notif.pushDispatchCompletedAt) return;

    const claim = await ctx.runMutation(internal.notifications.claimDispatch, {
      notificationId,
    });
    if (!claim.ok) return;

    const prefs = await ctx.runQuery(internal.notifications.prefsFor, {
      userId: notif.userId,
    });
    if (prefs && !prefs.pushEnabled) {
      await ctx.runMutation(internal.notifications.completeDispatch, {
        notificationId,
        delivered: 0,
        failed: 0,
      });
      return;
    }
    if (prefs && prefs.mutedKinds.includes(notif.kind)) {
      await ctx.runMutation(internal.notifications.completeDispatch, {
        notificationId,
        delivered: 0,
        failed: 0,
      });
      return;
    }

    const subs = await ctx.runQuery(internal.notifications.subsFor, {
      userId: notif.userId,
    });

    let delivered = 0;
    let failed = 0;

    const payload = JSON.stringify({
      title: notif.title,
      body: notif.body,
      deepLinkPath: notif.deepLinkPath,
      notificationId: notif._id,
      kind: notif.kind,
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 * 60 * 24 },
        );
        delivered++;
        await ctx.runMutation(internal.notifications.touchSubSuccess, {
          subId: sub._id,
        });
      } catch (err: unknown) {
        failed++;
        const status =
          typeof err === "object" && err !== null && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        if (status === 404 || status === 410) {
          logger.warn("push_subscription_expired", {
            notificationId,
            subId: sub._id,
            status,
          });
          await ctx.runMutation(internal.notifications.deleteSub, {
            subId: sub._id,
          });
        } else {
          const msg = String(err).slice(0, 200);
          logger.warn("push_dispatch_failed", {
            notificationId,
            subId: sub._id,
            status,
            error: err instanceof Error ? err : msg,
          });
          await ctx.runMutation(internal.notifications.touchSubFailure, {
            subId: sub._id,
            error: msg,
          });
        }
      }
    }

    await ctx.runMutation(internal.notifications.completeDispatch, {
      notificationId,
      delivered,
      failed,
    });
    logger.info("push_dispatch_completed", { notificationId, delivered, failed });
  },
});
