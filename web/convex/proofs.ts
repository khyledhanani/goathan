import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

const STORIES_WINDOW_MS = 24 * 60 * 60 * 1000;
const STORIES_PER_GROUP_SCAN = 80;
const STORIES_MAX_ITEMS_PER_USER = 12;

const GRID_DEFAULT_LIMIT = 60;
const GRID_MAX_LIMIT = 120;
const GRID_PER_GROUP_SCAN = 200;

type ProfileLite = {
  displayName: string;
  username?: string;
  avatarUrl?: string;
};

async function profileFor(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<ProfileLite> {
  const p = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return {
    displayName: p?.displayName ?? "Unknown",
    username: p?.username,
    avatarUrl: p?.avatarUrl,
  };
}

async function myGroupIds(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Id<"groups">[]> {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return memberships.map((m) => m.groupId);
}

export const storiesAcrossMyGroups = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const groupIds = await myGroupIds(ctx, userId);
    if (groupIds.length === 0) return [];

    const cutoff = Date.now() - STORIES_WINDOW_MS;

    const buckets = await Promise.all(
      groupIds.map(async (gid) => {
        const recent = await ctx.db
          .query("completions")
          .withIndex("by_group_recent", (q) => q.eq("groupId", gid))
          .order("desc")
          .take(STORIES_PER_GROUP_SCAN);
        return recent.filter(
          (c) =>
            c.verifiedAt !== undefined &&
            c.proofStorageId !== undefined &&
            (c.verifiedAt ?? 0) >= cutoff,
        );
      }),
    );

    const all = buckets.flat();

    const byUser = new Map<Id<"users">, typeof all>();
    for (const c of all) {
      const list = byUser.get(c.userId) ?? [];
      list.push(c);
      byUser.set(c.userId, list);
    }

    const stories = await Promise.all(
      Array.from(byUser.entries()).map(async ([uid, completions]) => {
        const items = completions
          .sort((a, b) => (b.verifiedAt ?? 0) - (a.verifiedAt ?? 0))
          .slice(0, STORIES_MAX_ITEMS_PER_USER);
        const profile = await profileFor(ctx, uid);
        const hydrated = await Promise.all(
          items.map(async (c) => {
            const [task, group] = await Promise.all([
              ctx.db.get(c.taskId),
              ctx.db.get(c.groupId),
            ]);
            const proofUrl = c.proofStorageId
              ? await ctx.storage.getUrl(c.proofStorageId)
              : null;
            return {
              completionId: c._id,
              taskName: task?.name ?? "(removed task)",
              taskCategory: task?.category ?? "MOVE",
              groupId: c.groupId,
              groupName: group?.name ?? "(removed group)",
              points: c.points,
              verifiedAt: c.verifiedAt!,
              proofUrl,
            };
          }),
        );
        const filtered = hydrated.filter((h) => h.proofUrl !== null);
        const latestAt =
          filtered.length > 0
            ? Math.max(...filtered.map((h) => h.verifiedAt))
            : 0;
        return {
          userId: uid,
          displayName: profile.displayName,
          username: profile.username,
          avatarUrl: profile.avatarUrl,
          isYou: uid === userId,
          latestAt,
          items: filtered,
        };
      }),
    );

    return stories
      .filter((s) => s.items.length > 0)
      .sort((a, b) => {
        if (a.isYou !== b.isYou) return a.isYou ? -1 : 1;
        return b.latestAt - a.latestAt;
      });
  },
});

export const gridForUser = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, { userId: targetUserId, limit }) => {
    const viewerId = await getAuthUserId(ctx);
    if (!viewerId) return null;

    const take = Math.min(
      Math.max(limit ?? GRID_DEFAULT_LIMIT, 1),
      GRID_MAX_LIMIT,
    );

    const viewerGroupIds = new Set(await myGroupIds(ctx, viewerId));

    const targetMemberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .collect();

    const sharedGroups = targetMemberships
      .map((m) => m.groupId)
      .filter((gid) => viewerGroupIds.has(gid));

    if (sharedGroups.length === 0) {
      return {
        profile: await profileFor(ctx, targetUserId),
        items: [] as Array<unknown>,
        sharesAnyGroup: false,
      };
    }

    const buckets = await Promise.all(
      sharedGroups.map(async (gid) => {
        const rows = await ctx.db
          .query("completions")
          .withIndex("by_group_recent", (q) => q.eq("groupId", gid))
          .order("desc")
          .take(GRID_PER_GROUP_SCAN);
        return rows.filter(
          (c) =>
            c.userId === targetUserId &&
            c.verifiedAt !== undefined &&
            c.proofStorageId !== undefined,
        );
      }),
    );

    const merged = buckets
      .flat()
      .sort((a, b) => (b.verifiedAt ?? 0) - (a.verifiedAt ?? 0))
      .slice(0, take);

    const items = await Promise.all(
      merged.map(async (c) => {
        const [task, group] = await Promise.all([
          ctx.db.get(c.taskId),
          ctx.db.get(c.groupId),
        ]);
        const proofUrl = c.proofStorageId
          ? await ctx.storage.getUrl(c.proofStorageId)
          : null;
        return {
          completionId: c._id,
          taskName: task?.name ?? "(removed task)",
          taskCategory: task?.category ?? "MOVE",
          groupId: c.groupId,
          groupName: group?.name ?? "(removed group)",
          points: c.points,
          verifiedAt: c.verifiedAt!,
          proofUrl,
        };
      }),
    );

    return {
      profile: await profileFor(ctx, targetUserId),
      items: items.filter((i) => i.proofUrl !== null),
      sharesAnyGroup: true,
    };
  },
});
