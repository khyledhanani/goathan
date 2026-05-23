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
    anchorDate: v.optional(v.number()),
    anchorDayOfMonth: v.optional(v.number()),
    durationDays: v.optional(v.number()),
    repeat: v.optional(v.boolean()),
    cadence: v.optional(v.union(v.literal("monthly"))),
    stakeKind: v.optional(v.union(v.literal("PENALTY"), v.literal("REWARD"))),
    stakeText: v.optional(v.string()),
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

  groupInvites: defineTable({
    groupId: v.id("groups"),
    invitedUserId: v.id("users"),
    invitedByUserId: v.id("users"),
    status: v.union(
      v.literal("PENDING"),
      v.literal("ACCEPTED"),
      v.literal("DECLINED"),
    ),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_group_and_invited_user", ["groupId", "invitedUserId"])
    .index("by_invited_user_status", [
      "invitedUserId",
      "status",
      "createdAt",
    ]),

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
    proofR2Key: v.optional(v.string()),
    proofUrl: v.optional(v.string()),
    proofContentType: v.optional(v.string()),
    proofSizeBytes: v.optional(v.number()),
    proofAssetId: v.optional(v.id("proofAssets")),
    verifiedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    proofMeta: v.optional(
      v.object({
        captureTimeMs: v.optional(v.number()),
        software: v.optional(v.string()),
        cameraMake: v.optional(v.string()),
        cameraModel: v.optional(v.string()),
        lensModel: v.optional(v.string()),
        width: v.optional(v.number()),
        height: v.optional(v.number()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
      }),
    ),
  })
    .index("by_user_task_period", ["userId", "taskId", "periodKey"])
    .index("by_group_recent", ["groupId", "claimedAt"])
    .index("by_group_week", ["groupId", "weekKey"])
    .index("by_user_week", ["userId", "weekKey"])
    .index("by_user_recent", ["userId", "claimedAt"]),

  proofAssets: defineTable({
    userId: v.id("users"),
    r2Key: v.string(),
    contentType: v.string(),
    sizeBytes: v.number(),
    proofMeta: v.optional(
      v.object({
        captureTimeMs: v.optional(v.number()),
        software: v.optional(v.string()),
        cameraMake: v.optional(v.string()),
        cameraModel: v.optional(v.string()),
        lensModel: v.optional(v.string()),
        width: v.optional(v.number()),
        height: v.optional(v.number()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
      }),
    ),
    createdAt: v.number(),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_r2_key", ["r2Key"]),

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
    kind: v.optional(
      v.union(v.literal("HEART"), v.literal("FIRE"), v.literal("EYES")),
    ),
    createdAt: v.number(),
  })
    .index("by_completion", ["completionId"])
    .index("by_completion_and_user", ["completionId", "userId"])
    .index("by_user", ["userId"]),

  notifications: defineTable({
    userId: v.id("users"),
    kind: v.union(
      v.literal("LIKE"),
      v.literal("COMMENT"),
      v.literal("CAP_CALLED"),
      v.literal("CAP_REVOKED"),
      v.literal("CAP_RESTORED"),
      v.literal("MEDAL_AWARDED"),
      v.literal("MEMBER_JOINED"),
      v.literal("GROUP_INVITE"),
      v.literal("DAILY_RESET_REMINDER"),
      v.literal("FIRST_RECEIPT"),
    ),
    actorUserId: v.optional(v.id("users")),
    groupId: v.optional(v.id("groups")),
    completionId: v.optional(v.id("completions")),
    commentId: v.optional(v.id("comments")),
    medalKey: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
    deepLinkPath: v.string(),
    dedupeKey: v.string(),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
    pushDispatchStartedAt: v.optional(v.number()),
    pushDispatchCompletedAt: v.optional(v.number()),
    pushDeliveredCount: v.optional(v.number()),
    pushFailedCount: v.optional(v.number()),
  })
    .index("by_user_recent", ["userId", "createdAt"])
    .index("by_user_unread", ["userId", "readAt"])
    .index("by_user_dedupe", ["userId", "dedupeKey"]),

  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.number(),
    failureCount: v.number(),
    lastError: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  notificationPreferences: defineTable({
    userId: v.id("users"),
    mutedKinds: v.array(v.string()),
    pushEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  proofVerifications: defineTable({
    completionId: v.id("completions"),
    status: v.union(
      v.literal("PENDING"),
      v.literal("PASSED"),
      v.literal("INCONCLUSIVE"),
      v.literal("FAILED"),
      v.literal("ERROR"),
      v.literal("SKIPPED"),
    ),
    confidence: v.optional(v.number()),
    reasoning: v.optional(v.string()),
    flags: v.optional(v.array(v.string())),
    provider: v.string(),
    model: v.string(),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    estimatedCostUsd: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_completion", ["completionId"])
    .index("by_status_created", ["status", "createdAt"]),

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
