"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import webpush from "web-push";

function ensureVapid(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:ops@receipts.app";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

async function sendExpoNotifications(
  ctx: any,
  tokens: Array<{ _id: any; token: string }>,
  payload: { title: string; body: string; data: Record<string, string> },
): Promise<{ delivered: number; failed: number }> {
  if (tokens.length === 0) return { delivered: 0, failed: 0 };

  const messages = tokens.map((t) => ({
    to: t.token,
    sound: "default" as const,
    title: payload.title,
    body: payload.body,
    data: payload.data,
  }));

  let delivered = 0;
  let failed = 0;

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Expo push API error:", response.status, text);
      for (const t of tokens) {
        failed++;
        await ctx.runMutation(internal.notifications.touchExpoTokenFailure, {
          tokenId: t._id,
          error: `HTTP ${response.status}`,
        });
      }
      return { delivered, failed };
    }

    const result = await response.json();
    const tickets = result.data ?? [];

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const token = tokens[i];
      if (!token) continue;

      if (ticket.status === "ok") {
        delivered++;
        await ctx.runMutation(internal.notifications.touchExpoTokenSuccess, {
          tokenId: token._id,
        });
      } else {
        failed++;
        const errorMsg = ticket.message ?? ticket.details?.error ?? "unknown";
        if (
          ticket.details?.error === "DeviceNotRegistered" ||
          ticket.details?.error === "InvalidCredentials"
        ) {
          await ctx.runMutation(internal.notifications.deleteExpoToken, {
            tokenId: token._id,
          });
        } else {
          await ctx.runMutation(internal.notifications.touchExpoTokenFailure, {
            tokenId: token._id,
            error: String(errorMsg).slice(0, 200),
          });
        }
      }
    }
  } catch (err) {
    console.error("Expo push send failed:", err);
    for (const t of tokens) {
      failed++;
      await ctx.runMutation(internal.notifications.touchExpoTokenFailure, {
        tokenId: t._id,
        error: String(err).slice(0, 200),
      });
    }
  }

  return { delivered, failed };
}

export const dispatchPush = internalAction({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const vapidReady = ensureVapid();

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

    let delivered = 0;
    let failed = 0;

    const payload = JSON.stringify({
      title: notif.title,
      body: notif.body,
      deepLinkPath: notif.deepLinkPath,
      notificationId: notif._id,
      kind: notif.kind,
    });

    // ── Web Push (existing) ──────────────────────────────────────────
    if (vapidReady) {
      const subs = await ctx.runQuery(internal.notifications.subsFor, {
        userId: notif.userId,
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
            await ctx.runMutation(internal.notifications.deleteSub, {
              subId: sub._id,
            });
          } else {
            const msg = String(err).slice(0, 200);
            await ctx.runMutation(internal.notifications.touchSubFailure, {
              subId: sub._id,
              error: msg,
            });
          }
        }
      }
    }

    // ── Expo Push (mobile) ───────────────────────────────────────────
    const expoTokens = await ctx.runQuery(
      internal.notifications.expoTokensFor,
      { userId: notif.userId },
    );

    if (expoTokens.length > 0) {
      const expoResult = await sendExpoNotifications(ctx, expoTokens, {
        title: notif.title,
        body: notif.body,
        data: {
          deepLinkPath: notif.deepLinkPath,
          notificationId: notif._id,
          kind: notif.kind,
          // Structured ids so the app can route straight to the group + post
          // (parity with in-app inbox taps).
          groupId: notif.groupId ?? undefined,
          completionId: notif.completionId ?? undefined,
        },
      });
      delivered += expoResult.delivered;
      failed += expoResult.failed;
    }

    await ctx.runMutation(internal.notifications.completeDispatch, {
      notificationId,
      delivered,
      failed,
    });
  },
});
