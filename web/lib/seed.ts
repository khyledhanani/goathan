import type { Category, FeedItem, Frequency, Member, Proof, Task } from "./types";

export const SEED_TASKS: Task[] = [
  { id: "t1", name: "Gym check-in",   description: "Scan in at the gym. Geofenced.",          category: "GYM",       points: 25, frequency: "DAILY", proof: "PHOTO" },
  { id: "t2", name: "10K steps",      description: "Hit 10,000 steps before midnight.",       category: "CARDIO",    points: 15, frequency: "DAILY", proof: "SCREENSHOT" },
  { id: "t3", name: "Protein goal",   description: "Hit 1g per pound bodyweight.",            category: "NUTRITION", points: 20, frequency: "DAILY", proof: "SCREENSHOT" },
  { id: "t4", name: "Calorie target", description: "Stay in your cut or bulk window.",        category: "NUTRITION", points: 15, frequency: "DAILY", proof: "SCREENSHOT" },
  { id: "t5", name: "Water goal",     description: "Drink at least one gallon.",              category: "NUTRITION", points: 10, frequency: "DAILY", proof: "MANUAL" },
  { id: "t6", name: "Workout logged", description: "Log a full workout in your tracker.",     category: "GYM",       points: 20, frequency: "DAILY", proof: "SCREENSHOT" },
  { id: "t7", name: "Seven hours",    description: "No excuses. Seven hours of sleep min.",   category: "RECOVERY",  points: 10, frequency: "DAILY", proof: "SCREENSHOT" },
];

export const SEED_WEEKLY: Task[] = [
  { id: "tw1", name: "PR or weight target", description: "Hit a personal record or weight goal.", category: "GYM",      points: 50, frequency: "WEEKLY", proof: "VIDEO" },
  { id: "tw2", name: "Progress check",      description: "Post a Sunday progress pic.",           category: "PROGRESS", points: 30, frequency: "WEEKLY", proof: "PHOTO" },
];

export const SEED_MEMBERS: Omit<Member, "isYou">[] = [
  { id: "m1", name: "Rayhan", handle: "@rayy",         weeklyPoints: 412 },
  { id: "m2", name: "Kamran", handle: "@kam",          weeklyPoints: 388, isAdmin: true },
  { id: "m3", name: "Ayaan",  handle: "@ayaan.lifts",  weeklyPoints: 305 },
  { id: "m4", name: "Maya",   handle: "@maya.bee",     weeklyPoints: 279 },
  { id: "m5", name: "Devon",  handle: "@dev1k",        weeklyPoints: 254 },
  { id: "m6", name: "Priya",  handle: "@p.ria",        weeklyPoints: 198 },
];

export const SEED_FEED: FeedItem[] = [
  { id: "f1", memberId: "m1", verb: "completed",     taskName: "Gym check-in",       timeAgo: "2m" },
  { id: "f2", memberId: "m2", verb: "hit",           taskName: "Protein goal",       timeAgo: "11m" },
  { id: "f3", memberId: "m3", verb: "locked in",     taskName: "Workout logged",     timeAgo: "27m" },
  { id: "f4", memberId: "m4", verb: "claimed",       taskName: "a perfect day",      isPerfectDay: true, timeAgo: "48m" },
  { id: "f5", memberId: "m5", verb: "called cap on", taskName: "Rayhan's 10K steps", capCall: true, timeAgo: "1h" },
  { id: "f6", memberId: "m1", verb: "hit",           taskName: "Seven hours",        timeAgo: "3h" },
];

export const CATEGORIES: Category[] = ["GYM", "CARDIO", "NUTRITION", "RECOVERY", "PROGRESS"];
export const FREQUENCIES: Frequency[] = ["DAILY", "WEEKLY"];
export const PROOFS: Proof[] = ["PHOTO", "SCREENSHOT", "MANUAL", "VIDEO"];
