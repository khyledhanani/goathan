import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron(
  "finalize weekly competition",
  "5 0 * * 1",
  internal.weekResults.finalizeAllGroupsForPriorWeek,
  {},
);

crons.cron(
  "daily reset reminder",
  "0 22 * * *",
  internal.notificationsCron.fanOutDailyReminders,
  {},
);

export default crons;
