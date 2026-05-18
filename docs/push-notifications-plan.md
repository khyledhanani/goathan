# Push Notifications + In-App Inbox — Engineering Plan

Receipts is a private friend-group fitness accountability app: people claim daily/weekly tasks in a group, upload proof, react/comment/Call Cap on each other's receipts, and compete on a weekly leaderboard. Stack is Next.js 15 (App Router) + React 19 + Convex backend + Convex Auth (Google OAuth) running as an installable PWA.

The product has accumulated social mechanics — multi-reactions, comments, majority-cap revocation, weekly medals, streaks, Perfect Day bonus, invite share links — and none of them reach users while the app is closed. This plan delivers web push notifications, an in-app notifications inbox, and a per-user preferences layer, with careful attention to deduplication, idempotency, and failure modes.

---

## 1. Goals & non-goals

### Goals
- Deliver notifications via Web Push to installed PWAs (iOS 16.4+, Android, desktop).
- Keep an authoritative in-app inbox; push is **best-effort delivery** on top of the inbox.
- Be idempotent at the event level — the same logical event must never produce duplicate notifications, even across retries.
- Be deduplicated at the user level — rapid-fire events should batch (or no-op) rather than spam.
- Respect per-user preferences (which event kinds to enable; eventually quiet hours).
- Prune dead subscriptions automatically.
- Deep-link notification taps to the right surface in the app.

### Non-goals (deferred to later phases)
- Native iOS/Android push via APNs/FCM. Web Push only.
- Server-side localization. English copy only for v1.
- Mention-based notifications (`@user`) — depends on the unbuilt `@-mention` comment feature.
- TZ-aware quiet hours. v1 uses UTC; quiet hours come in Phase 2.
- Cross-device read-state sync beyond what Convex queries already provide reactively.
- Rich notification content (images, action buttons). v1 is title + body + tap-to-open.

---

## 2. Architecture overview

```
┌──────────────────────┐                  ┌──────────────────────────┐
│  Client (PWA)        │ ── subscribe ──► │  Convex mutation         │
│  - perms request     │                  │  pushSubs.upsert         │
│  - service worker    │                  └──────────────────────────┘
└──────────────────────┘                              ▲
       ▲                                              │
       │ web push (encrypted)                         │
       │                                              │
┌──────┴──────────────────────────────────────────────┴──────────────┐
│                       Convex backend                                │
│                                                                     │
│   ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐  │
│   │ Source event │ →  │ enqueueNotif    │ →  │ dispatchPush      │  │
│   │ mutation     │    │ (internal mut)  │    │ (internal action) │  │
│   │ (likes,      │    │ - dedupe        │    │ - load subs       │  │
│   │  comments,   │    │ - insert row    │    │ - web-push fanout │  │
│   │  challenges, │    │ - scheduler     │    │ - prune on 410    │  │
│   │  cron, ...)  │    │   runAfter(0,…) │    │                   │  │
│   └──────────────┘    └─────────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Critical invariant:** the source-event mutation and the `enqueueNotif` step run inside the same Convex mutation transaction. This means notification insertion (the inbox row) is atomic with the underlying event. Push dispatch is a scheduled action so it can do HTTP — it runs *after* the mutation commits, and is decoupled from the user-facing latency.

The inbox is the **source of truth**. Push is best-effort delivery on top. A user who never installs the PWA still has a full inbox of notifications they can read in-app.

---

## 3. Schema design

Four new tables, plus one new field on `profiles`.

### `notifications` — the in-app inbox / source of truth

```ts
notifications: defineTable({
  userId: v.id("users"),                  // recipient
  kind: notificationKindValidator,        // see §4
  actorUserId: v.optional(v.id("users")), // who triggered it (null for system events)
  groupId: v.optional(v.id("groups")),    // context (null for cross-group events)
  completionId: v.optional(v.id("completions")),
  commentId: v.optional(v.id("comments")),
  medalKey: v.optional(v.string()),       // for medal events: "groupId:weekKey"
  title: v.string(),                      // rendered once at create time, frozen
  body: v.string(),
  deepLinkPath: v.string(),               // e.g. "/r/abc123" or "/group/xyz"
  dedupeKey: v.string(),                  // §5
  createdAt: v.number(),
  readAt: v.optional(v.number()),
  pushDispatchStartedAt: v.optional(v.number()),    // claim timestamp; lets stale claims be retried
  pushDispatchCompletedAt: v.optional(v.number()),  // fanout finished (success or otherwise); the real re-entry gate
  pushDeliveredCount: v.optional(v.number()),       // # of subscriptions accepted
  pushFailedCount: v.optional(v.number()),
})
  .index("by_user_recent", ["userId", "createdAt"])
  .index("by_user_unread", ["userId", "readAt"])
  .index("by_user_dedupe", ["userId", "dedupeKey"]);
```

Notes:
- `title` and `body` are rendered server-side at create time so display is stable even if the underlying entity changes (e.g., user renames). This avoids the "ghost-name" problem.
- `dedupeKey` is unique per `(userId, dedupeKey)` and is the basis for idempotency (§5).
- `readAt` distinguishes unread (null) from read.
- `pushDispatchStartedAt` / `pushDispatchCompletedAt` / `pushDeliveredCount` / `pushFailedCount` are operational, not user-facing — useful for debugging. The two timestamps are intentionally distinct: *started* is a soft claim (a crashed mid-fanout claim can be retried after a staleness window), *completed* is the authoritative re-entry gate. Conflating them into a single `pushAttemptedAt` field would mean any transient failure permanently suppresses retry — bad tradeoff for a best-effort delivery channel.

### `pushSubscriptions` — per-device push endpoints

```ts
pushSubscriptions: defineTable({
  userId: v.id("users"),
  endpoint: v.string(),
  p256dh: v.string(),
  auth: v.string(),
  userAgent: v.optional(v.string()),  // debug aid
  createdAt: v.number(),
  lastSeenAt: v.number(),             // refreshed on each app open / subscribe
  failureCount: v.number(),           // consecutive 5xx — pruned at 5
  lastError: v.optional(v.string()),
})
  .index("by_user", ["userId"])
  .index("by_endpoint", ["endpoint"]);
```

Notes:
- `endpoint` is the canonical identifier — `by_endpoint` is used for the upsert path (one device that re-subscribes shouldn't create duplicates).
- A 410 Gone or 404 from the push service means the subscription is dead → delete it.
- A 429 means slow down → backoff with retry, don't delete.
- 5 consecutive 5xx failures → delete (assumes the endpoint is broken).

### `notificationPreferences` — per-user opt-out per event kind

```ts
notificationPreferences: defineTable({
  userId: v.id("users"),
  mutedKinds: v.array(notificationKindValidator),
  pushEnabled: v.boolean(),    // master push toggle (independent of OS permission)
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"]);
```

Notes:
- One row per user; lazily created on first read.
- `pushEnabled` is the app-level master switch. OS permission is separately revocable.
- `mutedKinds` is a deny-list — by default all kinds are enabled.

### `notificationDispatchLog` — optional ops table (Phase 2)

For diagnostics / replay. Skip in v1 if it complicates things.

### `profiles.lastSeenInboxAt` (optional field)

```ts
profiles: defineTable({
  // ...existing fields...
  lastSeenInboxAt: v.optional(v.number()),
})
```

Used to compute the unread badge count efficiently as a complementary signal to `readAt`. Not strictly required — `readAt` alone is sufficient — but useful if we want a "mark all read" UX (single update vs. N updates).

---

## 4. Event taxonomy

Each event kind has a precise definition, recipient rule, dedupe key, and copy template.

| Kind | Trigger | Recipient | Dedupe key | Body (English) | Deep link |
|---|---|---|---|---|---|
| `LIKE` | `likes.toggle` → state `added` | completion owner | `like:{completionId}:{actorUserId}:{kind}` | "Maya reacted 🔥 to your workout receipt" | `/r/{completionId}` |
| `COMMENT` | `comments.add` | completion owner (+ other commenters in Phase 2) | `comment:{commentId}` | "Maya commented: \"go off!\"" (truncate to 120 chars) | `/r/{completionId}` |
| `CAP_CALLED` | `challenges.toggle` → state `added`, **revoked stayed false** | completion owner | `cap_called:{completionId}:{actorUserId}` | "Maya called cap on your workout receipt" | `/r/{completionId}` |
| `CAP_REVOKED` | `challenges.toggle` → revocation transitions `false → true` | completion owner | `cap_revoked:{completionId}:{revokedAt}` | "Your workout receipt was revoked — majority called cap" | `/r/{completionId}` |
| `CAP_RESTORED` | revocation transitions `true → false` | completion owner | `cap_restored:{completionId}:{restoredAt}` | "Points restored — cap fell below majority" | `/r/{completionId}` |
| `MEDAL_AWARDED` | `weekResults.finalizeAllGroupsForPriorWeek` inserts row | the medaled user | `medal:{groupId}:{weekKey}` | "🥇 You took gold in c-SUITE this week — 240 pts" (vary by medal) | `/profile` |
| `MEMBER_JOINED` | `groups.joinByCode` success | all existing group members | `joined:{groupId}:{newUserId}` (per-recipient row) | "Alex joined c-SUITE" | `/group/{groupId}` |
| `DAILY_RESET_REMINDER` | cron at 22:00 UTC, IF user has incomplete daily tasks in any group | the user | `daily_reset:{userId}:{dayKey}` | "2 hours until day resets — 3 tasks left" (conditional streak mention) | `/groups` |

Notes:
- **Self-events are never sent.** Source mutation checks `actorUserId !== recipientUserId` before enqueueing.
- **Revoked completions don't generate LIKE/COMMENT notifications.** If you like/comment on a revoked post, no push goes out (the post is already "dead"). This is enforced in the source mutation before enqueue.
- **`MEMBER_JOINED` fans out to N recipients.** For a group with 6 existing members, the source mutation inserts 6 notification rows (one per recipient), each with its own dedupeKey including the recipient userId is implicit since the table is keyed `(userId, dedupeKey)`. So the dedupe key `joined:{groupId}:{newUserId}` is identical across rows but `(userId, dedupeKey)` tuple is unique — that's the actual idempotency boundary.

### `notificationKindValidator`

```ts
const notificationKindValidator = v.union(
  v.literal("LIKE"),
  v.literal("COMMENT"),
  v.literal("CAP_CALLED"),
  v.literal("CAP_REVOKED"),
  v.literal("CAP_RESTORED"),
  v.literal("MEDAL_AWARDED"),
  v.literal("MEMBER_JOINED"),
  v.literal("DAILY_RESET_REMINDER"),
);
```

---

## 5. Dedupe & idempotency strategy

Two distinct concerns, often conflated:

### Idempotency (event-level)
"The same logical event must never produce a duplicate notification row."

Mechanism: the `(userId, dedupeKey)` tuple is checked at insert time. Implementation:

```ts
async function enqueueNotification(ctx, args) {
  const existing = await ctx.db
    .query("notifications")
    .withIndex("by_user_dedupe", q =>
      q.eq("userId", args.userId).eq("dedupeKey", args.dedupeKey)
    )
    .unique();
  if (existing) return existing._id;  // no-op, idempotent
  return await ctx.db.insert("notifications", { ...args, createdAt: Date.now() });
}
```

The dedupe key encodes the **logical identity** of the event:
- `like:{completionId}:{actorUserId}:{kind}` — Maya hearting Alex's receipt is one event regardless of how many times she taps the toggle.
- `comment:{commentId}` — a single comment is a single event; the commentId is unique.
- `cap_revoked:{completionId}:{revokedAt}` — different revocation episodes for the same completion have different timestamps and are distinct events.

### Deduplication / batching (delivery-level)
"Don't fire 10 push notifications to the same user in 30 seconds."

This is a softer concern than idempotency. The browser/OS already does some collapsing if we use the `tag` field. For v1, we lean on:

1. **Service-worker tag.** Each push payload includes `tag: notificationId`. If a newer push with the same tag arrives, it replaces the older one in the OS notification shade. We don't reuse tags across events.
2. **Throttle in dispatcher.** The `dispatchPush` action will, before sending, count pushes sent to this user in the last 60 seconds. If > 3, batch into a single push with body "3 new updates in Receipts" and a deep link to `/inbox`. Inbox rows still exist individually.

Batching is more complex than v1 needs — we'll skip and revisit if testers report spam.

For **Phase 2 LIKE batching** (multiple actors reacting to same receipt in short window):

```
Phase 1: 3 separate notifications "Maya reacted...", "Alex reacted...", "Sam reacted..."
Phase 2: 1 rolled-up "Maya, Alex and Sam reacted to your workout receipt"
```

Phase 2 dedupeKey would shift to `like_batch:{completionId}:{ownerDayKey}` — the same dedupeKey is reused, and the body is recomputed to include all actors up to the moment of dispatch. Requires `actorUserIds: array` on the notification row.

---

## 6. Push delivery pipeline

### 6.1 Subscribe / unsubscribe

Client flow (in a new `usePushSubscription()` hook):
1. Check `Notification.permission`. If `denied`, surface "enable in settings" — can't programmatically re-prompt.
2. Check `serviceWorker.ready`.
3. Call `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`.
4. Convert returned PushSubscription to `{ endpoint, keys: { p256dh, auth } }`.
5. Call mutation `pushSubscriptions.upsert(args)`.

Convex mutation:

```ts
export const upsert = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string(), userAgent: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", q => q.eq("endpoint", args.endpoint))
      .unique();
    const now = Date.now();
    if (existing) {
      // Same endpoint can belong to a different user if devices changed hands
      await ctx.db.patch(existing._id, {
        userId,
        p256dh: args.p256dh,
        auth: args.auth,
        userAgent: args.userAgent,
        lastSeenAt: now,
        failureCount: 0,
        lastError: undefined,
      });
      return existing._id;
    }
    return await ctx.db.insert("pushSubscriptions", {
      userId,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      userAgent: args.userAgent,
      createdAt: now,
      lastSeenAt: now,
      failureCount: 0,
    });
  },
});
```

Unsubscribe (Convex mutation): delete by endpoint for current user.

### 6.2 Service worker

Add to `public/sw.js`:

```js
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }
  const { title, body, deepLinkPath, notificationId } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: notificationId,
      data: { deepLinkPath, notificationId },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { deepLinkPath } = event.notification.data || {};
  if (!deepLinkPath) return;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) {
        client.postMessage({ type: 'NOTIFICATION_NAV', deepLinkPath });
        return client.focus();
      }
    }
    return self.clients.openWindow(deepLinkPath);
  })());
});
```

The `tag` collapses retried/updated push events with the same notificationId into one OS-shade entry.

A small client-side listener in the React tree handles `NOTIFICATION_NAV` messages (`router.push(deepLinkPath)`).

### 6.3 Dispatch action

```ts
// convex/notifications.ts
"use node";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:ops@receipts.app",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export const dispatchPush = internalAction({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const notif = await ctx.runQuery(internal.notifications.getForDispatch, { notificationId });
    if (!notif) return;                           // deleted between schedule & run
    if (notif.pushAttemptedAt) return;            // already attempted — idempotent guard
    // Mark attempted before fanning out so re-entry is a no-op
    await ctx.runMutation(internal.notifications.markPushAttempted, { notificationId });

    const prefs = await ctx.runQuery(internal.notifications.prefsFor, { userId: notif.userId });
    if (prefs && !prefs.pushEnabled) return;
    if (prefs && prefs.mutedKinds.includes(notif.kind)) return;

    const subs = await ctx.runQuery(internal.notifications.subsFor, { userId: notif.userId });
    let delivered = 0;
    let failed = 0;
    const payload = JSON.stringify({
      title: notif.title,
      body: notif.body,
      deepLinkPath: notif.deepLinkPath,
      notificationId: notif._id,
    });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 * 24 },          // 1 day
        );
        delivered++;
        await ctx.runMutation(internal.notifications.touchSubSuccess, { subId: sub._id });
      } catch (err) {
        failed++;
        const status = (err as any).statusCode;
        if (status === 404 || status === 410) {
          await ctx.runMutation(internal.notifications.deleteSub, { subId: sub._id });
        } else {
          await ctx.runMutation(internal.notifications.touchSubFailure, {
            subId: sub._id,
            error: String(err).slice(0, 200),
          });
        }
      }
    }
    await ctx.runMutation(internal.notifications.recordDispatch, {
      notificationId,
      delivered,
      failed,
    });
  },
});
```

Key safety properties:
- `markPushAttempted` is called **before** any network IO — a re-entry of the action sees `pushAttemptedAt` set and exits.
- Failed sends don't block other subscriptions for the same user.
- 404/410 immediately delete the subscription. Other errors increment `failureCount`; we add a separate sweep cron (Phase 2) to delete subs with `failureCount >= 5`.

### 6.4 Wiring source mutations

Pattern for hooking an event (example: `comments.add`):

```ts
export const add = mutation({
  args: { completionId: v.id("completions"), body: v.string() },
  handler: async (ctx, { completionId, body }) => {
    const userId = await requireAuthUserId(ctx);
    const completion = await ctx.db.get(completionId);
    if (!completion) throw new ConvexError("...");
    // existing membership / validation / insert ...
    const trimmed = body.trim();
    const commentId = await ctx.db.insert("comments", { /* ... */ });

    // notification — only if not a self-comment and post isn't revoked
    if (completion.userId !== userId && completion.revokedAt === undefined) {
      const actor = await getProfile(ctx, userId);
      const task = await ctx.db.get(completion.taskId);
      const preview = trimmed.slice(0, 120);
      await enqueueNotification(ctx, {
        userId: completion.userId,
        kind: "COMMENT",
        actorUserId: userId,
        groupId: completion.groupId,
        completionId,
        commentId,
        title: actor.displayName,
        body: `commented on your ${task?.name ?? "receipt"}: "${preview}"`,
        deepLinkPath: `/r/${completionId}`,
        dedupeKey: `comment:${commentId}`,
      });
    }
    return { ok: true as const };
  },
});
```

The `enqueueNotification` helper handles dedupe + scheduling:

```ts
async function enqueueNotification(ctx: MutationCtx, args: EnqueueArgs): Promise<void> {
  const existing = await ctx.db
    .query("notifications")
    .withIndex("by_user_dedupe", q =>
      q.eq("userId", args.userId).eq("dedupeKey", args.dedupeKey)
    )
    .unique();
  if (existing) return;
  const notificationId = await ctx.db.insert("notifications", {
    ...args,
    createdAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.notifications.dispatchPush, { notificationId });
}
```

The same helper is reused from every source mutation: `likes.toggle`, `comments.add`, `challenges.toggle`, `groups.joinByCode`, `weekResults.finalizeAllGroupsForPriorWeek`.

### 6.5 Cron-driven events

`DAILY_RESET_REMINDER` is the only cron-driven event in v1.

```ts
// convex/crons.ts
crons.cron(
  "daily reset reminder",
  "0 22 * * *",                        // 22:00 UTC daily (2h before reset)
  internal.notifications.fanOutDailyReminders,
  {},
);
```

```ts
export const fanOutDailyReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = dayKey(Date.now());
    const profiles = await ctx.db.query("profiles").collect();
    for (const profile of profiles) {
      if (!profile.onboardingCompleted) continue;
      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_user", q => q.eq("userId", profile.userId))
        .collect();
      if (memberships.length === 0) continue;

      // Compute incomplete daily-task count across all the user's groups
      const stats = await computeIncompleteDailyStats(ctx, profile.userId, memberships, today);
      if (stats.incomplete === 0) continue;

      const streak = await currentStreak(ctx, profile.userId);
      const streakSuffix = streak >= 3 ? ` · 🔥${streak} streak at risk` : "";

      await enqueueNotification(ctx, {
        userId: profile.userId,
        kind: "DAILY_RESET_REMINDER",
        title: "2 hours till reset",
        body: `${stats.incomplete} task${stats.incomplete === 1 ? "" : "s"} left${streakSuffix}`,
        deepLinkPath: "/groups",
        dedupeKey: `daily_reset:${profile.userId}:${today}`,
      });
    }
  },
});
```

Constraints:
- Convex mutations have a per-transaction limit on docs read/written (~4k reads / 1k writes). If user count exceeds that, the cron should self-schedule continuation batches (`scheduler.runAfter(0, fanOutDailyReminders, { cursor })`).
- For our scale (friend groups, <500 users for the foreseeable future), one batch is fine.

---

## 7. In-app inbox

### 7.1 Route + UI
- New route `/inbox`.
- Accessible from a bell icon on the Feed tab's top-bar, with an unread badge.
- Empty state: "Nothing new. Go make some receipts."
- List of notifications, newest first; tap → mark read + navigate to `deepLinkPath`.
- "Mark all read" button at top.
- Pagination: simple `take(50)`; "load more" if results length === 50.

### 7.2 Queries / mutations

```ts
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { items: [], unreadCount: 0 };
    const take = Math.min(Math.max(limit ?? 50, 1), 100);
    const items = await ctx.db
      .query("notifications")
      .withIndex("by_user_recent", q => q.eq("userId", userId))
      .order("desc")
      .take(take);
    // Unread count uses by_user_unread filter where readAt is undefined
    const unread = items.filter(n => n.readAt === undefined).length;
    return { items, unreadCount: unread, hasMore: items.length === take };
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const userId = await requireAuthUserId(ctx);
    const notif = await ctx.db.get(notificationId);
    if (!notif || notif.userId !== userId) return;
    if (notif.readAt !== undefined) return;
    await ctx.db.patch(notificationId, { readAt: Date.now() });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();
    // Batched in chunks if needed
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", q => q.eq("userId", userId).eq("readAt", undefined))
      .take(500);
    for (const n of unread) {
      await ctx.db.patch(n._id, { readAt: now });
    }
    // If more remain, schedule a continuation
    if (unread.length === 500) {
      await ctx.scheduler.runAfter(0, internal.notifications.markAllReadContinue, { userId });
    }
  },
});
```

Note: the `by_user_unread` filter expression `eq("readAt", undefined)` is the Convex idiom for "field not set."

### 7.3 Bell icon component

Bell sits in `page-wrap-bar` on `/dashboard`. Shows nothing if `unreadCount === 0`. Shows a small dot (no number) for ≤9; a numeric badge for higher counts. Tap → `/inbox`.

App badging (Phase 2): call `navigator.setAppBadge(unreadCount)` on the client to surface the count on the home screen icon (iOS 16.4+ / Android / desktop). Stale badge state cleared on `markRead`.

---

## 8. Permission UX

The OS permission prompt is a one-shot ammo round — once denied, it can't be re-prompted programmatically. We protect that ammo with an **in-app pre-prompt**.

### Sequence
1. **First few sessions:** no prompts. Let the user explore.
2. **Trigger conditions for the pre-prompt** (any of these qualify, must also be PWA-installed):
   - User has verified their first completion, OR
   - User has received their first like/comment/cap, OR
   - User has been active 3+ days
3. **Pre-prompt UI** (a small dismissible sheet at the top of the Feed):
   - Title: "Stay in the loop"
   - Copy: "Get a ping when your friends react, comment, or cap your receipts."
   - Buttons: "Enable" / "Maybe later"
4. **"Enable" click:** trigger `Notification.requestPermission()`. On `granted`, subscribe via PushManager and upsert subscription. On `denied`, leave silently and never re-prompt this session.
5. **Dismissal persists** for 30 days in localStorage. After 30 days the conditions may re-evaluate.

### Settings surface
A "Notifications" card on `/profile`:
- Master toggle (OS-level): "Notifications are on / off — manage in browser settings" (informational; we can't programmatically revoke OS permission).
- App-level master: `pushEnabled` toggle (defaults true once subscribed).
- Per-kind toggles for the 8 kinds defined in §4.

Each toggle change writes to `notificationPreferences`. The dispatcher reads prefs before sending.

---

## 9. iOS / PWA specifics

Known iOS Web Push constraints we plan around:
- Only works when the PWA is **installed to home screen**. Subscribing in Safari (tab) silently fails or never offers the permission prompt.
- Permission prompt only fires from a user gesture **inside the installed PWA**.
- App badging works on iOS 16.4+.
- Delivery reliability is OS-managed and not as crisp as native APNs. Pushes may be batched or delayed by minutes if the OS is in battery-saver mode. **This is an inherent platform limitation; we don't fight it.**
- No custom sounds, no notification actions, no expandable images.

Detection logic for "should we even show the pre-prompt":
```ts
const isInstalled =
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as any).standalone === true;
const supportsPush =
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;
const eligible = isInstalled && supportsPush;
```

If not eligible (e.g., user is in Safari tab on iOS), the pre-prompt becomes an "install Receipts to your home screen for notifications" CTA instead. We already have the PWA install path.

---

## 10. Settings & preferences

### Default state for new users
- `pushEnabled: true` (master)
- `mutedKinds: []` (everything on)

### Mute semantics
A muted kind:
1. Still creates an inbox row (the user can see it when they open the app).
2. Skips push dispatch.

This is intentional — the inbox is record-of-truth. If a user mutes "LIKE" notifications, they still want to see who reacted when they open the inbox; they just don't want a ping for every reaction.

### Quiet hours (Phase 2)
Defer to a follow-up. Approach when we get there:
- Per-user `quietStart`/`quietEnd` in minutes-since-UTC-midnight, plus `tzOffsetMinutes`.
- Dispatcher checks: if now (in user TZ) is within quiet window, delay push via `scheduler.runAt(quietEndMs, internal.notifications.dispatchPush, …)` and tag the notification `delayed: true`.
- Inbox row still appears immediately.

---

## 11. Phased rollout

### Phase 1 (this commit)
- Schema: `notifications`, `pushSubscriptions`, `notificationPreferences`.
- `enqueueNotification` helper (used by source mutations).
- Source-mutation hooks for: `LIKE`, `COMMENT`, `CAP_CALLED`, `CAP_REVOKED`, `CAP_RESTORED`, `MEMBER_JOINED`, `MEDAL_AWARDED`.
- `DAILY_RESET_REMINDER` cron at 22:00 UTC.
- `dispatchPush` action with retry/prune logic.
- Service worker `push` + `notificationclick` handlers.
- Client subscribe flow + pre-prompt UX.
- `/inbox` route, bell icon with unread badge.
- Settings card on `/profile`.

### Phase 2 (follow-up commits)
- Like-batching ("Maya, Alex and Sam reacted").
- TZ-aware quiet hours.
- App badging via `navigator.setAppBadge`.
- Subscription failure-sweep cron (delete subs with `failureCount >= 5`).
- `PERFECT_DAY_THREATENED` (29 min before reset, only at N-1 of N).
- Replay/diagnostics inbox for ops.

### Phase 3 (after `@mentions`)
- `MENTION` notification.
- Comment-thread-watcher notifications (you commented on X's post; Y also commented — you get a ping).

---

## 12. Edge cases & failure modes

| Scenario | Behavior |
|---|---|
| Source mutation throws after `enqueueNotification` — does the inbox row roll back? | Yes. Convex mutations are transactional. If the mutation throws, the insert is rolled back; the scheduled `dispatchPush` call is also dropped. |
| `dispatchPush` runs twice for same notificationId (Convex retry) | `pushAttemptedAt` check at top — second invocation is a no-op. |
| User has 3 devices subscribed; one returns 410 | The 410 sub is deleted; the other 2 still get pushed. |
| User toggles cap rapidly: add → remove → add → remove | Source mutation calls `enqueueNotification` only on `state === "added"`, so the first add creates one notification with dedupeKey `cap_called:X:Y`. The second add (after a remove) tries to insert with the same key, dedupes to no-op. The owner sees one notification ever from that actor. |
| User reacts heart + fire + eyes on same receipt | Three notifications (different dedupeKeys), three pushes. Phase 2 will batch. |
| Comment edited later | Comments are immutable in current schema. No edit flow → no stale-content concern. |
| Group renamed after notification sent | Notification body is frozen at create time. No retroactive update. |
| User leaves group with unread notifications referencing that group | Notifications stay. Tap may 404 if the group's deleted. Inbox row gracefully degrades to "(removed)" text. Phase 2: cascade-delete notifications when a group is deleted. |
| Push payload over 4 KB | We construct payloads to be small (title + body + deepLinkPath + notificationId). 4 KB is generous; we won't hit it. |
| Service worker not installed (browser without SW) | Push is silently skipped. Inbox still works. |
| User clears site data → subscription endpoint orphaned on the push service | First send returns 410 → we delete. Self-healing. |
| Two users sharing a device, both signed into the PWA at different times | On sign-in we re-subscribe and call `pushSubscriptions.upsert`. The `by_endpoint` index re-targets the same endpoint to the current user. (The previous user's notifications no longer push to that endpoint.) |
| Convex Auth session expires while subscribed | OS-level push permission persists. Subscription remains valid until endpoint is rotated. Re-sign-in re-upserts. |
| Cron-driven `DAILY_RESET_REMINDER` fires during a deploy / Convex outage | Cron retries per Convex's cron semantics. Idempotency via dedupeKey `daily_reset:{userId}:{dayKey}` ensures no double-send. |

---

## 13. Testing strategy

### Unit-level (Convex functions)
- `enqueueNotification`: returns existing notificationId when dedupeKey collides; doesn't double-insert.
- `dispatchPush` idempotency: a second invocation after `pushAttemptedAt` set is a no-op.
- Subscription upsert by endpoint: re-subscribe doesn't duplicate; user reassignment works.
- Permission preferences honored: muted kind skips push but creates inbox row.

### Integration / manual
- Subscribe on iPhone Safari (PWA installed) → trigger like → push arrives → tap opens to `/r/...`.
- Subscribe on Android Chrome (PWA installed) → trigger comment → push arrives.
- Subscribe on desktop Chrome → trigger cap → push arrives.
- Trigger 5 likes from different users in 10 seconds → 5 inbox rows, 5 pushes (v1). Phase 2: 1 rolled-up.
- Subscribe → uninstall PWA → trigger event → next dispatch returns 410 → sub deleted.
- Open inbox → mark all read → unread count → 0.
- Toggle a kind off in settings → trigger that kind → inbox row created, no push sent.

### Failure-injection
- Stub `webpush.sendNotification` to throw 500 once → verify retry / failureCount increments.
- Stub to throw 410 → verify subscription deleted.

---

## 14. Open questions for review

1. **Should `MEMBER_JOINED` fan out to every member, or only admins?** v1 plans every member (small friend groups). Could become noisy at >15-member groups.
2. **Comment notifications: include other commenters or just the post owner?** v1 is just owner. Phase 2 could include "watchers" (anyone who's already commented). Risk: turns every comment into N pushes for a popular receipt.
3. **`DAILY_RESET_REMINDER` time:** 22:00 UTC is fixed for v1. For a US-East user that's 17:00 (5pm) — fine. For an Asia user that's morning. Is TZ-aware delivery worth Phase 2 priority?
4. **Should we surface a "test notification" button in settings?** Cheap debugging tool, but also clutter.
5. **Inbox retention:** keep all notifications forever? Cap at last 200 per user? v1 plans no cap. Convex storage is cheap; revisit if it grows.
6. **VAPID key rotation:** how do we plan for emergency key rotation? Worst case we have to wipe all subscriptions and re-subscribe; acceptable for v1, document for ops runbook.
7. **Browser fingerprinting via UA string:** is storing `userAgent` on `pushSubscriptions` a privacy concern? It's only visible to the user themselves in settings if we surface it. Acceptable but flag for review.
8. **Should likes from people who don't share any group with the recipient be even possible?** They're not — the cross-group feed only shows receipts in your shared groups, and like-toggling checks membership. So this isn't an attack surface, just a sanity check.

---

## 15. Estimated effort

| Workstream | Estimate |
|---|---|
| Schema + helpers (`enqueueNotification`, validators) | 2h |
| Source-mutation hooks (7 events) | 3h |
| `dispatchPush` action + web-push integration + error handling | 4h |
| Service worker handlers + client-side nav bridge | 2h |
| Subscribe flow + pre-prompt UX + permission states | 3h |
| `/inbox` route + bell icon + queries/mutations | 4h |
| Settings card + per-kind toggles + prefs mutation | 2h |
| Cron + `DAILY_RESET_REMINDER` fan-out | 2h |
| End-to-end testing on iOS + Android + desktop | 3h |
| Cleanup / polish / copy | 2h |
| **Total** | **~27h, ≈3 working days** |

---

## Appendix A — VAPID key generation

```bash
npx web-push generate-vapid-keys
# Outputs:
# Public Key:  BPx...
# Private Key: Aabb...
```

Public key goes into a `NEXT_PUBLIC_VAPID_PUBLIC_KEY` env var (safe to expose).
Private key goes into Convex env: `npx convex env set VAPID_PRIVATE_KEY 'Aabb...'`

## Appendix B — Convex env vars added

| Var | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel env | Client uses it for `pushManager.subscribe` |
| `VAPID_PUBLIC_KEY` | Convex env | Action uses it for `webpush.setVapidDetails` (same value as above) |
| `VAPID_PRIVATE_KEY` | Convex env | Action only |
| `VAPID_SUBJECT` | Convex env | `mailto:ops@receipts.app` or similar — required by spec |
