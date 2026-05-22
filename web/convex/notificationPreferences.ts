import { mutation, query, type MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";

const NOTIFICATION_KINDS = [
  "LIKE",
  "COMMENT",
  "CAP_CALLED",
  "CAP_REVOKED",
  "CAP_RESTORED",
  "MEDAL_AWARDED",
  "MEMBER_JOINED",
  "GROUP_INVITE",
  "DAILY_RESET_REMINDER",
] as const;

async function ensurePrefs(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"notificationPreferences">> {
  const existing = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (existing) return existing;
  const now = Date.now();
  const id = await ctx.db.insert("notificationPreferences", {
    userId,
    mutedKinds: [],
    pushEnabled: true,
    createdAt: now,
    updatedAt: now,
  });
  return (await ctx.db.get(id))!;
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return {
      pushEnabled: existing?.pushEnabled ?? true,
      mutedKinds: existing?.mutedKinds ?? [],
      allKinds: NOTIFICATION_KINDS,
    };
  },
});

export const setPushEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");
    const prefs = await ensurePrefs(ctx, userId);
    await ctx.db.patch(prefs._id, {
      pushEnabled: enabled,
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});

export const setKindMuted = mutation({
  args: { kind: v.string(), muted: v.boolean() },
  handler: async (ctx, { kind, muted }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");
    const prefs = await ensurePrefs(ctx, userId);
    const next = muted
      ? Array.from(new Set([...prefs.mutedKinds, kind]))
      : prefs.mutedKinds.filter((k) => k !== kind);
    await ctx.db.patch(prefs._id, {
      mutedKinds: next,
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});
