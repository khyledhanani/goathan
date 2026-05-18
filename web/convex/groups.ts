import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { dayKey, weekKey, periodKeyFor } from "./lib/period";
import { PERFECT_DAY_BONUS, countPerfectDays } from "./lib/perfectDay";
import { enqueueNotification } from "./lib/notify";

const DEFAULT_TASKS = [
  { name: "Make your bed",        category: "MORNING" as const, points: 5,  frequency: "DAILY" as const,  proof: "PHOTO" as const,      description: "Snap your made bed before you leave the room." },
  { name: "Morning sunlight",     category: "MORNING" as const, points: 10, frequency: "DAILY" as const,  proof: "PHOTO" as const,      description: "10+ minutes outside within an hour of waking." },
  { name: "Workout or gym",       category: "MOVE" as const,    points: 25, frequency: "DAILY" as const,  proof: "PHOTO" as const,      description: "Photo at the gym or mid-workout." },
  { name: "10k steps",            category: "MOVE" as const,    points: 15, frequency: "DAILY" as const,  proof: "SCREENSHOT" as const, description: "Hit 10,000 steps before midnight." },
  { name: "Mobility or stretch",  category: "MOVE" as const,    points: 10, frequency: "DAILY" as const,  proof: "PHOTO" as const,      description: "5+ minutes of mobility work." },
  { name: "Protein 1g per lb",    category: "FUEL" as const,    points: 20, frequency: "DAILY" as const,  proof: "SCREENSHOT" as const, description: "Hit your protein target." },
  { name: "Home-cooked meal",     category: "FUEL" as const,    points: 15, frequency: "DAILY" as const,  proof: "PHOTO" as const,      description: "Cook yourself a real meal." },
  { name: "Read or journal",      category: "MIND" as const,    points: 10, frequency: "DAILY" as const,  proof: "PHOTO" as const,      description: "20+ minutes of reading or writing." },
  { name: "Seven hours sleep",    category: "REST" as const,    points: 10, frequency: "DAILY" as const,  proof: "SCREENSHOT" as const, description: "Seven hours minimum." },
  { name: "PR or weight target",  category: "MOVE" as const,    points: 50, frequency: "WEEKLY" as const, proof: "VIDEO" as const,      description: "Hit a personal record or weight goal this week." },
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

    const groupWeekRows = await ctx.db
      .query("completions")
      .withIndex("by_group_week", (q) =>
        q.eq("groupId", groupId).eq("weekKey", wk),
      )
      .collect();
    const myWeekCompletions = groupWeekRows.filter(
      (c) => c.userId === userId,
    );

    const completedByTask = new Map<
      string,
      {
        completionId: Id<"completions">;
        periodKey: string;
        claimedAt: number;
        verifiedAt?: number;
        revokedAt?: number;
        proofUrl: string | null;
      }
    >();
    for (const c of myWeekCompletions) {
      const proofUrl = c.proofStorageId
        ? await ctx.storage.getUrl(c.proofStorageId)
        : null;
      completedByTask.set(c.taskId, {
        completionId: c._id,
        periodKey: c.periodKey,
        claimedAt: c.claimedAt,
        verifiedAt: c.verifiedAt,
        revokedAt: c.revokedAt,
        proofUrl,
      });
    }

    const slate = tasks
      .map((t) => {
        const expectedKey = periodKeyFor(t.frequency, now);
        const completion = completedByTask.get(t._id);
        const claimedThisPeriod =
          !!completion && completion.periodKey === expectedKey;
        return {
          _id: t._id,
          name: t.name,
          description: t.description,
          category: t.category,
          points: t.points,
          frequency: t.frequency,
          proof: t.proof,
          claimedThisPeriod,
          completionId: claimedThisPeriod ? completion!.completionId : null,
          claimedAt: claimedThisPeriod ? completion!.claimedAt : null,
          verifiedAt: claimedThisPeriod
            ? (completion!.verifiedAt ?? null)
            : null,
          revokedAt: claimedThisPeriod
            ? (completion!.revokedAt ?? null)
            : null,
          proofUrl: claimedThisPeriod ? completion!.proofUrl : null,
        };
      })
      .sort((a, b) => {
        if (a.frequency !== b.frequency) return a.frequency === "DAILY" ? -1 : 1;
        return b.points - a.points;
      });

    const dailyTasks = slate.filter((t) => t.frequency === "DAILY");
    const dailyTaskIds = new Set(dailyTasks.map((t) => t._id));
    const baseTodayPoints = dailyTasks
      .filter(
        (t) =>
          t.claimedThisPeriod &&
          t.verifiedAt !== null &&
          t.revokedAt === null,
      )
      .reduce((s, t) => s + t.points, 0);
    const todayDone = dailyTasks.filter(
      (t) =>
        t.claimedThisPeriod &&
        t.verifiedAt !== null &&
        t.revokedAt === null,
    ).length;
    const isPerfectToday =
      dailyTasks.length > 0 && todayDone === dailyTasks.length;
    const todayPoints =
      baseTodayPoints + (isPerfectToday ? PERFECT_DAY_BONUS : 0);

    const baseWeekPoints = myWeekCompletions
      .filter((c) => c.verifiedAt !== undefined && c.revokedAt === undefined)
      .reduce((s, c) => s + c.points, 0);
    const perfectDayCount = countPerfectDays(myWeekCompletions, dailyTaskIds);
    const weekPoints = baseWeekPoints + perfectDayCount * PERFECT_DAY_BONUS;

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
        isPerfectToday,
        perfectDayCount,
        perfectDayBonus: PERFECT_DAY_BONUS,
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

export const homeView = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    const wk = weekKey(now);

    const allMyWeekCompletions = await ctx.db
      .query("completions")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", userId).eq("weekKey", wk),
      )
      .collect();

    const compByGroup = new Map<string, typeof allMyWeekCompletions>();
    for (const c of allMyWeekCompletions) {
      const list = compByGroup.get(c.groupId) ?? [];
      list.push(c);
      compByGroup.set(c.groupId, list);
    }

    const groups = await Promise.all(
      memberships.map(async (m) => {
        const group = await ctx.db.get(m.groupId);
        if (!group) return null;

        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_group", (q) => q.eq("groupId", m.groupId))
          .collect();

        const myCompletions = compByGroup.get(m.groupId) ?? [];
        const completionByTask = new Map<
          string,
          {
            completionId: Id<"completions">;
            periodKey: string;
            claimedAt: number;
            verifiedAt?: number;
            revokedAt?: number;
            proofUrl: string | null;
          }
        >();
        for (const c of myCompletions) {
          const proofUrl = c.proofStorageId
            ? await ctx.storage.getUrl(c.proofStorageId)
            : null;
          completionByTask.set(c.taskId, {
            completionId: c._id,
            periodKey: c.periodKey,
            claimedAt: c.claimedAt,
            verifiedAt: c.verifiedAt,
            revokedAt: c.revokedAt,
            proofUrl,
          });
        }

        const slate = tasks
          .map((t) => {
            const expectedKey = periodKeyFor(t.frequency, now);
            const completion = completionByTask.get(t._id);
            const claimedThisPeriod =
              !!completion && completion.periodKey === expectedKey;
            return {
              _id: t._id,
              name: t.name,
              description: t.description,
              category: t.category,
              points: t.points,
              frequency: t.frequency,
              proof: t.proof,
              claimedThisPeriod,
              completionId: claimedThisPeriod ? completion!.completionId : null,
              claimedAt: claimedThisPeriod ? completion!.claimedAt : null,
              verifiedAt: claimedThisPeriod
                ? (completion!.verifiedAt ?? null)
                : null,
              revokedAt: claimedThisPeriod
                ? (completion!.revokedAt ?? null)
                : null,
              proofUrl: claimedThisPeriod ? completion!.proofUrl : null,
            };
          })
          .sort((a, b) => {
            if (a.frequency !== b.frequency)
              return a.frequency === "DAILY" ? -1 : 1;
            return b.points - a.points;
          });

        const dailyTasks = slate.filter((t) => t.frequency === "DAILY");
        const dailyTaskIds = new Set(dailyTasks.map((t) => t._id));
        const baseTodayPoints = dailyTasks
          .filter(
            (t) =>
              t.claimedThisPeriod &&
              t.verifiedAt !== null &&
              t.revokedAt === null,
          )
          .reduce((s, t) => s + t.points, 0);
        const todayDone = dailyTasks.filter(
          (t) =>
            t.claimedThisPeriod &&
            t.verifiedAt !== null &&
            t.revokedAt === null,
        ).length;
        const isPerfectToday =
          dailyTasks.length > 0 && todayDone === dailyTasks.length;
        const todayPoints =
          baseTodayPoints + (isPerfectToday ? PERFECT_DAY_BONUS : 0);
        const baseWeekPoints = myCompletions
          .filter(
            (c) => c.verifiedAt !== undefined && c.revokedAt === undefined,
          )
          .reduce((s, c) => s + c.points, 0);
        const myPerfectDayCount = countPerfectDays(myCompletions, dailyTaskIds);
        const weekPoints =
          baseWeekPoints + myPerfectDayCount * PERFECT_DAY_BONUS;

        const groupMemberships = await ctx.db
          .query("memberships")
          .withIndex("by_group", (q) => q.eq("groupId", m.groupId))
          .collect();

        const groupWeekCompletions = await ctx.db
          .query("completions")
          .withIndex("by_group_week", (q) =>
            q.eq("groupId", m.groupId).eq("weekKey", wk),
          )
          .collect();
        const groupPointsByUser = new Map<Id<"users">, number>();
        const compsByUser = new Map<Id<"users">, Doc<"completions">[]>();
        for (const c of groupWeekCompletions) {
          if (!compsByUser.has(c.userId)) compsByUser.set(c.userId, []);
          compsByUser.get(c.userId)!.push(c);
          if (c.verifiedAt === undefined) continue;
          if (c.revokedAt !== undefined) continue;
          groupPointsByUser.set(
            c.userId,
            (groupPointsByUser.get(c.userId) ?? 0) + c.points,
          );
        }

        const memberStandings = await Promise.all(
          groupMemberships.map(async (gm) => {
            const memberProfile = await ctx.db
              .query("profiles")
              .withIndex("by_user", (q) => q.eq("userId", gm.userId))
              .unique();
            const memberComps = compsByUser.get(gm.userId) ?? [];
            const perfectDays = countPerfectDays(memberComps, dailyTaskIds);
            const base = groupPointsByUser.get(gm.userId) ?? 0;
            return {
              userId: gm.userId,
              displayName: memberProfile?.displayName ?? "Unknown",
              avatarUrl: memberProfile?.avatarUrl,
              weekPoints: base + perfectDays * PERFECT_DAY_BONUS,
            };
          }),
        );
        memberStandings.sort((a, b) => b.weekPoints - a.weekPoints);

        const rank = memberStandings.findIndex((s) => s.userId === userId) + 1;
        const memberCount = memberStandings.length;
        const leader = memberStandings[0];
        const isLeading = rank === 1 && weekPoints > 0;
        const gapToLeader = isLeading
          ? 0
          : Math.max(0, (leader?.weekPoints ?? 0) - weekPoints);
        const leaderFirstName =
          leader?.displayName?.trim().split(/\s+/)[0] ?? null;

        const memberAvatars = memberStandings.slice(0, 5).map((s) => ({
          displayName: s.displayName,
          avatarUrl: s.avatarUrl,
        }));

        return {
          _id: group._id,
          name: group.name,
          isAdmin: m.isAdmin,
          joinedAt: m.joinedAt,
          slate,
          stats: {
            todayPoints,
            todayDone,
            totalDailyTasks: dailyTasks.length,
            weekPoints,
            isPerfectToday,
          },
          rank,
          memberCount,
          isLeading,
          leaderFirstName,
          leaderPoints: leader?.weekPoints ?? 0,
          gapToLeader,
          memberAvatars,
        };
      }),
    );

    const filtered = groups
      .filter((g): g is NonNullable<typeof g> => g !== null)
      .sort((a, b) => b.joinedAt - a.joinedAt);

    const totals = {
      todayPoints: filtered.reduce((s, g) => s + g.stats.todayPoints, 0),
      weekPoints: filtered.reduce((s, g) => s + g.stats.weekPoints, 0),
      todayDone: filtered.reduce((s, g) => s + g.stats.todayDone, 0),
      totalDailyTasks: filtered.reduce(
        (s, g) => s + g.stats.totalDailyTasks,
        0,
      ),
      groupCount: filtered.length,
    };

    return { groups: filtered, totals };
  },
});

export const weeklyStandings = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const myMembership = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", groupId).eq("userId", userId),
      )
      .unique();
    if (!myMembership) return null;

    const wk = weekKey(Date.now());

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    const dailyTaskIds = new Set(
      tasks.filter((t) => t.frequency === "DAILY").map((t) => t._id),
    );

    const groupWeekCompletions = await ctx.db
      .query("completions")
      .withIndex("by_group_week", (q) =>
        q.eq("groupId", groupId).eq("weekKey", wk),
      )
      .collect();
    const pointsByUser = new Map<Id<"users">, number>();
    const compsByUser = new Map<Id<"users">, Doc<"completions">[]>();
    for (const c of groupWeekCompletions) {
      if (!compsByUser.has(c.userId)) compsByUser.set(c.userId, []);
      compsByUser.get(c.userId)!.push(c);
      if (c.verifiedAt === undefined) continue;
      if (c.revokedAt !== undefined) continue;
      pointsByUser.set(
        c.userId,
        (pointsByUser.get(c.userId) ?? 0) + c.points,
      );
    }

    const rows = await Promise.all(
      memberships.map(async (m) => {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", m.userId))
          .unique();
        const memberComps = compsByUser.get(m.userId) ?? [];
        const perfectDays = countPerfectDays(memberComps, dailyTaskIds);
        const base = pointsByUser.get(m.userId) ?? 0;
        return {
          userId: m.userId,
          displayName: profile?.displayName ?? "Unknown",
          username: profile?.username,
          avatarUrl: profile?.avatarUrl,
          isAdmin: m.isAdmin,
          isYou: m.userId === userId,
          weekPoints: base + perfectDays * PERFECT_DAY_BONUS,
          perfectDays,
        };
      }),
    );

    return rows.sort((a, b) => b.weekPoints - a.weekPoints);
  },
});

export const recentActivity = query({
  args: { groupId: v.id("groups"), limit: v.optional(v.number()) },
  handler: async (ctx, { groupId, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const myMembership = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", groupId).eq("userId", userId),
      )
      .unique();
    if (!myMembership) return [];

    const take = Math.min(Math.max(limit ?? 20, 1), 50);

    const recent = await ctx.db
      .query("completions")
      .withIndex("by_group_recent", (q) => q.eq("groupId", groupId))
      .order("desc")
      .take(take);

    return await Promise.all(
      recent.map(async (c) => {
        const task = await ctx.db.get(c.taskId);
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", c.userId))
          .unique();
        const challenges = await ctx.db
          .query("challenges")
          .withIndex("by_completion", (q) => q.eq("completionId", c._id))
          .collect();
        const rawComments = await ctx.db
          .query("comments")
          .withIndex("by_completion", (q) => q.eq("completionId", c._id))
          .collect();
        const comments = await Promise.all(
          rawComments.map(async (cm) => {
            const authorProfile = await ctx.db
              .query("profiles")
              .withIndex("by_user", (q) => q.eq("userId", cm.authorUserId))
              .unique();
            return {
              _id: cm._id,
              authorUserId: cm.authorUserId,
              authorName: authorProfile?.displayName ?? "Unknown",
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

        const verification = await ctx.db
          .query("proofVerifications")
          .withIndex("by_completion", (q) => q.eq("completionId", c._id))
          .unique();

        return {
          completionId: c._id,
          memberUserId: c.userId,
          memberDisplayName: profile?.displayName ?? "Unknown",
          memberAvatarUrl: profile?.avatarUrl,
          isYou: c.userId === userId,
          taskName: task?.name ?? "(removed task)",
          taskCategory: task?.category ?? "MOVE",
          points: c.points,
          claimedAt: c.claimedAt,
          verifiedAt: c.verifiedAt ?? null,
          revokedAt: c.revokedAt ?? null,
          proofUrl,
          challengeCount: challenges.length,
          challengedByYou: challenges.some(
            (ch) => ch.challengerUserId === userId,
          ),
          comments,
          aiVerification: verification
            ? {
                status: verification.status,
                confidence: verification.confidence ?? null,
                reasoning: verification.reasoning ?? null,
                flags: verification.flags ?? [],
              }
            : null,
        };
      }),
    );
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

async function deleteGroupCascade(
  ctx: MutationCtx,
  groupId: Id<"groups">,
) {
  const comments = await ctx.db
    .query("comments")
    .withIndex("by_group_recent", (q) => q.eq("groupId", groupId))
    .collect();
  for (const cm of comments) await ctx.db.delete(cm._id);

  const challenges = await ctx.db
    .query("challenges")
    .withIndex("by_group_recent", (q) => q.eq("groupId", groupId))
    .collect();
  for (const ch of challenges) await ctx.db.delete(ch._id);

  const completions = await ctx.db
    .query("completions")
    .withIndex("by_group_recent", (q) => q.eq("groupId", groupId))
    .collect();
  for (const c of completions) await ctx.db.delete(c._id);

  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
  for (const t of tasks) await ctx.db.delete(t._id);

  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
  for (const m of memberships) await ctx.db.delete(m._id);

  await ctx.db.delete(groupId);
}

export const leave = mutation({
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

    const allMemberships = await ctx.db
      .query("memberships")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();

    if (allMemberships.length === 1) {
      await deleteGroupCascade(ctx, groupId);
      return { state: "deleted" as const };
    }

    if (myMembership.isAdmin) {
      const others = allMemberships.filter((m) => m._id !== myMembership._id);
      const otherAdmins = others.filter((m) => m.isAdmin);
      if (otherAdmins.length === 0) {
        const oldest = [...others].sort((a, b) => a.joinedAt - b.joinedAt)[0];
        await ctx.db.patch(oldest._id, { isAdmin: true });
      }
    }

    const completionsInGroup = await ctx.db
      .query("completions")
      .withIndex("by_group_recent", (q) => q.eq("groupId", groupId))
      .collect();
    for (const c of completionsInGroup) {
      if (c.userId !== userId) continue;
      const linkedChallenges = await ctx.db
        .query("challenges")
        .withIndex("by_completion", (q) => q.eq("completionId", c._id))
        .collect();
      for (const ch of linkedChallenges) await ctx.db.delete(ch._id);
      const linkedComments = await ctx.db
        .query("comments")
        .withIndex("by_completion", (q) => q.eq("completionId", c._id))
        .collect();
      for (const cm of linkedComments) await ctx.db.delete(cm._id);
      await ctx.db.delete(c._id);
    }

    const challengesInGroup = await ctx.db
      .query("challenges")
      .withIndex("by_group_recent", (q) => q.eq("groupId", groupId))
      .collect();
    for (const ch of challengesInGroup) {
      if (ch.challengerUserId === userId) await ctx.db.delete(ch._id);
    }

    const commentsInGroup = await ctx.db
      .query("comments")
      .withIndex("by_group_recent", (q) => q.eq("groupId", groupId))
      .collect();
    for (const cm of commentsInGroup) {
      if (cm.authorUserId === userId) await ctx.db.delete(cm._id);
    }

    await ctx.db.delete(myMembership._id);
    return { state: "left" as const };
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

    const newcomer = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const existingMembers = await ctx.db
      .query("memberships")
      .withIndex("by_group", (q) => q.eq("groupId", group._id))
      .collect();
    for (const m of existingMembers) {
      if (m.userId === userId) continue;
      await enqueueNotification(ctx, {
        userId: m.userId,
        kind: "MEMBER_JOINED",
        actorUserId: userId,
        groupId: group._id,
        title: newcomer?.displayName ?? "Someone",
        body: `joined ${group.name}`,
        deepLinkPath: `/group/${group._id}`,
        dedupeKey: `joined:${group._id}:${userId}`,
      });
    }

    return { ok: true as const, groupId: group._id };
  },
});
