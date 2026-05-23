import {
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { periodKeyFor, groupPeriodBounds } from "./lib/period";

export const VERIFICATION_WINDOW_MS = 15 * 60 * 1000;
const MAX_PROOF_UPLOAD_BYTES = 1_250_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const proofMetaValidator = v.object({
  captureTimeMs: v.optional(v.number()),
  software: v.optional(v.string()),
  cameraMake: v.optional(v.string()),
  cameraModel: v.optional(v.string()),
  lensModel: v.optional(v.string()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
});

function normalizeContentType(contentType: string): string {
  return contentType === "image/jpg" ? "image/jpeg" : contentType;
}

function isBasketProofTask(task: { proof: "PHOTO" | "SCREENSHOT" | "VIDEO" }) {
  return task.proof === "PHOTO" || task.proof === "SCREENSHOT";
}

async function isMember(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">,
  userId: Id<"users">,
) {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_group_and_user", (q) =>
      q.eq("groupId", groupId).eq("userId", userId),
    )
    .unique();
  return membership !== null;
}

async function hasCompletionThisPeriod(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  taskId: Id<"tasks">,
  periodKey: string,
) {
  const existing = await ctx.db
    .query("completions")
    .withIndex("by_user_task_period", (q) =>
      q.eq("userId", userId).eq("taskId", taskId).eq("periodKey", periodKey),
    )
    .unique();
  return existing !== null;
}

export const claimBasketOptions = query({
  args: {
    startingTaskId: v.optional(v.id("tasks")),
    completionId: v.optional(v.id("completions")),
  },
  handler: async (ctx, { startingTaskId, completionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { groups: [] };

    let resolvedTaskId: Id<"tasks">;
    if (completionId) {
      const completion = await ctx.db.get(completionId);
      if (!completion) throw new ConvexError("Completion not found");
      if (completion.userId !== userId) throw new ConvexError("Not yours");
      resolvedTaskId = completion.taskId;
    } else if (startingTaskId) {
      resolvedTaskId = startingTaskId;
    } else {
      throw new ConvexError("Provide startingTaskId or completionId");
    }

    const startingTask = await ctx.db.get(resolvedTaskId);
    if (!startingTask) throw new ConvexError("Task not found");
    if (!isBasketProofTask(startingTask)) {
      throw new ConvexError("Basket proof only supports image tasks");
    }
    if (!(await isMember(ctx, startingTask.groupId, userId))) {
      throw new ConvexError("Not a member of this group");
    }

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();

    const groups = await Promise.all(
      memberships.map(async (membership) => {
        const group = await ctx.db.get(membership.groupId);
        if (!group) return null;
        const groupPeriod = groupPeriodBounds(group, now);
        if (groupPeriod.ended) return null;

        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect();

        const availableTasks = [];
        for (const task of tasks) {
          if (!isBasketProofTask(task)) continue;
          const pk = periodKeyFor(task.frequency, now);
          // Include the starting task even if already claimed (it will be verified)
          if (task._id !== resolvedTaskId && await hasCompletionThisPeriod(ctx, userId, task._id, pk)) {
            continue;
          }
          availableTasks.push({
            _id: task._id,
            groupId: group._id,
            name: task.name,
            description: task.description ?? null,
            category: task.category,
            points: task.points,
            frequency: task.frequency,
            proof: task.proof,
          });
        }

        if (availableTasks.length === 0) return null;
        availableTasks.sort((a, b) => {
          if (a._id === resolvedTaskId) return -1;
          if (b._id === resolvedTaskId) return 1;
          if (a.frequency !== b.frequency) return a.frequency === "DAILY" ? -1 : 1;
          return b.points - a.points;
        });

        return {
          groupId: group._id,
          groupName: group.name,
          tasks: availableTasks,
        };
      }),
    );

    return {
      groups: groups
        .filter((group): group is NonNullable<typeof group> => group !== null)
        .sort((a, b) => {
          if (a.groupId === startingTask.groupId) return -1;
          if (b.groupId === startingTask.groupId) return 1;
          return a.groupName.localeCompare(b.groupName);
        }),
    };
  },
});

export const submitProofBasket = mutation({
  args: {
    taskIds: v.array(v.id("tasks")),
    r2Key: v.string(),
    contentType: v.string(),
    sizeBytes: v.number(),
    proofMeta: v.optional(proofMetaValidator),
  },
  handler: async (
    ctx,
    { taskIds, r2Key, contentType, sizeBytes, proofMeta },
  ) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const uniqueTaskIds = Array.from(new Set(taskIds)).slice(0, 40);
    if (uniqueTaskIds.length === 0) {
      return { ok: false as const, error: "Choose at least one task" };
    }

    const normalizedContentType = normalizeContentType(contentType);
    if (!ALLOWED_IMAGE_TYPES.has(normalizedContentType)) {
      return { ok: false as const, error: "Only image proofs are supported" };
    }
    if (sizeBytes <= 0 || sizeBytes > MAX_PROOF_UPLOAD_BYTES) {
      return { ok: false as const, error: "Image is too large. Try a smaller photo." };
    }
    if (!r2Key.startsWith(`proofs/shared/${userId}/`)) {
      throw new ConvexError("Invalid proof key");
    }

    const existingAsset = await ctx.db
      .query("proofAssets")
      .withIndex("by_r2_key", (q) => q.eq("r2Key", r2Key))
      .unique();
    if (existingAsset) {
      return { ok: false as const, error: "This proof was already submitted" };
    }

    const now = Date.now();
    const rows: Array<{
      taskId: Id<"tasks">;
      groupId: Id<"groups">;
      periodKey: string;
      weekKey: string;
      points: number;
      frequency: "DAILY" | "WEEKLY";
    }> = [];

    for (const taskId of uniqueTaskIds) {
      const task = await ctx.db.get(taskId);
      if (!task) return { ok: false as const, error: "A selected task no longer exists" };
      if (!isBasketProofTask(task)) {
        return { ok: false as const, error: `${task.name} does not accept image proof` };
      }
      if (!(await isMember(ctx, task.groupId, userId))) {
        throw new ConvexError("Not a member of one selected group");
      }

      const pk = periodKeyFor(task.frequency, now);
      if (await hasCompletionThisPeriod(ctx, userId, task._id, pk)) {
        return { ok: false as const, error: `${task.name} is already claimed this period` };
      }

      const group = await ctx.db.get(task.groupId);
      if (!group) return { ok: false as const, error: "A selected group no longer exists" };
      const groupPeriod = groupPeriodBounds(group, now);
      if (groupPeriod.ended) {
        return { ok: false as const, error: `${task.name} is in an ended comp` };
      }
      rows.push({
        taskId: task._id,
        groupId: task.groupId,
        periodKey: pk,
        weekKey: groupPeriod.periodKey,
        points: task.points,
        frequency: task.frequency,
      });
    }

    const proofAssetId = await ctx.db.insert("proofAssets", {
      userId,
      r2Key,
      contentType: normalizedContentType,
      sizeBytes,
      proofMeta,
      createdAt: now,
    });

    const completionIds: Id<"completions">[] = [];
    for (const row of rows) {
      const completionId = await ctx.db.insert("completions", {
        taskId: row.taskId,
        userId,
        groupId: row.groupId,
        periodKey: row.periodKey,
        weekKey: row.weekKey,
        points: row.points,
        claimedAt: now,
        verifiedAt: now,
        proofAssetId,
      });
      completionIds.push(completionId);
      if (row.frequency !== "WEEKLY") {
        await ctx.scheduler.runAfter(0, internal.aiVerifyAction.checkProof, {
          completionId,
        });
      }
    }

    return { ok: true as const, completionIds };
  },
});

export const verifyWithBasket = mutation({
  args: {
    completionId: v.id("completions"),
    additionalTaskIds: v.array(v.id("tasks")),
    r2Key: v.string(),
    contentType: v.string(),
    sizeBytes: v.number(),
    proofMeta: v.optional(proofMetaValidator),
  },
  handler: async (
    ctx,
    { completionId, additionalTaskIds, r2Key, contentType, sizeBytes, proofMeta },
  ) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const completion = await ctx.db.get(completionId);
    if (!completion) throw new ConvexError("Completion not found");
    if (completion.userId !== userId) throw new ConvexError("Not yours");

    const now = Date.now();
    if (now > completion.claimedAt + VERIFICATION_WINDOW_MS) {
      return { ok: false as const, error: "Verification window expired" };
    }
    if (completion.verifiedAt !== undefined) {
      return { ok: false as const, error: "Already verified" };
    }

    const normalizedContentType = normalizeContentType(contentType);
    if (!ALLOWED_IMAGE_TYPES.has(normalizedContentType)) {
      return { ok: false as const, error: "Only image proofs are supported" };
    }
    if (sizeBytes <= 0 || sizeBytes > MAX_PROOF_UPLOAD_BYTES) {
      return { ok: false as const, error: "Image is too large. Try a smaller photo." };
    }
    if (!r2Key.startsWith(`proofs/shared/${userId}/`)) {
      throw new ConvexError("Invalid proof key");
    }

    const existingAsset = await ctx.db
      .query("proofAssets")
      .withIndex("by_r2_key", (q) => q.eq("r2Key", r2Key))
      .unique();
    if (existingAsset) {
      return { ok: false as const, error: "This proof was already submitted" };
    }

    // Validate additional tasks
    const uniqueAdditional = Array.from(
      new Set(additionalTaskIds.filter((id) => id !== completion.taskId)),
    ).slice(0, 39);

    const extraRows: Array<{
      taskId: Id<"tasks">;
      groupId: Id<"groups">;
      periodKey: string;
      weekKey: string;
      points: number;
      frequency: "DAILY" | "WEEKLY";
    }> = [];

    for (const taskId of uniqueAdditional) {
      const task = await ctx.db.get(taskId);
      if (!task) return { ok: false as const, error: "A selected task no longer exists" };
      if (!isBasketProofTask(task)) {
        return { ok: false as const, error: `${task.name} does not accept image proof` };
      }
      if (!(await isMember(ctx, task.groupId, userId))) {
        throw new ConvexError("Not a member of one selected group");
      }

      const pk = periodKeyFor(task.frequency, now);
      if (await hasCompletionThisPeriod(ctx, userId, task._id, pk)) {
        return { ok: false as const, error: `${task.name} is already claimed this period` };
      }

      const group = await ctx.db.get(task.groupId);
      if (!group) return { ok: false as const, error: "A selected group no longer exists" };
      const groupPeriod = groupPeriodBounds(group, now);
      if (groupPeriod.ended) {
        return { ok: false as const, error: `${task.name} is in an ended comp` };
      }
      extraRows.push({
        taskId: task._id,
        groupId: task.groupId,
        periodKey: pk,
        weekKey: groupPeriod.periodKey,
        points: task.points,
        frequency: task.frequency,
      });
    }

    // Create shared proof asset
    const proofAssetId = await ctx.db.insert("proofAssets", {
      userId,
      r2Key,
      contentType: normalizedContentType,
      sizeBytes,
      proofMeta,
      createdAt: now,
    });

    // Verify the existing completion
    if (completion.proofStorageId) {
      await ctx.storage.delete(completion.proofStorageId);
    }
    if (completion.proofR2Key) {
      await ctx.scheduler.runAfter(0, internal.r2.deleteObject, {
        key: completion.proofR2Key,
      });
    }
    await ctx.db.patch(completion._id, {
      proofStorageId: undefined,
      proofR2Key: undefined,
      proofUrl: undefined,
      proofContentType: undefined,
      proofSizeBytes: undefined,
      proofAssetId,
      verifiedAt: now,
      proofMeta,
    });

    const startingTask = await ctx.db.get(completion.taskId);
    if (startingTask && startingTask.frequency !== "WEEKLY") {
      await ctx.scheduler.runAfter(0, internal.aiVerifyAction.checkProof, {
        completionId: completion._id,
      });
    }

    // Claim + verify additional tasks
    const allCompletionIds: Id<"completions">[] = [completion._id];
    for (const row of extraRows) {
      const newCompletionId = await ctx.db.insert("completions", {
        taskId: row.taskId,
        userId,
        groupId: row.groupId,
        periodKey: row.periodKey,
        weekKey: row.weekKey,
        points: row.points,
        claimedAt: now,
        verifiedAt: now,
        proofAssetId,
      });
      allCompletionIds.push(newCompletionId);
      if (row.frequency !== "WEEKLY") {
        await ctx.scheduler.runAfter(0, internal.aiVerifyAction.checkProof, {
          completionId: newCompletionId,
        });
      }
    }

    return { ok: true as const, completionIds: allCompletionIds };
  },
});

export const claim = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const task = await ctx.db.get(taskId);
    if (!task) throw new ConvexError("Task not found");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", task.groupId).eq("userId", userId),
      )
      .unique();
    if (!membership) throw new ConvexError("Not a member of this group");

    const now = Date.now();
    const pk = periodKeyFor(task.frequency, now);

    const existing = await ctx.db
      .query("completions")
      .withIndex("by_user_task_period", (q) =>
        q.eq("userId", userId).eq("taskId", taskId).eq("periodKey", pk),
      )
      .unique();
    if (existing) {
      return { ok: false as const, error: "Already claimed this period" };
    }

    const group = await ctx.db.get(task.groupId);
    const { periodKey } = groupPeriodBounds(group ?? {}, now);

    const completionId = await ctx.db.insert("completions", {
      taskId,
      userId,
      groupId: task.groupId,
      periodKey: pk,
      weekKey: periodKey,
      points: task.points,
      claimedAt: now,
    });

    return { ok: true as const, completionId };
  },
});

export const unclaim = mutation({
  args: { completionId: v.id("completions") },
  handler: async (ctx, { completionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const completion = await ctx.db.get(completionId);
    if (!completion) return { ok: false as const, error: "Already gone" };
    if (completion.userId !== userId) {
      throw new ConvexError("Not yours to unclaim");
    }

    const linkedChallenges = await ctx.db
      .query("challenges")
      .withIndex("by_completion", (q) => q.eq("completionId", completion._id))
      .collect();
    for (const ch of linkedChallenges) await ctx.db.delete(ch._id);

    const linkedComments = await ctx.db
      .query("comments")
      .withIndex("by_completion", (q) => q.eq("completionId", completion._id))
      .collect();
    for (const cm of linkedComments) await ctx.db.delete(cm._id);

    if (completion.proofStorageId) {
      await ctx.storage.delete(completion.proofStorageId);
    }
    if (completion.proofR2Key) {
      await ctx.scheduler.runAfter(0, internal.r2.deleteObject, {
        key: completion.proofR2Key,
      });
    }

    await ctx.db.delete(completion._id);
    return { ok: true as const };
  },
});

export const generateProofUploadUrl = mutation({
  args: { completionId: v.id("completions") },
  handler: async (ctx, { completionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const completion = await ctx.db.get(completionId);
    if (!completion) throw new ConvexError("Completion not found");
    if (completion.userId !== userId) {
      throw new ConvexError("Not yours");
    }
    if (Date.now() > completion.claimedAt + VERIFICATION_WINDOW_MS) {
      return { ok: false as const, error: "Verification window expired" };
    }

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { ok: true as const, uploadUrl };
  },
});

export const getR2ProofUploadContext = internalQuery({
  args: { completionId: v.id("completions"), userId: v.id("users") },
  handler: async (ctx, { completionId, userId }) => {
    const completion = await ctx.db.get(completionId);
    if (!completion) {
      return { ok: false as const, error: "Completion not found" };
    }
    if (completion.userId !== userId) {
      return { ok: false as const, error: "Not yours" };
    }
    if (Date.now() > completion.claimedAt + VERIFICATION_WINDOW_MS) {
      return { ok: false as const, error: "Verification window expired" };
    }
    return { ok: true as const };
  },
});

export const getR2ProofReadContexts = internalQuery({
  args: {
    completionIds: v.array(v.id("completions")),
    userId: v.id("users"),
  },
  handler: async (ctx, { completionIds, userId }) => {
    const uniqueIds = Array.from(new Set(completionIds)).slice(0, 120);
    const out: Array<{
      completionId: Id<"completions">;
      key: string;
      contentType?: string;
    }> = [];

    for (const completionId of uniqueIds) {
      const completion = await ctx.db.get(completionId);
      if (!completion) continue;
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_group_and_user", (q) =>
          q.eq("groupId", completion.groupId).eq("userId", userId),
        )
        .unique();
      if (!membership) continue;
      const proofAsset = completion.proofAssetId
        ? await ctx.db.get(completion.proofAssetId)
        : null;
      const key = proofAsset?.r2Key ?? completion.proofR2Key;
      if (!key) continue;
      out.push({
        completionId,
        key,
        contentType: proofAsset?.contentType ?? completion.proofContentType,
      });
    }
    return out;
  },
});

export const attachProof = mutation({
  args: {
    completionId: v.id("completions"),
    storageId: v.id("_storage"),
    proofMeta: v.optional(proofMetaValidator),
  },
  handler: async (ctx, { completionId, storageId, proofMeta }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const completion = await ctx.db.get(completionId);
    if (!completion) throw new ConvexError("Completion not found");
    if (completion.userId !== userId) {
      throw new ConvexError("Not yours");
    }

    const now = Date.now();
    if (now > completion.claimedAt + VERIFICATION_WINDOW_MS) {
      await ctx.storage.delete(storageId);
      return { ok: false as const, error: "Verification window expired" };
    }

    if (completion.proofStorageId) {
      await ctx.storage.delete(completion.proofStorageId);
    }
    if (completion.proofR2Key) {
      await ctx.scheduler.runAfter(0, internal.r2.deleteObject, {
        key: completion.proofR2Key,
      });
    }

    await ctx.db.patch(completion._id, {
      proofStorageId: storageId,
      proofR2Key: undefined,
      proofUrl: undefined,
      proofContentType: undefined,
      proofSizeBytes: undefined,
      proofAssetId: undefined,
      verifiedAt: now,
      proofMeta,
    });

    const task = await ctx.db.get(completion.taskId);
    if (task && task.frequency !== "WEEKLY") {
      await ctx.scheduler.runAfter(0, internal.aiVerifyAction.checkProof, {
        completionId,
      });
    }

    return { ok: true as const };
  },
});

export const attachR2Proof = mutation({
  args: {
    completionId: v.id("completions"),
    r2Key: v.string(),
    contentType: v.string(),
    sizeBytes: v.number(),
    proofMeta: v.optional(proofMetaValidator),
  },
  handler: async (ctx, { completionId, r2Key, contentType, sizeBytes, proofMeta }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const completion = await ctx.db.get(completionId);
    if (!completion) throw new ConvexError("Completion not found");
    if (completion.userId !== userId) {
      throw new ConvexError("Not yours");
    }

    const now = Date.now();
    if (now > completion.claimedAt + VERIFICATION_WINDOW_MS) {
      await ctx.scheduler.runAfter(0, internal.r2.deleteObject, { key: r2Key });
      return { ok: false as const, error: "Verification window expired" };
    }
    if (!r2Key.startsWith(`proofs/${completionId}/`)) {
      throw new ConvexError("Invalid proof key");
    }
    if (!contentType.startsWith("image/")) {
      await ctx.scheduler.runAfter(0, internal.r2.deleteObject, { key: r2Key });
      return { ok: false as const, error: "Only images are supported right now" };
    }

    if (completion.proofStorageId) {
      await ctx.storage.delete(completion.proofStorageId);
    }
    if (completion.proofR2Key && completion.proofR2Key !== r2Key) {
      await ctx.scheduler.runAfter(0, internal.r2.deleteObject, {
        key: completion.proofR2Key,
      });
    }

    await ctx.db.patch(completion._id, {
      proofStorageId: undefined,
      proofR2Key: r2Key,
      proofUrl: undefined,
      proofContentType: contentType,
      proofSizeBytes: sizeBytes,
      proofAssetId: undefined,
      verifiedAt: now,
      proofMeta,
    });

    const task = await ctx.db.get(completion.taskId);
    if (task && task.frequency !== "WEEKLY") {
      await ctx.scheduler.runAfter(0, internal.aiVerifyAction.checkProof, {
        completionId,
      });
    }

    return { ok: true as const };
  },
});

export const removeProof = mutation({
  args: { completionId: v.id("completions") },
  handler: async (ctx, { completionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const completion = await ctx.db.get(completionId);
    if (!completion) throw new ConvexError("Completion not found");
    if (completion.userId !== userId) {
      throw new ConvexError("Not yours");
    }

    if (completion.proofStorageId) {
      await ctx.storage.delete(completion.proofStorageId);
    }
    if (completion.proofR2Key) {
      await ctx.scheduler.runAfter(0, internal.r2.deleteObject, {
        key: completion.proofR2Key,
      });
    }
    await ctx.db.patch(completion._id, {
      proofStorageId: undefined,
      proofR2Key: undefined,
      proofUrl: undefined,
      proofContentType: undefined,
      proofSizeBytes: undefined,
      proofAssetId: undefined,
      verifiedAt: undefined,
    });
    return { ok: true as const };
  },
});
