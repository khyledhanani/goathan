import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    sessionId: v.string(),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),

  groups: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    createdAt: v.number(),
  }).index("by_invite_code", ["inviteCode"]),

  memberships: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    isAdmin: v.boolean(),
    handle: v.string(),
    joinedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_group", ["groupId"])
    .index("by_group_user", ["groupId", "userId"]),

  tasks: defineTable({
    groupId: v.id("groups"),
    name: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("GYM"),
      v.literal("CARDIO"),
      v.literal("NUTRITION"),
      v.literal("RECOVERY"),
      v.literal("PROGRESS"),
    ),
    points: v.number(),
    frequency: v.union(v.literal("DAILY"), v.literal("WEEKLY")),
    proof: v.union(
      v.literal("PHOTO"),
      v.literal("SCREENSHOT"),
      v.literal("MANUAL"),
      v.literal("VIDEO"),
    ),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  }).index("by_group", ["groupId"]),

  completions: defineTable({
    taskId: v.id("tasks"),
    userId: v.id("users"),
    groupId: v.id("groups"),
    points: v.number(),
    // YYYY-MM-DD for daily, YYYY-Www for weekly
    periodKey: v.string(),
    weekKey: v.string(),
    completedAt: v.number(),
  })
    .index("by_user_task_period", ["userId", "taskId", "periodKey"])
    .index("by_group_recent", ["groupId", "completedAt"])
    .index("by_user_week", ["userId", "weekKey"])
    .index("by_group_week", ["groupId", "weekKey"]),

  challenges: defineTable({
    completionId: v.id("completions"),
    challengerUserId: v.id("users"),
    groupId: v.id("groups"),
    createdAt: v.number(),
  })
    .index("by_completion", ["completionId"])
    .index("by_group_recent", ["groupId", "createdAt"]),
});
