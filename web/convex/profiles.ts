import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mainGoalValidator } from "./schema";

async function requireAuthUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

async function findProfileByUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"profiles"> | null> {
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

function normalizeUsername(raw: string): string {
  const u = raw.trim().toLowerCase();
  if (!u) throw new Error("Username is required");
  if (!/^[a-z0-9_.]{2,20}$/.test(u)) {
    throw new Error("Username must be 2–20 chars (a–z, 0–9, _ or .)");
  }
  return u;
}

async function assertUsernameAvailable(
  ctx: MutationCtx,
  username: string,
  selfProfileId: Id<"profiles">,
) {
  const taken = await ctx.db
    .query("profiles")
    .withIndex("by_username", (q) => q.eq("username", username))
    .unique();
  if (taken && taken._id !== selfProfileId) {
    throw new Error("That username is taken");
  }
}

export const getCurrentProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await findProfileByUser(ctx, userId);
  },
});

export const upsertCurrentProfileFromAuth = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userDoc = await ctx.db.get(userId);
    const existing = await findProfileByUser(ctx, userId);
    const now = Date.now();

    const name = userDoc?.name ?? identity.name ?? "";
    const email = userDoc?.email ?? identity.email ?? "";
    const avatarUrl =
      userDoc?.image ?? (identity.pictureUrl as string | undefined) ?? undefined;

    if (existing) {
      const patch: Partial<Doc<"profiles">> = { updatedAt: now };
      if (!existing.email && email) patch.email = email;
      if (!existing.avatarUrl && avatarUrl) patch.avatarUrl = avatarUrl;
      if (!existing.displayName && name) patch.displayName = name;
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      userId,
      tokenIdentifier: identity.tokenIdentifier,
      email,
      displayName: name || email.split("@")[0] || "You",
      avatarUrl,
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateOnboardingProfile = mutation({
  args: {
    displayName: v.string(),
    username: v.string(),
    mainGoal: v.optional(mainGoalValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const profile = await findProfileByUser(ctx, userId);
    if (!profile) throw new Error("Profile not found");

    const displayName = args.displayName.trim();
    if (!displayName) throw new Error("Display name is required");

    const username = normalizeUsername(args.username);
    await assertUsernameAvailable(ctx, username, profile._id);

    await ctx.db.patch(profile._id, {
      displayName,
      username,
      mainGoal: args.mainGoal,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const completeOnboarding = mutation({
  args: {
    displayName: v.string(),
    username: v.string(),
    mainGoal: v.optional(mainGoalValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const profile = await findProfileByUser(ctx, userId);
    if (!profile) throw new Error("Profile not found");

    const displayName = args.displayName.trim();
    if (!displayName) throw new Error("Display name is required");

    const username = normalizeUsername(args.username);
    await assertUsernameAvailable(ctx, username, profile._id);

    await ctx.db.patch(profile._id, {
      displayName,
      username,
      mainGoal: args.mainGoal,
      onboardingCompleted: true,
      updatedAt: Date.now(),
    });

    return null;
  },
});
