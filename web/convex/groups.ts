import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { dayKey, periodKeyFor, groupPeriodBounds } from "./lib/period";
import { PERFECT_DAY_BONUS, countPerfectDays } from "./lib/perfectDay";
import { enqueueNotification } from "./lib/notify";
import { serializeVerification } from "./lib/aiVerifyDisplay";

type SeedTask = {
  name: string;
  description?: string;
  category: "MORNING" | "MOVE" | "FUEL" | "MIND" | "REST";
  points: number;
  frequency: "DAILY" | "WEEKLY";
  proof: "PHOTO" | "SCREENSHOT" | "VIDEO";
};

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
] satisfies SeedTask[];

const STAKE_TEXT_MAX = 140;

async function legacyProofUrlFor(
  ctx: QueryCtx,
  completion: Pick<Doc<"completions">, "proofStorageId">,
): Promise<string | null> {
  if (completion.proofStorageId) return ctx.storage.getUrl(completion.proofStorageId);
  return null;
}

function hasR2ProofFor(
  completion: Pick<Doc<"completions">, "proofAssetId" | "proofR2Key">,
): boolean {
  return completion.proofAssetId !== undefined || completion.proofR2Key !== undefined;
}

function normalizeStakeText(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed || undefined;
}

type UsernameResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

function normalizeInviteUsername(raw: string): UsernameResult {
  const username = raw.trim().replace(/^@+/, "").toLowerCase();
  if (!username) return { ok: false, error: "Username is required" };
  if (!/^[a-z0-9_.]{2,20}$/.test(username)) {
    return {
      ok: false,
      error: "Usernames are 2-20 chars: a-z, 0-9, _ or .",
    };
  }
  return { ok: true, value: username };
}

const seedTaskValidator = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  category: v.union(
    v.literal("MORNING"),
    v.literal("MOVE"),
    v.literal("FUEL"),
    v.literal("MIND"),
    v.literal("REST"),
  ),
  points: v.number(),
  frequency: v.union(v.literal("DAILY"), v.literal("WEEKLY")),
  proof: v.union(
    v.literal("PHOTO"),
    v.literal("SCREENSHOT"),
    v.literal("VIDEO"),
  ),
});

function sanitizeSeedTasks(tasks: SeedTask[]) {
  const out: SeedTask[] = [];
  for (const task of tasks.slice(0, 20)) {
    const name = task.name.trim();
    if (!name || name.length > 60) continue;

    const points = Math.floor(task.points);
    if (!Number.isFinite(points) || points < 1 || points > 200) continue;

    const description = task.description?.trim() || undefined;
    out.push({
      name,
      description: description?.slice(0, 120),
      category: task.category,
      points,
      frequency: task.frequency,
      proof: task.proof,
    });
  }
  return out;
}

async function seedDefaultTasks(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  userId: Id<"users">,
) {
  await seedTasks(ctx, groupId, userId, DEFAULT_TASKS);
}

async function seedTasks(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  userId: Id<"users">,
  tasks: SeedTask[],
) {
  const now = Date.now();
  for (const t of sanitizeSeedTasks(tasks)) {
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

async function enqueueMemberJoinedNotifications(
  ctx: MutationCtx,
  group: Doc<"groups">,
  newUserId: Id<"users">,
  newcomerName: string,
) {
  const existingMembers = await ctx.db
    .query("memberships")
    .withIndex("by_group", (q) => q.eq("groupId", group._id))
    .collect();

  for (const m of existingMembers) {
    if (m.userId === newUserId) continue;
    await enqueueNotification(ctx, {
      userId: m.userId,
      kind: "MEMBER_JOINED",
      actorUserId: newUserId,
      groupId: group._id,
      title: newcomerName,
      body: `joined ${group.name}`,
      deepLinkPath: `/group/${group._id}`,
      dedupeKey: `joined:${group._id}:${newUserId}`,
    });
  }
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
    const period = groupPeriodBounds(group, now);

    const groupPeriodRows = await ctx.db
      .query("completions")
      .withIndex("by_group_recent", (q) =>
        q
          .eq("groupId", groupId)
          .gte("claimedAt", period.periodStart)
          .lt("claimedAt", period.periodEnd),
      )
      .collect();
    const myWeekCompletions = groupPeriodRows.filter(
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
        hasR2Proof: boolean;
        aiVerification: {
          status:
            | "PENDING"
            | "PASSED"
            | "INCONCLUSIVE"
            | "FAILED"
            | "ERROR"
            | "SKIPPED";
          confidence: number | null;
          reasoning: string | null;
          flags: string[];
        } | null;
      }
    >();
    for (const c of myWeekCompletions) {
      const proofUrl = await legacyProofUrlFor(ctx, c);
      const verification = await ctx.db
        .query("proofVerifications")
        .withIndex("by_completion", (q) => q.eq("completionId", c._id))
        .unique();
      completedByTask.set(c.taskId, {
        completionId: c._id,
        periodKey: c.periodKey,
        claimedAt: c.claimedAt,
        verifiedAt: c.verifiedAt,
        revokedAt: c.revokedAt,
        proofUrl,
        hasR2Proof: hasR2ProofFor(c),
        aiVerification: serializeVerification(verification),
      });
    }

    // For tasks not found in the group-period scan, check by their own
    // frequency-based period key.  This catches completions whose claimedAt
    // falls outside the current group period window (e.g. a WEEKLY task
    // claimed earlier in the week when the group period has since reset).
    for (const t of tasks) {
      if (completedByTask.has(t._id)) continue;
      const expectedKey = periodKeyFor(t.frequency, now);
      const match = await ctx.db
        .query("completions")
        .withIndex("by_user_task_period", (q) =>
          q.eq("userId", userId).eq("taskId", t._id).eq("periodKey", expectedKey),
        )
        .unique();
      if (match) {
        const proofUrl = await legacyProofUrlFor(ctx, match);
        const verification = await ctx.db
          .query("proofVerifications")
          .withIndex("by_completion", (q) => q.eq("completionId", match._id))
          .unique();
        completedByTask.set(t._id, {
          completionId: match._id,
          periodKey: match.periodKey,
          claimedAt: match.claimedAt,
          verifiedAt: match.verifiedAt,
          revokedAt: match.revokedAt,
          proofUrl,
          hasR2Proof: hasR2ProofFor(match),
          aiVerification: serializeVerification(verification),
        });
      }
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
          hasR2Proof: claimedThisPeriod ? completion!.hasR2Proof : false,
          aiVerification: claimedThisPeriod
            ? completion!.aiVerification
            : null,
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
        anchorDate: group.anchorDate ?? null,
        anchorDayOfMonth: group.anchorDayOfMonth ?? null,
        durationDays: group.durationDays ?? null,
        repeat: group.repeat ?? null,
        cadence: group.cadence ?? null,
        stakeKind: group.stakeKind ?? null,
        stakeText: group.stakeText ?? null,
      },
      isAdmin: membership.isAdmin,
      slate,
      stats: {
        todayKey,
        weekKey: period.periodKey,
        periodEndMs: period.periodEnd,
        periodEnded: period.ended,
        durationDays: group.durationDays ?? 7,
        cadence: group.cadence ?? null,
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

    const groups = await Promise.all(
      memberships.map(async (m) => {
        const group = await ctx.db.get(m.groupId);
        if (!group) return null;

        const period = groupPeriodBounds(group, now);

        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_group", (q) => q.eq("groupId", m.groupId))
          .collect();

        const groupWeekCompletions = await ctx.db
          .query("completions")
          .withIndex("by_group_recent", (q) =>
            q
              .eq("groupId", m.groupId)
              .gte("claimedAt", period.periodStart)
              .lt("claimedAt", period.periodEnd),
          )
          .collect();
        const myCompletions = groupWeekCompletions.filter(
          (c) => c.userId === userId,
        );

        const dailyTasks = tasks.filter((t) => t.frequency === "DAILY");
        const dailyTaskIds = new Set(dailyTasks.map((t) => t._id));
        const dailyPointsByTask = new Map(
          dailyTasks.map((t) => [t._id, t.points]),
        );
        const todayKey = periodKeyFor("DAILY", now);
        const verifiedTodayTaskIds = new Set(
          myCompletions
            .filter(
              (c) =>
                dailyTaskIds.has(c.taskId) &&
                c.periodKey === todayKey &&
                c.verifiedAt !== undefined &&
                c.revokedAt === undefined,
            )
            .map((c) => c.taskId),
        );
        const baseTodayPoints = Array.from(verifiedTodayTaskIds).reduce(
          (sum, taskId) => sum + (dailyPointsByTask.get(taskId) ?? 0),
          0,
        );
        const todayDone = verifiedTodayTaskIds.size;
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
          stakeKind: group.stakeKind ?? null,
          stakeText: group.stakeText ?? null,
          stats: {
            todayPoints,
            todayDone,
            totalDailyTasks: dailyTasks.length,
            taskCount: tasks.length,
            weekPoints,
            isPerfectToday,
            periodEndMs: period.periodEnd,
            periodEnded: period.ended,
            durationDays: group.durationDays ?? 7,
            cadence: group.cadence ?? null,
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

    const group = await ctx.db.get(groupId);
    if (!group) return null;

    const now = Date.now();
    const period = groupPeriodBounds(group, now);

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
      .withIndex("by_group_recent", (q) =>
        q
          .eq("groupId", groupId)
          .gte("claimedAt", period.periodStart)
          .lt("claimedAt", period.periodEnd),
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

        const proofUrl = await legacyProofUrlFor(ctx, c);

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
          hasR2Proof: hasR2ProofFor(c),
          challengeCount: challenges.length,
          challengedByYou: challenges.some(
            (ch) => ch.challengerUserId === userId,
          ),
          comments,
          aiVerification: serializeVerification(verification),
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    tasks: v.optional(v.array(seedTaskValidator)),
    durationDays: v.optional(v.number()),
    repeat: v.optional(v.boolean()),
    cadence: v.optional(v.union(v.literal("monthly"))),
    anchorDate: v.optional(v.number()),
    anchorDayOfMonth: v.optional(v.number()),
    stakeKind: v.optional(v.union(v.literal("PENALTY"), v.literal("REWARD"))),
    stakeText: v.optional(v.string()),
  },
  handler: async (
    ctx,
    {
      name,
      tasks,
      durationDays,
      repeat,
      cadence,
      anchorDate: anchorArg,
      anchorDayOfMonth,
      stakeKind,
      stakeText,
    },
  ) => {
    const userId = await requireAuthUserId(ctx);
    await requireOnboardedProfile(ctx, userId);

    const trimmed = name.trim();
    if (!trimmed) return { ok: false as const, error: "Group name is required" };
    if (trimmed.length > 40) return { ok: false as const, error: "Group name is too long" };

    const normalizedStakeText = normalizeStakeText(stakeText);
    if (normalizedStakeText && normalizedStakeText.length > STAKE_TEXT_MAX) {
      return { ok: false as const, error: "Penalty or reward is too long" };
    }

    const dur = durationDays ?? 7;
    if (!Number.isFinite(dur) || dur < 1 || dur > 365) {
      return { ok: false as const, error: "Duration must be 1–365 days" };
    }

    const inviteCode = await findFreshInviteCode(ctx);
    const now = Date.now();

    // Use provided anchor or snap to UTC midnight of now
    let anchorDate: number;
    if (anchorArg !== undefined) {
      // Snap to UTC midnight to be safe
      const ad = new Date(anchorArg);
      anchorDate = Date.UTC(ad.getUTCFullYear(), ad.getUTCMonth(), ad.getUTCDate());
    } else {
      const anchorD = new Date(now);
      anchorDate = Date.UTC(
        anchorD.getUTCFullYear(),
        anchorD.getUTCMonth(),
        anchorD.getUTCDate(),
      );
    }

    const groupId = await ctx.db.insert("groups", {
      name: trimmed,
      inviteCode,
      createdByUserId: userId,
      createdAt: now,
      anchorDate,
      anchorDayOfMonth: cadence === "monthly" ? anchorDayOfMonth : undefined,
      durationDays: cadence === "monthly" ? undefined : dur,
      repeat: repeat ?? true,
      cadence,
      stakeKind: normalizedStakeText ? (stakeKind ?? "PENALTY") : undefined,
      stakeText: normalizedStakeText,
    });

    await ctx.db.insert("memberships", {
      groupId,
      userId,
      isAdmin: true,
      joinedAt: now,
    });

    if (tasks === undefined) {
      await seedDefaultTasks(ctx, groupId, userId);
    } else {
      await seedTasks(ctx, groupId, userId, tasks);
    }

    return { ok: true as const, groupId, inviteCode };
  },
});

export const updateSettings = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.string(),
    durationDays: v.optional(v.number()),
    repeat: v.optional(v.boolean()),
    cadence: v.optional(v.union(v.literal("monthly"))),
    anchorDate: v.optional(v.number()),
    anchorDayOfMonth: v.optional(v.number()),
    stakeKind: v.optional(v.union(v.literal("PENALTY"), v.literal("REWARD"))),
    stakeText: v.optional(v.string()),
  },
  handler: async (
    ctx,
    {
      groupId,
      name,
      durationDays,
      repeat,
      cadence,
      anchorDate: anchorArg,
      anchorDayOfMonth,
      stakeKind,
      stakeText,
    },
  ) => {
    const userId = await requireAuthUserId(ctx);

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", groupId).eq("userId", userId),
      )
      .unique();
    if (!membership) throw new ConvexError("Not a member of this group");
    if (!membership.isAdmin) {
      return { ok: false as const, error: "Only admins can edit this group" };
    }

    const group = await ctx.db.get(groupId);
    if (!group) return { ok: false as const, error: "Group not found" };

    const trimmed = name.trim();
    if (!trimmed) return { ok: false as const, error: "Group name is required" };
    if (trimmed.length > 40) {
      return { ok: false as const, error: "Group name is too long" };
    }

    const normalizedStakeText = normalizeStakeText(stakeText);
    if (normalizedStakeText && normalizedStakeText.length > STAKE_TEXT_MAX) {
      return { ok: false as const, error: "Penalty or reward is too long" };
    }

    const patch: Partial<Doc<"groups">> = {
      name: trimmed,
      stakeKind: normalizedStakeText ? (stakeKind ?? "PENALTY") : undefined,
      stakeText: normalizedStakeText,
    };

    const hasResetUpdate =
      durationDays !== undefined ||
      repeat !== undefined ||
      cadence !== undefined ||
      anchorArg !== undefined ||
      anchorDayOfMonth !== undefined;

    if (hasResetUpdate) {
      let nextAnchorDate: number;
      if (anchorArg !== undefined) {
        const ad = new Date(anchorArg);
        nextAnchorDate = Date.UTC(
          ad.getUTCFullYear(),
          ad.getUTCMonth(),
          ad.getUTCDate(),
        );
      } else if (group.anchorDate !== undefined) {
        nextAnchorDate = group.anchorDate;
      } else {
        const now = new Date();
        nextAnchorDate = Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
        );
      }

      if (cadence === "monthly") {
        const day = Math.floor(
          anchorDayOfMonth ??
            group.anchorDayOfMonth ??
            new Date(nextAnchorDate).getUTCDate(),
        );
        if (!Number.isFinite(day) || day < 1 || day > 31) {
          return { ok: false as const, error: "Reset day must be 1–31" };
        }
        patch.anchorDate = nextAnchorDate;
        patch.anchorDayOfMonth = day;
        patch.durationDays = undefined;
        patch.repeat = repeat ?? true;
        patch.cadence = "monthly";
      } else {
        const dur = durationDays ?? group.durationDays ?? 7;
        if (!Number.isFinite(dur) || dur < 1 || dur > 365) {
          return { ok: false as const, error: "Duration must be 1–365 days" };
        }
        patch.anchorDate = nextAnchorDate;
        patch.anchorDayOfMonth = undefined;
        patch.durationDays = Math.floor(dur);
        patch.repeat = repeat ?? true;
        patch.cadence = undefined;
      }
    }

    await ctx.db.patch(groupId, patch);

    return { ok: true as const };
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

export const pendingInvites = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const invites = await ctx.db
      .query("groupInvites")
      .withIndex("by_invited_user_status", (q) =>
        q.eq("invitedUserId", userId).eq("status", "PENDING"),
      )
      .order("desc")
      .take(20);

    return await Promise.all(
      invites.map(async (invite) => {
        const group = await ctx.db.get(invite.groupId);
        const inviter = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", invite.invitedByUserId))
          .unique();

        return {
          _id: invite._id,
          groupId: invite.groupId,
          groupName: group?.name ?? "Removed group",
          invitedByUserId: invite.invitedByUserId,
          invitedByName: inviter?.displayName ?? "Someone",
          invitedByAvatarUrl: inviter?.avatarUrl,
          createdAt: invite.createdAt,
          groupExists: group !== null,
        };
      }),
    );
  },
});

export const inviteByUsername = mutation({
  args: { groupId: v.id("groups"), username: v.string() },
  handler: async (ctx, { groupId, username }) => {
    const userId = await requireAuthUserId(ctx);
    const inviter = await requireOnboardedProfile(ctx, userId);

    const group = await ctx.db.get(groupId);
    if (!group) throw new ConvexError("Group not found");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", groupId).eq("userId", userId),
      )
      .unique();
    if (!membership) throw new ConvexError("Not a member of this group");

    const normalized = normalizeInviteUsername(username);
    if (!normalized.ok) return { ok: false as const, error: normalized.error };

    const matches = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", normalized.value))
      .take(2);
    if (matches.length === 0) {
      return {
        ok: false as const,
        error: `No user found for @${normalized.value}`,
      };
    }
    if (matches.length > 1) {
      return {
        ok: false as const,
        error: "That username is not unique right now",
      };
    }

    const invitee = matches[0];
    if (invitee.userId === userId) {
      return { ok: false as const, error: "You're already in this group" };
    }
    if (!invitee.onboardingCompleted) {
      return {
        ok: false as const,
        error: `@${normalized.value} needs to finish onboarding first`,
      };
    }

    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", groupId).eq("userId", invitee.userId),
      )
      .unique();
    if (existingMembership) {
      return {
        ok: false as const,
        error: `@${normalized.value} is already in this group`,
      };
    }

    const existingInvites = await ctx.db
      .query("groupInvites")
      .withIndex("by_group_and_invited_user", (q) =>
        q.eq("groupId", groupId).eq("invitedUserId", invitee.userId),
      )
      .collect();
    if (existingInvites.some((invite) => invite.status === "PENDING")) {
      return {
        ok: false as const,
        error: `@${normalized.value} already has a pending invite`,
      };
    }

    const inviteId = await ctx.db.insert("groupInvites", {
      groupId,
      invitedUserId: invitee.userId,
      invitedByUserId: userId,
      status: "PENDING",
      createdAt: Date.now(),
    });

    await enqueueNotification(ctx, {
      userId: invitee.userId,
      kind: "GROUP_INVITE",
      actorUserId: userId,
      groupId,
      title: inviter.displayName,
      body: `invited you to ${group.name}`,
      deepLinkPath: "/groups",
      dedupeKey: `group_invite:${inviteId}`,
    });

    return {
      ok: true as const,
      username: normalized.value,
      displayName: invitee.displayName,
    };
  },
});

export const respondToInvite = mutation({
  args: {
    inviteId: v.id("groupInvites"),
    response: v.union(v.literal("ACCEPT"), v.literal("DECLINE")),
  },
  handler: async (ctx, { inviteId, response }) => {
    const userId = await requireAuthUserId(ctx);
    const profile = await requireOnboardedProfile(ctx, userId);

    const invite = await ctx.db.get(inviteId);
    if (!invite || invite.invitedUserId !== userId) {
      return { ok: false as const, error: "Invite not found" };
    }
    if (invite.status !== "PENDING") {
      return { ok: false as const, error: "Invite already handled" };
    }

    const now = Date.now();
    if (response === "DECLINE") {
      await ctx.db.patch(inviteId, {
        status: "DECLINED",
        respondedAt: now,
      });
      return { ok: true as const, state: "declined" as const };
    }

    const group = await ctx.db.get(invite.groupId);
    if (!group) {
      await ctx.db.patch(inviteId, {
        status: "DECLINED",
        respondedAt: now,
      });
      return { ok: false as const, error: "This group no longer exists" };
    }

    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", invite.groupId).eq("userId", userId),
      )
      .unique();
    if (!existingMembership) {
      await ctx.db.insert("memberships", {
        groupId: invite.groupId,
        userId,
        isAdmin: false,
        joinedAt: now,
      });
    }

    await ctx.db.patch(inviteId, {
      status: "ACCEPTED",
      respondedAt: now,
    });

    if (!existingMembership) {
      await enqueueMemberJoinedNotifications(
        ctx,
        group,
        userId,
        profile.displayName,
      );
    }

    return {
      ok: true as const,
      state: "accepted" as const,
      groupId: group._id,
    };
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
    await enqueueMemberJoinedNotifications(
      ctx,
      group,
      userId,
      newcomer?.displayName ?? "Someone",
    );

    return { ok: true as const, groupId: group._id };
  },
});
