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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_token_identifier", ["tokenIdentifier"])
    .index("by_username", ["username"]),
});
