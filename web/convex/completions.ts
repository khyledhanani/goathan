import { internalQuery, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { periodKeyFor, groupPeriodBounds } from "./lib/period";

export const VERIFICATION_WINDOW_MS = 15 * 60 * 1000;

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
      if (!completion?.proofR2Key) continue;
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_group_and_user", (q) =>
          q.eq("groupId", completion.groupId).eq("userId", userId),
        )
        .unique();
      if (!membership) continue;
      out.push({
        completionId,
        key: completion.proofR2Key,
        contentType: completion.proofContentType,
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
      verifiedAt: undefined,
    });
    return { ok: true as const };
  },
});
