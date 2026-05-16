import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { dayKey, weekKey, periodKeyFor } from "./lib/period";

const DEFAULT_TASKS = [
  { name: "Gym check-in",     category: "GYM" as const,       points: 25, frequency: "DAILY" as const, proof: "PHOTO" as const,      description: "Scan in at the gym." },
  { name: "10k steps",        category: "CARDIO" as const,    points: 15, frequency: "DAILY" as const, proof: "SCREENSHOT" as const, description: "Hit 10,000 steps before midnight." },
  { name: "Protein 1g per lb", category: "NUTRITION" as const, points: 20, frequency: "DAILY" as const, proof: "SCREENSHOT" as const, description: "Hit your protein target." },
  { name: "Workout logged",   category: "GYM" as const,       points: 20, frequency: "DAILY" as const, proof: "SCREENSHOT" as const, description: "Log a full session in your tracker." },
  { name: "Seven hours sleep", category: "RECOVERY" as const,  points: 10, frequency: "DAILY" as const, proof: "MANUAL" as const,     description: "Seven hours minimum." },
];

async function seedDefaultTasks(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  userId: Id<"users">,
) {
  const now = Date.now();
  for (const t of DEFAULT_TASKS) {
    await ctx.db.insert("tasks", {
      groupId,
      name: t.name,
      description: t.description,
      category: t.category,
      points: t.points,
      frequency: t.frequency,
      proof: t.proof,
      createdByUserId: userId,
      createdAt: now,
    });
  }
}

const CODE_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN = 6;

function generateCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LEN; i++) {
    s += CODE_ALPHA[Math.floor(Math.random() * CODE_ALPHA.length)];
  }
  return s;
}

async function requireAuthUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Not authenticated");
  return userId;
}

async function requireOnboardedProfile(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"profiles">> {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) throw new ConvexError("Profile not found");
  if (!profile.onboardingCompleted) throw new ConvexError("Finish onboarding first");
  return profile;
}

async function findFreshInviteCode(ctx: MutationCtx): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateCode();
    const taken = await ctx.db
      .query("groups")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", code))
      .unique();
    if (!taken) return code;
  }
  throw new ConvexError("Could not generate an invite code, try again");
}

export const getMyGroups = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const out = await Promise.all(
      memberships.map(async (m) => {
        const group = await ctx.db.get(m.groupId);
        if (!group) return null;
        return {
          _id: group._id,
          name: group.name,
          inviteCode: group.inviteCode,
          createdAt: group.createdAt,
          isAdmin: m.isAdmin,
          joinedAt: m.joinedAt,
        };
      }),
    );

    return out
      .filter((g): g is NonNullable<typeof g> => g !== null)
      .sort((a, b) => b.joinedAt - a.joinedAt);
  },
});

export const todayView = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", groupId).eq("userId", userId),
      )
      .unique();
    if (!membership) return null;

    const group = await ctx.db.get(groupId);
    if (!group) return null;

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();

    const now = Date.now();
    const todayKey = dayKey(now);
    const wk = weekKey(now);

    const myWeekCompletions = await ctx.db
      .query("completions")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", userId).eq("weekKey", wk),
      )
      .collect();

    const completedByTask = new Map<
      string,
      { completionId: Id<"completions">; periodKey: string }
    >();
    for (const c of myWeekCompletions) {
      completedByTask.set(c.taskId, {
        completionId: c._id,
        periodKey: c.periodKey,
      });
    }

    const slate = tasks
      .map((t) => {
        const expectedKey = periodKeyFor(t.frequency, now);
        const completion = completedByTask.get(t._id);
        const isDone = !!completion && completion.periodKey === expectedKey;
        return {
          _id: t._id,
          name: t.name,
          description: t.description,
          category: t.category,
          points: t.points,
          frequency: t.frequency,
          proof: t.proof,
          done: isDone,
          completionId: isDone ? completion!.completionId : null,
        };
      })
      .sort((a, b) => {
        if (a.frequency !== b.frequency) return a.frequency === "DAILY" ? -1 : 1;
        return b.points - a.points;
      });

    const dailyTasks = slate.filter((t) => t.frequency === "DAILY");
    const todayPoints = dailyTasks
      .filter((t) => t.done)
      .reduce((s, t) => s + t.points, 0);
    const todayDone = dailyTasks.filter((t) => t.done).length;

    const weekPoints = myWeekCompletions.reduce((s, c) => s + c.points, 0);

    return {
      group: {
        _id: group._id,
        name: group.name,
        inviteCode: group.inviteCode,
      },
      isAdmin: membership.isAdmin,
      slate,
      stats: {
        todayKey,
        weekKey: wk,
        todayPoints,
        todayDone,
        totalDailyTasks: dailyTasks.length,
        weekPoints,
      },
    };
  },
});

export const getRoster = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const userId = await requireAuthUserId(ctx);

    const myMembership = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", groupId).eq("userId", userId),
      )
      .unique();
    if (!myMembership) throw new ConvexError("Not a member of this group");

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();

    const roster = await Promise.all(
      memberships.map(async (m) => {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", m.userId))
          .unique();
        if (!profile) return null;
        return {
          userId: m.userId,
          displayName: profile.displayName,
          username: profile.username,
          avatarUrl: profile.avatarUrl,
          isAdmin: m.isAdmin,
          isYou: m.userId === userId,
          joinedAt: m.joinedAt,
        };
      }),
    );

    return roster
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => a.joinedAt - b.joinedAt);
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await requireAuthUserId(ctx);
    await requireOnboardedProfile(ctx, userId);

    const trimmed = name.trim();
    if (!trimmed) return { ok: false as const, error: "Group name is required" };
    if (trimmed.length > 40) return { ok: false as const, error: "Group name is too long" };

    const inviteCode = await findFreshInviteCode(ctx);
    const now = Date.now();

    const groupId = await ctx.db.insert("groups", {
      name: trimmed,
      inviteCode,
      createdByUserId: userId,
      createdAt: now,
    });

    await ctx.db.insert("memberships", {
      groupId,
      userId,
      isAdmin: true,
      joinedAt: now,
    });

    await seedDefaultTasks(ctx, groupId, userId);

    return { ok: true as const, groupId, inviteCode };
  },
});

export const joinByCode = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, { inviteCode }) => {
    const userId = await requireAuthUserId(ctx);
    await requireOnboardedProfile(ctx, userId);

    const code = inviteCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      return { ok: false as const, error: "Invite codes are 6 characters" };
    }

    const group = await ctx.db
      .query("groups")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", code))
      .unique();
    if (!group) {
      return { ok: false as const, error: "That code doesn't match any group" };
    }

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", group._id).eq("userId", userId),
      )
      .unique();
    if (existing) {
      return { ok: false as const, error: "You're already in this group" };
    }

    await ctx.db.insert("memberships", {
      groupId: group._id,
      userId,
      isAdmin: false,
      joinedAt: Date.now(),
    });

    return { ok: true as const, groupId: group._id };
  },
});
