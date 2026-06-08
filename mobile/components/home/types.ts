import type { Id } from "@/convex/_generated/dataModel";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS redesign — normalized presentational types.
// dashboard.tsx maps raw Convex query results (feedAcrossMyGroups,
// recentActivity, weeklyStandings, pendingInvites) into these shapes so the
// home components stay purely presentational (props + callbacks, no Convex).
// ════════════════════════════════════════════════════════════════════════

/** A single verified proof "receipt" — one feed post / one carousel slide. */
export interface ProofItem {
  completionId: Id<"completions">;
  userId: Id<"users">;
  displayName: string; // already resolved ("You" handled by caller via isYou)
  username?: string;
  avatarUrl?: string | null;
  isYou: boolean;
  groupId: Id<"groups">;
  groupName: string;
  taskName: string;
  taskCategory: string;
  points: number;
  whenMs: number; // verifiedAt
  /** Resolved image url (signed R2 url or legacy proofUrl). null → striped placeholder. */
  imageUrl?: string | null;
  likeCount: number;
  likedByYou: boolean;
  commentCount: number;
  challengeCount: number;
  challengedByYou: boolean;
  revoked: boolean;
}

/** One row of a group's weekly standings (podium + leaderboard). */
export interface StandingMember {
  userId: Id<"users">;
  displayName: string;
  username?: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
  isYou: boolean;
  weekPoints: number;
  perfectDays: number;
  lastWeekPoints?: number;
}

/** A task within a group, plus its members' submissions (for the carousel). */
export interface GroupTask {
  taskId: Id<"tasks">;
  name: string;
  category: string;
  points: number;
  /** The current user's own completion for this period, if claimed. */
  youCompletionId?: Id<"completions"> | null;
  youDone: boolean;
  submissions: ProofItem[];
}

/** A pending group invite. */
export interface PendingInvite {
  inviteId: Id<"groupInvites">;
  groupId: Id<"groups">;
  groupName: string;
  invitedByName: string;
  invitedByAvatarUrl?: string | null;
}

/** Group switcher tab. */
export interface SwitcherTab {
  key: string; // "feed" or a groupId
  label: string;
}

/** Shared action callbacks passed down to feed/task components. */
export interface ProofActions {
  onLike: (item: ProofItem) => void;
  onComment: (item: ProofItem) => void;
  onCap: (item: ProofItem) => void;
  onUser?: (userId: Id<"users">) => void;
  onGroup?: (groupId: Id<"groups">) => void;
}
