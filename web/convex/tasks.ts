import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const CATEGORY = v.union(
  v.literal("GYM"),
  v.literal("CARDIO"),
  v.literal("NUTRITION"),
  v.literal("RECOVERY"),
  v.literal("PROGRESS"),
);
const FREQUENCY = v.union(v.literal("DAILY"), v.literal("WEEKLY"));
const PROOF = v.union(
  v.literal("PHOTO"),
  v.literal("SCREENSHOT"),
  v.literal("MANUAL"),
  v.literal("VIDEO"),
);

export const list = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
  },
});

export const create = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    name: v.string(),
    description: v.string(),
    category: CATEGORY,
    points: v.number(),
    frequency: FREQUENCY,
    proof: PROOF,
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_group_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId),
      )
      .unique();
    if (!membership || !membership.isAdmin) {
      throw new Error("Only admins can create tasks");
    }
    return await ctx.db.insert("tasks", {
      groupId: args.groupId,
      name: args.name,
      description: args.description,
      category: args.category,
      points: Math.max(1, Math.floor(args.points)),
      frequency: args.frequency,
      proof: args.proof,
      createdByUserId: args.userId,
      createdAt: Date.now(),
    });
  },
});

export const seedDefaults = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, { groupId, userId }) => {
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .first();
    if (existing) return;

    const now = Date.now();
    const defaults = [
      { name: "Gym check-in",   description: "Scan in at the gym. Geofenced.",        category: "GYM" as const,       points: 25, frequency: "DAILY" as const,  proof: "PHOTO" as const },
      { name: "10K steps",      description: "Hit 10,000 steps before midnight.",     category: "CARDIO" as const,    points: 15, frequency: "DAILY" as const,  proof: "SCREENSHOT" as const },
      { name: "Protein goal",   description: "Hit 1g per pound bodyweight.",          category: "NUTRITION" as const, points: 20, frequency: "DAILY" as const,  proof: "SCREENSHOT" as const },
      { name: "Calorie target", description: "Stay in your cut or bulk window.",      category: "NUTRITION" as const, points: 15, frequency: "DAILY" as const,  proof: "SCREENSHOT" as const },
      { name: "Water goal",     description: "Drink at least one gallon.",            category: "NUTRITION" as const, points: 10, frequency: "DAILY" as const,  proof: "MANUAL" as const },
      { name: "Workout logged", description: "Log a full workout in your tracker.",   category: "GYM" as const,       points: 20, frequency: "DAILY" as const,  proof: "SCREENSHOT" as const },
      { name: "Seven hours",    description: "No excuses. Seven hours of sleep min.", category: "RECOVERY" as const,  points: 10, frequency: "DAILY" as const,  proof: "SCREENSHOT" as const },
      { name: "PR or weight target", description: "Hit a personal record or weight goal.", category: "GYM" as const,      points: 50, frequency: "WEEKLY" as const, proof: "VIDEO" as const },
      { name: "Progress check",      description: "Post a Sunday progress pic.",           category: "PROGRESS" as const, points: 30, frequency: "WEEKLY" as const, proof: "PHOTO" as const },
    ];

    for (const t of defaults) {
      await ctx.db.insert("tasks", {
        groupId,
        createdByUserId: userId,
        createdAt: now,
        ...t,
      });
    }
  },
});
