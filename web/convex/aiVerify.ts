import {
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const STALE_CLAIM_MS = 60_000;

export const claim = internalMutation({
  args: { completionId: v.id("completions") },
  handler: async (ctx, { completionId }) => {
    const existing = await ctx.db
      .query("proofVerifications")
      .withIndex("by_completion", (q) => q.eq("completionId", completionId))
      .unique();

    const now = Date.now();
    if (!existing) {
      const id = await ctx.db.insert("proofVerifications", {
        completionId,
        status: "PENDING",
        provider: "gemini",
        model: "gemini-2.5-flash",
        startedAt: now,
        createdAt: now,
      });
      return { ok: true as const, verificationId: id };
    }

    if (existing.completedAt !== undefined) {
      return { ok: false as const, reason: "completed" } as const;
    }
    if (
      existing.startedAt !== undefined &&
      now - existing.startedAt < STALE_CLAIM_MS
    ) {
      return { ok: false as const, reason: "in_flight" } as const;
    }
    await ctx.db.patch(existing._id, { startedAt: now });
    return { ok: true as const, verificationId: existing._id };
  },
});

export const getCompletion = internalQuery({
  args: { completionId: v.id("completions") },
  handler: async (ctx, { completionId }) => {
    const c = await ctx.db.get(completionId);
    if (!c) return null;
    const proofAsset = c.proofAssetId ? await ctx.db.get(c.proofAssetId) : null;
    return {
      claimedAt: c.claimedAt,
      proofMeta: proofAsset?.proofMeta ?? c.proofMeta ?? null,
    };
  },
});

export const getContext = internalQuery({
  args: { completionId: v.id("completions") },
  handler: async (ctx, { completionId }) => {
    const completion = await ctx.db.get(completionId);
    if (!completion) return null;
    const task = await ctx.db.get(completion.taskId);
    if (!task) return null;
    const proofAsset = completion.proofAssetId
      ? await ctx.db.get(completion.proofAssetId)
      : null;
    const proofUrl = completion.proofStorageId
      ? await ctx.storage.getUrl(completion.proofStorageId)
      : null;
    return {
      completionId,
      revokedAt: completion.revokedAt ?? null,
      proofUrl,
      proofR2Key: proofAsset?.r2Key ?? completion.proofR2Key ?? null,
      taskName: task.name,
      taskDescription: task.description ?? null,
      proofType: task.proof,
      frequency: task.frequency,
      proofMeta: proofAsset?.proofMeta ?? completion.proofMeta ?? null,
    };
  },
});

export const complete = internalMutation({
  args: {
    completionId: v.id("completions"),
    status: v.union(
      v.literal("PASSED"),
      v.literal("INCONCLUSIVE"),
      v.literal("FAILED"),
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("proofVerifications")
      .withIndex("by_completion", (q) =>
        q.eq("completionId", args.completionId),
      )
      .unique();
    if (!existing) return;
    if (existing.completedAt !== undefined) return;
    await ctx.db.patch(existing._id, {
      status: args.status,
      confidence: args.confidence,
      reasoning: args.reasoning,
      flags: args.flags,
      provider: args.provider,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      estimatedCostUsd: args.estimatedCostUsd,
      durationMs: args.durationMs,
      completedAt: Date.now(),
    });
  },
});

export const recordError = internalMutation({
  args: {
    completionId: v.id("completions"),
    error: v.string(),
  },
  handler: async (ctx, { completionId, error }) => {
    const existing = await ctx.db
      .query("proofVerifications")
      .withIndex("by_completion", (q) => q.eq("completionId", completionId))
      .unique();
    const now = Date.now();
    if (!existing) {
      await ctx.db.insert("proofVerifications", {
        completionId,
        status: "ERROR",
        provider: "gemini",
        model: "gemini-2.5-flash",
        errorMessage: error.slice(0, 200),
        startedAt: now,
        completedAt: now,
        createdAt: now,
      });
      return;
    }
    if (existing.completedAt !== undefined) return;
    await ctx.db.patch(existing._id, {
      status: "ERROR",
      errorMessage: error.slice(0, 200),
      completedAt: now,
    });
  },
});

export const debugRecentUploads = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("completions").take(80);
    const recent = all
      .filter((c) => c.verifiedAt !== undefined)
      .sort((a, b) => (b.verifiedAt ?? 0) - (a.verifiedAt ?? 0))
      .slice(0, 25);

    return Promise.all(
      recent.map(async (c) => {
        const task = await ctx.db.get(c.taskId);
        const group = await ctx.db.get(c.groupId);
        const v = await ctx.db
          .query("proofVerifications")
          .withIndex("by_completion", (q) => q.eq("completionId", c._id))
          .unique();
        return {
          completionId: c._id,
          groupName: group?.name ?? "(removed)",
          taskName: task?.name ?? "(removed)",
          frequency: task?.frequency ?? "?",
          verifiedAt: c.verifiedAt
            ? new Date(c.verifiedAt).toISOString()
            : null,
          revokedAt: c.revokedAt
            ? new Date(c.revokedAt).toISOString()
            : null,
          hasProofStorage: !!c.proofStorageId,
          hasProofAsset: !!c.proofAssetId,
          verification: v
            ? {
                status: v.status,
                startedAt: v.startedAt
                  ? new Date(v.startedAt).toISOString()
                  : null,
                completedAt: v.completedAt
                  ? new Date(v.completedAt).toISOString()
                  : null,
                errorMessage: v.errorMessage ?? null,
                model: v.model,
                reasoning: v.reasoning ?? null,
                inputTokens: v.inputTokens ?? null,
                outputTokens: v.outputTokens ?? null,
              }
            : "NO_VERIFICATION_ROW",
        };
      }),
    );
  },
});

export const forCompletion = query({
  args: { completionId: v.id("completions") },
  handler: async (ctx, { completionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const v = await ctx.db
      .query("proofVerifications")
      .withIndex("by_completion", (q) => q.eq("completionId", completionId))
      .unique();
    if (!v) return null;
    return {
      status: v.status,
      confidence: v.confidence ?? null,
      reasoning: v.reasoning ?? null,
      flags: v.flags ?? [],
    };
  },
});
