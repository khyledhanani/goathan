import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { serializeVerification } from "./lib/aiVerifyDisplay";

const STORIES_WINDOW_MS = 24 * 60 * 60 * 1000;
const STORIES_PER_GROUP_SCAN = 80;
const STORIES_MAX_ITEMS_PER_USER = 12;

const GRID_DEFAULT_LIMIT = 60;
const GRID_MAX_LIMIT = 120;
const GRID_PER_GROUP_SCAN = 200;

const FEED_DEFAULT_LIMIT = 30;
const FEED_MAX_LIMIT = 60;
const FEED_PER_GROUP_SCAN = 80;

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

export const byCompletionId = query({
  args: { completionId: v.id("completions") },
  handler: async (ctx, { completionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const c = await ctx.db.get(completionId);
    if (!c) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", c.groupId).eq("userId", userId),
      )
      .unique();
    if (!membership) return null;

    const [task, group, author, likes, rawComments, challenges, verification] =
      await Promise.all([
        ctx.db.get(c.taskId),
        ctx.db.get(c.groupId),
        profileFor(ctx, c.userId),
        ctx.db
          .query("likes")
          .withIndex("by_completion", (q) => q.eq("completionId", c._id))
          .collect(),
        ctx.db
          .query("comments")
          .withIndex("by_completion", (q) => q.eq("completionId", c._id))
          .collect(),
        ctx.db
          .query("challenges")
          .withIndex("by_completion", (q) => q.eq("completionId", c._id))
          .collect(),
        ctx.db
          .query("proofVerifications")
          .withIndex("by_completion", (q) => q.eq("completionId", c._id))
          .unique(),
      ]);

    const comments = await Promise.all(
      rawComments.map(async (cm) => {
        const aprofile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", cm.authorUserId))
          .unique();
        return {
          _id: cm._id,
          authorUserId: cm.authorUserId,
          authorName: aprofile?.displayName ?? "Unknown",
          isYou: cm.authorUserId === userId,
          body: cm.body,
          createdAt: cm.createdAt,
        };
      }),
    );
    comments.sort((a, b) => a.createdAt - b.createdAt);

    const proofUrl = c.proofStorageId
      ? await ctx.storage.getUrl(c.proofStorageId)
      : null;

    const REACTIONS: Array<"HEART" | "FIRE" | "EYES"> = [
      "HEART",
      "FIRE",
      "EYES",
    ];
    const reactions = REACTIONS.map((kind) => {
      const matching = likes.filter((l) => (l.kind ?? "HEART") === kind);
      return {
        kind,
        count: matching.length,
        byYou: matching.some((l) => l.userId === userId),
      };
    });

    return {
      completionId: c._id,
      userId: c.userId,
      displayName: author.displayName,
      username: author.username,
      avatarUrl: author.avatarUrl,
      isYou: c.userId === userId,
      groupId: c.groupId,
      groupName: group?.name ?? "(removed group)",
      taskName: task?.name ?? "(removed task)",
      taskCategory: task?.category ?? "MOVE",
      points: c.points,
      verifiedAt: c.verifiedAt ?? c.claimedAt,
      claimedAt: c.claimedAt,
      revokedAt: c.revokedAt ?? null,
      proofUrl,
      reactions,
      challengeCount: challenges.length,
      challengedByYou: challenges.some(
        (ch) => ch.challengerUserId === userId,
      ),
      comments,
      aiVerification: serializeVerification(verification),
    };
  },
});

export const feedAcrossMyGroups = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId)
      return { items: [], lastSeenFeedAt: 0 } as const;

    const take = Math.min(
      Math.max(limit ?? FEED_DEFAULT_LIMIT, 1),
      FEED_MAX_LIMIT,
    );

    const groupIds = await myGroupIds(ctx, userId);
    if (groupIds.length === 0)
      return { items: [], lastSeenFeedAt: 0 } as const;

    const buckets = await Promise.all(
      groupIds.map(async (gid) => {
        const recent = await ctx.db
          .query("completions")
          .withIndex("by_group_recent", (q) => q.eq("groupId", gid))
          .order("desc")
          .take(FEED_PER_GROUP_SCAN);
        return recent.filter(
          (c) => c.verifiedAt !== undefined && c.proofStorageId !== undefined,
        );
      }),
    );

    const merged = buckets
      .flat()
      .sort((a, b) => (b.verifiedAt ?? 0) - (a.verifiedAt ?? 0))
      .slice(0, take);

    const myProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const items = await Promise.all(
      merged.map(async (c) => {
        const [task, group, author, likes, rawComments, challenges, verification] =
          await Promise.all([
            ctx.db.get(c.taskId),
            ctx.db.get(c.groupId),
            profileFor(ctx, c.userId),
            ctx.db
              .query("likes")
              .withIndex("by_completion", (q) => q.eq("completionId", c._id))
              .collect(),
            ctx.db
              .query("comments")
              .withIndex("by_completion", (q) => q.eq("completionId", c._id))
              .collect(),
            ctx.db
              .query("challenges")
              .withIndex("by_completion", (q) => q.eq("completionId", c._id))
              .collect(),
            ctx.db
              .query("proofVerifications")
              .withIndex("by_completion", (q) => q.eq("completionId", c._id))
              .unique(),
          ]);

        const comments = await Promise.all(
          rawComments.map(async (cm) => {
            const aprofile = await ctx.db
              .query("profiles")
              .withIndex("by_user", (q) => q.eq("userId", cm.authorUserId))
              .unique();
            return {
              _id: cm._id,
              authorUserId: cm.authorUserId,
              authorName: aprofile?.displayName ?? "Unknown",
              isYou: cm.authorUserId === userId,
              body: cm.body,
              createdAt: cm.createdAt,
            };
          }),
        );
        comments.sort((a, b) => a.createdAt - b.createdAt);

        const proofUrl = c.proofStorageId
          ? await ctx.storage.getUrl(c.proofStorageId)
          : null;

        const REACTIONS: Array<"HEART" | "FIRE" | "EYES"> = [
          "HEART",
          "FIRE",
          "EYES",
        ];
        const reactions = REACTIONS.map((kind) => {
          const matching = likes.filter((l) => (l.kind ?? "HEART") === kind);
          return {
            kind,
            count: matching.length,
            byYou: matching.some((l) => l.userId === userId),
          };
        });

        return {
          completionId: c._id,
          userId: c.userId,
          displayName: author.displayName,
          username: author.username,
          avatarUrl: author.avatarUrl,
          isYou: c.userId === userId,
          groupId: c.groupId,
          groupName: group?.name ?? "(removed group)",
          taskName: task?.name ?? "(removed task)",
          taskCategory: task?.category ?? "MOVE",
          points: c.points,
          verifiedAt: c.verifiedAt!,
          claimedAt: c.claimedAt,
          revokedAt: c.revokedAt ?? null,
          proofUrl,
          reactions,
          challengeCount: challenges.length,
          challengedByYou: challenges.some(
            (ch) => ch.challengerUserId === userId,
          ),
          comments,
          aiVerification: serializeVerification(verification),
        };
      }),
    );

    return {
      items,
      lastSeenFeedAt: myProfile?.lastSeenFeedAt ?? 0,
    } as const;
  },
});

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
            c.revokedAt === undefined &&
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
            c.proofStorageId !== undefined &&
            c.revokedAt === undefined,
        );
      }),
    );

    const merged = buckets
      .flat()
      .sort((a, b) => (b.verifiedAt ?? 0) - (a.verifiedAt ?? 0))
      .slice(0, take);

    const items = await Promise.all(
      merged.map(async (c) => {
        const [task, group, verification] = await Promise.all([
          ctx.db.get(c.taskId),
          ctx.db.get(c.groupId),
          ctx.db
            .query("proofVerifications")
            .withIndex("by_completion", (q) => q.eq("completionId", c._id))
            .unique(),
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
          aiVerification: serializeVerification(verification),
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
