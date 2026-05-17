import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const mainGoalValidator = v.union(
  v.literal("STRONGER"),
  v.literal("LOSE_FAT"),
  v.literal("CONSISTENCY"),
  v.literal("COMPETE"),
  v.literal("HEALTH"),
);

export default defineSchema({
  ...authTables,

  profiles: defineTable({
    userId: v.id("users"),
    tokenIdentifier: v.string(),
    email: v.string(),
    displayName: v.string(),
    username: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    mainGoal: v.optional(mainGoalValidator),
    onboardingCompleted: v.boolean(),
    lastSeenFeedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_username", ["username"]),

  groups: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  }).index("by_invite_code", ["inviteCode"]),

  memberships: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    isAdmin: v.boolean(),
    joinedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_group", ["groupId"])
    .index("by_group_and_user", ["groupId", "userId"]),

  tasks: defineTable({
    groupId: v.id("groups"),
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
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  }).index("by_group", ["groupId"]),

  completions: defineTable({
    taskId: v.id("tasks"),
    userId: v.id("users"),
    groupId: v.id("groups"),
    periodKey: v.string(),
    weekKey: v.string(),
    points: v.number(),
    claimedAt: v.number(),
    proofStorageId: v.optional(v.id("_storage")),
    verifiedAt: v.optional(v.number()),
  })
    .index("by_user_task_period", ["userId", "taskId", "periodKey"])
    .index("by_group_recent", ["groupId", "claimedAt"])
    .index("by_group_week", ["groupId", "weekKey"])
    .index("by_user_week", ["userId", "weekKey"]),

  challenges: defineTable({
    completionId: v.id("completions"),
    challengerUserId: v.id("users"),
    groupId: v.id("groups"),
    createdAt: v.number(),
  })
    .index("by_completion", ["completionId"])
    .index("by_completion_and_challenger", ["completionId", "challengerUserId"])
    .index("by_group_recent", ["groupId", "createdAt"]),

  comments: defineTable({
    completionId: v.id("completions"),
    authorUserId: v.id("users"),
    groupId: v.id("groups"),
    body: v.string(),
    createdAt: v.number(),
  })
    .index("by_completion", ["completionId", "createdAt"])
    .index("by_group_recent", ["groupId", "createdAt"]),

  likes: defineTable({
    completionId: v.id("completions"),
    userId: v.id("users"),
    groupId: v.id("groups"),
    createdAt: v.number(),
  })
    .index("by_completion", ["completionId"])
    .index("by_completion_and_user", ["completionId", "userId"])
    .index("by_user", ["userId"]),

  weekResults: defineTable({
    groupId: v.id("groups"),
    groupName: v.string(),
    weekKey: v.string(),
    userId: v.id("users"),
    rank: v.number(),
    weekPoints: v.number(),
    medal: v.union(
      v.literal("GOLD"),
      v.literal("SILVER"),
      v.literal("BRONZE"),
    ),
    weekEndMs: v.number(),
    finalizedAt: v.number(),
  })
    .index("by_user_end", ["userId", "weekEndMs"])
    .index("by_group_week", ["groupId", "weekKey"])
    .index("by_user_medal", ["userId", "medal"]),
});
