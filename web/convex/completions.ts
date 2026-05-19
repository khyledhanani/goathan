import { mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { periodKeyFor, groupPeriodBounds } from "./lib/period";

export const VERIFICATION_WINDOW_MS = 15 * 60 * 1000;

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

    await ctx.db.patch(completion._id, {
      proofStorageId: storageId,
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
    await ctx.db.patch(completion._id, {
      proofStorageId: undefined,
      verifiedAt: undefined,
    });
    return { ok: true as const };
  },
});
