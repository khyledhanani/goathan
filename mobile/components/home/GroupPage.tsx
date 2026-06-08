import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View, StyleSheet, type LayoutChangeEvent } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Podium } from "@/components/home/Podium";
import { TaskCard } from "@/components/home/TaskCard";
import { EmptyState } from "@/components/ui/primitives";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/Skeleton";
import { useThemeColors } from "@/lib/useThemeColors";
import type { Colors } from "@/lib/theme";
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
  /** When set, scroll to & pulse the task card holding this receipt (notification deep-link). */
  highlightCompletionId?: Id<"completions"> | null;
  /** Called once this page has consumed the highlight (so the dashboard can clear it). */
  onHighlightHandled?: () => void;
}

// One group's page inside the home pager: podium + a vertical scroll of task
// cards, each task's image a carousel of members' proofs.
export function GroupPage({
  groupId,
  groupName,
  proofs,
  actions,
  onAddReceipt,
  onFullBoard,
  highlightCompletionId,
  onHighlightHandled,
}: Props) {
  const c = useThemeColors();
  const s = styles(c);
  const router = useRouter();

  const today = useQuery(api.groups.todayView, { groupId });
  const standings = useQuery(api.groups.weeklyStandings, { groupId });

  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef<Record<string, number>>({});
  const handledRef = useRef<string | null>(null);
  const [pulseTaskId, setPulseTaskId] = useState<string | null>(null);

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

  const amAdmin = members.some((m) => m.isYou && m.isAdmin);

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

  // Which task in THIS group holds the highlighted receipt (stable string id —
  // unaffected by benign `tasks` re-creation when signed URLs resolve).
  const targetTaskId = useMemo(() => {
    if (!highlightCompletionId) return null;
    return (
      tasks.find((t) =>
        t.submissions.some((sub) => sub.completionId === highlightCompletionId),
      )?.taskId ?? null
    );
  }, [highlightCompletionId, tasks]);

  // Notification deep-link → scroll to & pulse the card. Keyed on targetTaskId
  // (not the whole tasks array) so an async feed/URL update mid-window doesn't
  // cancel the timers. handledRef makes it fire once; resetting it when the
  // highlight clears lets a re-tap of the same notification re-trigger.
  useEffect(() => {
    if (!highlightCompletionId) {
      handledRef.current = null;
      return;
    }
    if (!targetTaskId) return; // not in this group / tasks not loaded yet
    if (handledRef.current === highlightCompletionId) return;
    handledRef.current = highlightCompletionId;
    setPulseTaskId(targetTaskId);
    const t1 = setTimeout(() => {
      const y = cardY.current[targetTaskId];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }, 260);
    const t2 = setTimeout(() => {
      setPulseTaskId(null);
      onHighlightHandled?.();
    }, 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [highlightCompletionId, targetTaskId, onHighlightHandled]);

  if (!today) {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
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
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {amAdmin && (
        <View style={s.manageRow}>
          <AnimatedPressable
            scaleDown={0.94}
            dimOnPress={false}
            onPress={() => router.push(`/group/edit/${groupId}`)}
            style={[s.manageBtn, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <Icon name="settings" size={18} color={c.muted} />
          </AnimatedPressable>
        </View>
      )}

      {members.length > 0 && <Podium members={members} onFullBoard={() => onFullBoard(groupId)} />}
      {tasks.length > 0 ? (
        tasks.map((t) => (
          <View
            key={t.taskId}
            onLayout={(e: LayoutChangeEvent) => {
              cardY.current[t.taskId] = e.nativeEvent.layout.y;
            }}
          >
            <TaskCard
              task={t}
              actions={actions}
              onAddReceipt={onAddReceipt}
              highlight={pulseTaskId === t.taskId}
              highlightCompletionId={pulseTaskId === t.taskId ? highlightCompletionId : null}
            />
          </View>
        ))
      ) : (
        <View style={{ paddingTop: 40 }}>
          <EmptyState head="No tasks yet" body={`${groupName} has no tasks. An admin can add some in group settings.`} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 130,
    },
    manageRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginBottom: 12,
    },
    manageBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  });
