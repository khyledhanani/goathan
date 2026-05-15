import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const CODE_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateCode = (): string => {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += CODE_ALPHA[Math.floor(Math.random() * CODE_ALPHA.length)];
  }
  return s;
};

const handleFromName = (name: string): string =>
  "@" +
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 14) || "@you";

export const getMyMembership = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!m) return null;
    const group = await ctx.db.get(m.groupId);
    if (!group) return null;
    return {
      membership: m,
      group: { _id: group._id, name: group.name, inviteCode: group.inviteCode },
    };
  },
});

export const create = mutation({
  args: { name: v.string(), userId: v.id("users") },
  handler: async (ctx, { name, userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    let code = generateCode();
    let collision = await ctx.db
      .query("groups")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", code))
      .unique();
    let tries = 0;
    while (collision && tries < 8) {
      code = generateCode();
      collision = await ctx.db
        .query("groups")
        .withIndex("by_invite_code", (q) => q.eq("inviteCode", code))
        .unique();
      tries++;
    }
    if (collision) throw new Error("Could not generate invite code");

    const groupId: Id<"groups"> = await ctx.db.insert("groups", {
      name,
      inviteCode: code,
      createdAt: Date.now(),
    });

    await ctx.db.insert("memberships", {
      groupId,
      userId,
      isAdmin: true,
      handle: handleFromName(user.name),
      joinedAt: Date.now(),
    });

    return { groupId, inviteCode: code };
  },
});

export const join = mutation({
  args: { inviteCode: v.string(), userId: v.id("users") },
  handler: async (ctx, { inviteCode, userId }) => {
    const code = inviteCode.toUpperCase().trim();
    const group = await ctx.db
      .query("groups")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", code))
      .unique();
    if (!group) throw new Error("Invite code not found");

    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_group_user", (q) =>
        q.eq("groupId", group._id).eq("userId", userId),
      )
      .unique();
    if (existing) return { groupId: group._id };

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    await ctx.db.insert("memberships", {
      groupId: group._id,
      userId,
      isAdmin: false,
      handle: handleFromName(user.name),
      joinedAt: Date.now(),
    });

    return { groupId: group._id };
  },
});

export const getRoster = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();

    const out = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          membershipId: m._id,
          userId: m.userId,
          name: user?.name ?? "Unknown",
          handle: m.handle,
          isAdmin: m.isAdmin,
          joinedAt: m.joinedAt,
        };
      }),
    );

    return out;
  },
});
