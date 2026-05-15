import { query } from "./_generated/server";
import { v } from "convex/values";
import { dayKey, weekKey } from "./lib/period";

export const snapshot = query({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
  },
  handler: async (ctx, { groupId, userId }) => {
    const now = Date.now();
    const dKey = dayKey(now);
    const wKey = weekKey(now);

    const group = await ctx.db.get(groupId);
    if (!group) throw new Error("Group not found");

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();

    const myCompletions = await ctx.db
      .query("completions")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", userId).eq("weekKey", wKey),
      )
      .collect();

    const completedToday = new Map<
      string,
      { completionId: string; periodKey: string }
    >();
    for (const c of myCompletions) {
      const t = tasks.find((tt) => tt._id === c.taskId);
      if (!t) continue;
      const expectedKey = t.frequency === "DAILY" ? dKey : wKey;
      if (c.periodKey === expectedKey) {
        completedToday.set(c.taskId, {
          completionId: c._id,
          periodKey: c.periodKey,
        });
      }
    }

    const myCompletionIds = Array.from(completedToday.values()).map(
      (v) => v.completionId,
    );
    const myChallenges = new Set<string>();
    for (const cid of myCompletionIds) {
      const ch = await ctx.db
        .query("challenges")
        .withIndex("by_completion", (q) => q.eq("completionId", cid as any))
        .first();
      if (ch) myChallenges.add(cid);
    }

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();

    const ranked = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        const weekCompletions = await ctx.db
          .query("completions")
          .withIndex("by_user_week", (q) =>
            q.eq("userId", m.userId).eq("weekKey", wKey),
          )
          .collect();
        const points = weekCompletions.reduce((s, c) => s + c.points, 0);
        return {
          userId: m.userId,
          name: user?.name ?? "Unknown",
          handle: m.handle,
          isAdmin: m.isAdmin,
          isYou: m.userId === userId,
          weeklyPoints: points,
        };
      }),
    );
    ranked.sort((a, b) => b.weeklyPoints - a.weeklyPoints);

    const recentCompletions = await ctx.db
      .query("completions")
      .withIndex("by_group_recent", (q) => q.eq("groupId", groupId))
      .order("desc")
      .take(15);

    const recentChallenges = await ctx.db
      .query("challenges")
      .withIndex("by_group_recent", (q) => q.eq("groupId", groupId))
      .order("desc")
      .take(10);

    const taskById = new Map(tasks.map((t) => [t._id, t] as const));
    const userIdsNeeded = new Set<string>();
    for (const c of recentCompletions) userIdsNeeded.add(c.userId);
    for (const c of recentChallenges) userIdsNeeded.add(c.challengerUserId);
    const completionMap = new Map<string, any>();
    for (const c of recentCompletions) completionMap.set(c._id, c);

    const userById = new Map<string, { name: string }>();
    for (const uid of userIdsNeeded) {
      const u = await ctx.db.get(uid as any);
      if (u) userById.set(uid, { name: (u as any).name });
    }

    type FeedItem = {
      id: string;
      memberName: string;
      verb: "completed" | "hit" | "locked in" | "called cap on";
      taskName: string;
      capCall?: boolean;
      sortAt: number;
    };

    const feedItems: FeedItem[] = [];
    for (const c of recentCompletions) {
      const t = taskById.get(c.taskId);
      const u = userById.get(c.userId);
      if (!t || !u) continue;
      feedItems.push({
        id: c._id,
        memberName: u.name,
        verb: t.category === "NUTRITION" ? "hit" : "locked in",
        taskName: t.name,
        sortAt: c.completedAt,
      });
    }
    for (const ch of recentChallenges) {
      const c = completionMap.get(ch.completionId) ?? (await ctx.db.get(ch.completionId));
      if (!c) continue;
      const t = taskById.get(c.taskId) ?? (await ctx.db.get(c.taskId));
      const challenger = userById.get(ch.challengerUserId);
      const target = await ctx.db.get(c.userId);
      if (!t || !challenger || !target) continue;
      feedItems.push({
        id: ch._id,
        memberName: challenger.name,
        verb: "called cap on",
        taskName: `${(target as any).name}'s ${t.name}`,
        capCall: true,
        sortAt: ch.createdAt,
      });
    }
    feedItems.sort((a, b) => b.sortAt - a.sortAt);
    const feed = feedItems.slice(0, 12).map((f) => ({
      id: f.id,
      memberName: f.memberName,
      verb: f.verb,
      taskName: f.taskName,
      capCall: f.capCall,
      sortAt: f.sortAt,
    }));

    return {
      group: { _id: group._id, name: group.name, inviteCode: group.inviteCode },
      tasks: tasks.map((t) => ({
        _id: t._id,
        name: t.name,
        description: t.description,
        category: t.category,
        points: t.points,
        frequency: t.frequency,
        proof: t.proof,
      })),
      completions: Array.from(completedToday.entries()).map(([taskId, v]) => ({
        taskId,
        completionId: v.completionId,
        challenged: myChallenges.has(v.completionId),
      })),
      ranked,
      feed,
      dayKey: dKey,
      weekKey: wKey,
    };
  },
});
