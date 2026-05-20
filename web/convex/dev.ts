import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const DEFAULT_TASKS = [
  {
    name: "Make your bed",
    category: "MORNING" as const,
    points: 5,
    frequency: "DAILY" as const,
    proof: "PHOTO" as const,
    description: "Snap your made bed before you leave the room.",
  },
  {
    name: "Morning sunlight",
    category: "MORNING" as const,
    points: 10,
    frequency: "DAILY" as const,
    proof: "PHOTO" as const,
    description: "10+ minutes outside within an hour of waking.",
  },
  {
    name: "Workout or gym",
    category: "MOVE" as const,
    points: 25,
    frequency: "DAILY" as const,
    proof: "PHOTO" as const,
    description: "Photo at the gym or mid-workout.",
  },
  {
    name: "10k steps",
    category: "MOVE" as const,
    points: 15,
    frequency: "DAILY" as const,
    proof: "SCREENSHOT" as const,
    description: "Hit 10,000 steps before midnight.",
  },
  {
    name: "Mobility or stretch",
    category: "MOVE" as const,
    points: 10,
    frequency: "DAILY" as const,
    proof: "PHOTO" as const,
    description: "5+ minutes of mobility work.",
  },
  {
    name: "Protein 1g per lb",
    category: "FUEL" as const,
    points: 20,
    frequency: "DAILY" as const,
    proof: "SCREENSHOT" as const,
    description: "Hit your protein target.",
  },
  {
    name: "Home-cooked meal",
    category: "FUEL" as const,
    points: 15,
    frequency: "DAILY" as const,
    proof: "PHOTO" as const,
    description: "Cook yourself a real meal.",
  },
  {
    name: "Read or journal",
    category: "MIND" as const,
    points: 10,
    frequency: "DAILY" as const,
    proof: "PHOTO" as const,
    description: "20+ minutes of reading or writing.",
  },
  {
    name: "Seven hours sleep",
    category: "REST" as const,
    points: 10,
    frequency: "DAILY" as const,
    proof: "SCREENSHOT" as const,
    description: "Seven hours minimum.",
  },
  {
    name: "PR or weight target",
    category: "MOVE" as const,
    points: 50,
    frequency: "WEEKLY" as const,
    proof: "VIDEO" as const,
    description: "Hit a personal record or weight goal this week.",
  },
];

export const resetAndReseed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const comments = await ctx.db.query("comments").take(500);
    for (const c of comments) await ctx.db.delete(c._id);

    const challenges = await ctx.db.query("challenges").take(500);
    for (const c of challenges) await ctx.db.delete(c._id);

    const completions = await ctx.db.query("completions").take(500);
    for (const c of completions) {
      if (c.proofStorageId) await ctx.storage.delete(c.proofStorageId);
      if (c.proofR2Key) {
        await ctx.scheduler.runAfter(0, internal.r2.deleteObject, {
          key: c.proofR2Key,
        });
      }
      await ctx.db.delete(c._id);
    }

    const tasks = await ctx.db.query("tasks").take(500);
    for (const t of tasks) await ctx.db.delete(t._id);

    const groups = await ctx.db.query("groups").take(500);
    const now = Date.now();
    for (const g of groups) {
      for (const t of DEFAULT_TASKS) {
        await ctx.db.insert("tasks", {
          groupId: g._id,
          createdByUserId: g.createdByUserId,
          createdAt: now,
          ...t,
        });
      }
    }

    return {
      groupsSeeded: groups.length,
      tasksCreated: groups.length * DEFAULT_TASKS.length,
    };
  },
});
