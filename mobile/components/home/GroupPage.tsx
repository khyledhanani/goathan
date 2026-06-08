import { useMemo } from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Podium } from "@/components/home/Podium";
import { TaskCard } from "@/components/home/TaskCard";
import { EmptyState } from "@/components/ui/primitives";
import { Skeleton } from "@/components/Skeleton";
import type { ProofItem, ProofActions, StandingMember, GroupTask } from "@/components/home/types";

interface RawStandingRow {
  userId: Id<"users">;
  displayName: string;
  username?: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
  isYou: boolean;
  weekPoints: number;
  perfectDays: number;
}
interface RawSlot {
  _id: Id<"tasks">;
  name: string;
  category: string;
  points: number;
  completionId?: Id<"completions"> | null;
  verifiedAt?: number | null;
}

interface Props {
  groupId: Id<"groups">;
  groupName: string;
  /** Receipts for this group, pre-mapped from the shared feed (carry like/comment/cap). */
  proofs: ProofItem[];
  actions: ProofActions;
  onAddReceipt: (task: GroupTask) => void;
  onFullBoard: (groupId: Id<"groups">) => void;
}

// One group's page inside the home pager: podium + a vertical scroll of task
// cards, each task's image a carousel of members' proofs.
export function GroupPage({ groupId, groupName, proofs, actions, onAddReceipt, onFullBoard }: Props) {
  const today = useQuery(api.groups.todayView, { groupId });
  const standings = useQuery(api.groups.weeklyStandings, { groupId });

  const members: StandingMember[] = useMemo(
    () =>
      ((standings ?? []) as RawStandingRow[]).map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        username: m.username,
        avatarUrl: m.avatarUrl,
        isAdmin: m.isAdmin,
        isYou: m.isYou,
        weekPoints: m.weekPoints,
        perfectDays: m.perfectDays,
      })),
    [standings],
  );

  const tasks: GroupTask[] = useMemo(() => {
    if (!today) return [];
    return (today.slate as RawSlot[]).map((slot) => ({
      taskId: slot._id,
      name: slot.name,
      category: slot.category,
      points: slot.points,
      youCompletionId: slot.completionId ?? null,
      youDone: slot.verifiedAt != null,
      submissions: proofs.filter((p) => p.taskName === slot.name),
    }));
  }, [today, proofs]);

  if (!today) {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Skeleton width={"100%"} height={150} radius={22} />
        <View style={{ height: 24 }} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ paddingVertical: 24, gap: 14 }}>
            <Skeleton width={180} height={26} radius={6} />
            <Skeleton width={"100%"} height={250} radius={16} />
            <Skeleton width={"100%"} height={50} radius={999} />
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {members.length > 0 && <Podium members={members} onFullBoard={() => onFullBoard(groupId)} />}
      {tasks.length > 0 ? (
        tasks.map((t) => (
          <TaskCard key={t.taskId} task={t} actions={actions} onAddReceipt={onAddReceipt} />
        ))
      ) : (
        <View style={{ paddingTop: 40 }}>
          <EmptyState head="No tasks yet" body={`${groupName} has no tasks. An admin can add some in group settings.`} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 130,
  },
});
