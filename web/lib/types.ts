export type Category = "GYM" | "CARDIO" | "NUTRITION" | "RECOVERY" | "PROGRESS";
export type Frequency = "DAILY" | "WEEKLY";
export type Proof = "PHOTO" | "SCREENSHOT" | "MANUAL" | "VIDEO";

export type Task = {
  id: string;
  name: string;
  description: string;
  category: Category;
  points: number;
  frequency: Frequency;
  proof: Proof;
};

export type Member = {
  id: string;
  name: string;
  handle: string;
  weeklyPoints: number;
  isYou?: boolean;
  isAdmin?: boolean;
};

export type FeedItem = {
  id: string;
  memberId: string;
  verb: "completed" | "hit" | "locked in" | "claimed" | "called cap on";
  taskName: string;
  isPerfectDay?: boolean;
  capCall?: boolean;
  timeAgo: string;
};

export type Tab = "today" | "leaderboard" | "group" | "tasks";
export type View = "auth" | "group-setup" | "app";
