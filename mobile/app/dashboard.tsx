import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

import { useThemeColors } from "@/lib/useThemeColors";
import { fonts } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { useSignedProofUrls } from "@/lib/useSignedProofUrls";
import { hapticLight } from "@/lib/haptics";
import { errorMessage } from "@/lib/errors";

import { Icon } from "@/components/ui/Icon";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Skeleton } from "@/components/Skeleton";
import { Toast, type ToastValue } from "@/components/Toast";
import { TabBar } from "@/components/ui/TabBar";
import { GroupSwitcher } from "@/components/home/GroupSwitcher";
import { FeedPage } from "@/components/home/FeedPage";
import { GroupPage } from "@/components/home/GroupPage";
import { CommentDrawer } from "@/components/sheets/CommentDrawer";
import { CapSheet } from "@/components/sheets/CapSheet";
import { LeaderboardSheet } from "@/components/sheets/LeaderboardSheet";
import { AddReceiptSheet } from "@/components/sheets/AddReceiptSheet";
import { UploadSheet, type UploadTask } from "@/components/sheets/UploadSheet";
import type {
  ProofItem,
  ProofActions,
  StandingMember,
  GroupTask,
  PendingInvite,
  SwitcherTab,
} from "@/components/home/types";

// ── Raw shapes from the (untyped) Convex queries ──────────────────────────
interface RawReaction {
  kind: string;
  count: number;
  byYou: boolean;
}
interface RawFeedItem {
  completionId: Id<"completions">;
  userId: Id<"users">;
  displayName: string;
  username?: string;
  avatarUrl?: string | null;
  isYou: boolean;
  groupId: Id<"groups">;
  groupName: string;
  taskName: string;
  taskCategory: string;
  points: number;
  verifiedAt: number;
  proofUrl?: string | null;
  hasR2Proof: boolean;
  revokedAt?: number | null;
  reactions: RawReaction[];
  challengeCount: number;
  challengedByYou: boolean;
  comments: unknown[];
}
interface RawHomeGroup {
  _id: Id<"groups">;
  name: string;
  memberCount: number;
}
interface RawStanding {
  userId: Id<"users">;
  displayName: string;
  username?: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
  isYou: boolean;
  weekPoints: number;
  perfectDays: number;
}
interface RawInvite {
  _id: Id<"groupInvites">;
  groupId: Id<"groups">;
  groupName: string;
  invitedByName: string;
  invitedByAvatarUrl?: string | null;
  groupExists: boolean;
}

export default function DashboardScreen() {
  const c = useThemeColors();
  const s = styles(c);
  const router = useRouter();
  const params = useLocalSearchParams<{ group?: string; highlight?: string }>();
  const { width: W } = useWindowDimensions();

  // ── Data ────────────────────────────────────────────────────────────────
  const home = useQuery(api.groups.homeView, {});
  const feed = useQuery(api.proofs.feedAcrossMyGroups, { limit: 60 });
  const notifs = useQuery(api.notifications.recent, {});
  const pendingInvites = useQuery(api.groups.pendingInvites, {});
  const me = useQuery(api.profiles.getCurrentProfile, {});

  const toggleLike = useMutation(api.likes.toggle);
  const respondToInvite = useMutation(api.groups.respondToInvite);

  // ── Sheet / nav state ─────────────────────────────────────────────────
  const [pageIndex, setPageIndex] = useState(0);
  const [capPost, setCapPost] = useState<ProofItem | null>(null);
  const [commentId, setCommentId] = useState<Id<"completions"> | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [uploadTask, setUploadTask] = useState<UploadTask | null>(null);
  const [boardGroupId, setBoardGroupId] = useState<Id<"groups"> | null>(null);
  const [toast, setToast] = useState<ToastValue>(null);
  const [highlightId, setHighlightId] = useState<Id<"completions"> | null>(null);
  const pagerRef = useRef<FlatList>(null);

  // Live horizontal scroll offset of the pager (UI thread) → drives the top
  // group-switcher so its active tab tracks the drag fraction continuously.
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  // ── Signed proof URLs ─────────────────────────────────────────────────
  const r2Ids = useMemo<Id<"completions">[]>(
    () =>
      feed
        ? (feed.items as RawFeedItem[]).filter((i) => i.hasR2Proof).map((i) => i.completionId)
        : [],
    [feed],
  );
  const signedUrls = useSignedProofUrls(r2Ids);

  // ── Map feed → ProofItem (carries like/comment/cap, reused by group pages) ─
  const proofs: ProofItem[] = useMemo(() => {
    if (!feed) return [];
    return (feed.items as RawFeedItem[]).map((it) => {
      const heart = it.reactions?.find((r) => r.kind === "HEART");
      return {
        completionId: it.completionId,
        userId: it.userId,
        displayName: it.displayName,
        username: it.username,
        avatarUrl: it.avatarUrl,
        isYou: it.isYou,
        groupId: it.groupId,
        groupName: it.groupName,
        taskName: it.taskName,
        taskCategory: it.taskCategory,
        points: it.points,
        whenMs: it.verifiedAt,
        imageUrl: signedUrls[it.completionId] ?? it.proofUrl ?? null,
        likeCount: heart?.count ?? 0,
        likedByYou: heart?.byYou ?? false,
        commentCount: it.comments?.length ?? 0,
        challengeCount: it.challengeCount ?? 0,
        challengedByYou: it.challengedByYou ?? false,
        revoked: it.revokedAt != null,
      };
    });
  }, [feed, signedUrls]);

  // ── Warm the image cache so receipts appear instantly (no load flash) ──
  useEffect(() => {
    const urls = Array.from(
      new Set(
        proofs
          .flatMap((p) => [p.imageUrl, p.avatarUrl])
          .filter((u): u is string => !!u),
      ),
    );
    if (urls.length) Image.prefetch(urls, "memory-disk").catch(() => {});
  }, [proofs]);

  // ── Tabs ────────────────────────────────────────────────────────────────
  const groups = (home?.groups ?? []) as RawHomeGroup[];
  const tabs: SwitcherTab[] = useMemo(
    () => [{ key: "feed", label: "Feed" }, ...groups.map((g) => ({ key: g._id, label: g.name }))],
    [groups],
  );

  // ── Invites ───────────────────────────────────────────────────────────
  const invites: PendingInvite[] = useMemo(
    () =>
      ((pendingInvites ?? []) as RawInvite[])
        .filter((i) => i.groupExists)
        .map((i) => ({
          inviteId: i._id,
          groupId: i.groupId,
          groupName: i.groupName,
          invitedByName: i.invitedByName,
          invitedByAvatarUrl: i.invitedByAvatarUrl,
        })),
    [pendingInvites],
  );

  // ── Cap threshold for the active post ─────────────────────────────────
  const capRequired = useMemo(() => {
    if (!capPost || !home) return 3;
    const g = (home.groups as RawHomeGroup[]).find((gg) => gg._id === capPost.groupId);
    const mc = g?.memberCount ?? 0;
    return Math.max(1, Math.floor(Math.max(0, mc - 1) / 2) + 1);
  }, [capPost, home]);

  // ── Leaderboard standings (active "Full board") ───────────────────────
  const boardStandings = useQuery(
    api.groups.weeklyStandings,
    boardGroupId ? { groupId: boardGroupId } : "skip",
  );
  const boardMembers: StandingMember[] = ((boardStandings ?? []) as RawStanding[]).map((m) => ({
    userId: m.userId,
    displayName: m.displayName,
    username: m.username,
    avatarUrl: m.avatarUrl,
    isAdmin: m.isAdmin,
    isYou: m.isYou,
    weekPoints: m.weekPoints,
    perfectDays: m.perfectDays,
  }));

  // ── Navigation helpers ────────────────────────────────────────────────
  const goToPage = useCallback(
    (index: number) => {
      setPageIndex(index);
      pagerRef.current?.scrollToIndex({ index, animated: true });
    },
    [],
  );

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, W));
      setPageIndex((prev) => (prev !== i ? i : prev));
    },
    [W],
  );

  // ── Deep-link from a notification → open the group + highlight the post ──
  useEffect(() => {
    const groupParam = params.group as Id<"groups"> | undefined;
    const hl = params.highlight as string | undefined;
    if (!groupParam && !hl) return;

    // Resolve which group to land on (param wins; else infer from the post).
    let targetGroup = groupParam;
    if (hl && !targetGroup) {
      const p = proofs.find((x) => x.completionId === hl);
      if (p) targetGroup = p.groupId;
      else if (feed === undefined) return; // feed still loading — wait, re-run
    }

    if (targetGroup) {
      const i = tabs.findIndex((t) => t.key === targetGroup);
      if (i < 0 && home === undefined) return; // groups still loading — wait
      if (i > 0) goToPage(i);
    }
    if (hl) setHighlightId(hl as Id<"completions">);

    // Consume the params so back-nav / re-renders don't re-trigger.
    router.setParams({ group: undefined, highlight: undefined });
  }, [params.group, params.highlight, tabs, proofs, feed, home, goToPage, router]);

  // The group page clears the highlight once it has actually pulsed the card.
  const clearHighlight = useCallback(() => setHighlightId(null), []);

  // Safety net: if no group ever consumes the highlight (e.g. the post isn't in
  // any loaded group), drop it after a while so it can't pulse a late-loading
  // group much later.
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 8000);
    return () => clearTimeout(t);
  }, [highlightId]);

  // ── Proof actions ─────────────────────────────────────────────────────
  const actions: ProofActions = useMemo(
    () => ({
      onLike: (item) => {
        hapticLight();
        toggleLike({ completionId: item.completionId, kind: "HEART" }).catch(() => {});
      },
      onComment: (item) => setCommentId(item.completionId),
      onCap: (item) => setCapPost(item),
      onUser: (userId) => router.push(`/u/${userId}`),
      onGroup: (groupId) => {
        const i = tabs.findIndex((t) => t.key === groupId);
        if (i > 0) goToPage(i);
      },
    }),
    [toggleLike, router, tabs, goToPage],
  );

  const onAddReceipt = useCallback(
    (task: GroupTask, groupName: string) => {
      setUploadTask({
        taskId: task.taskId,
        name: task.name,
        category: task.category,
        points: task.points,
        groupName,
        completionId: task.youCompletionId ?? null,
      });
    },
    [],
  );

  const handleInvite = async (id: Id<"groupInvites">, response: "ACCEPT" | "DECLINE") => {
    try {
      const res = await respondToInvite({ inviteId: id, response });
      if (res.ok) {
        setToast({
          message: response === "ACCEPT" ? "Joined the group" : "Invite declined",
          tone: "success",
        });
      } else {
        setToast({ message: res.error, tone: "error" });
      }
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  const unread = notifs?.unreadCount ?? 0;

  // ── Loading ───────────────────────────────────────────────────────────
  if (home === undefined || feed === undefined) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <View style={[s.iconBtn, { borderColor: c.line }]} />
          <Skeleton width={120} height={26} radius={6} />
          <View style={[s.iconBtn, { borderColor: c.line }]} />
        </View>
        <View style={{ padding: 24, gap: 18 }}>
          <Skeleton width={"100%"} height={150} radius={22} />
          {[1, 2].map((i) => (
            <View key={i} style={{ gap: 12, paddingVertical: 12 }}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <Skeleton width={48} height={48} radius={24} />
                <View style={{ gap: 6 }}>
                  <Skeleton width={160} height={14} radius={4} />
                  <Skeleton width={100} height={10} radius={4} />
                </View>
              </View>
              <Skeleton width={"100%"} height={250} radius={16} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header: bell · group switcher · new group */}
      <View style={[s.header, { borderBottomColor: c.line }]}>
        <AnimatedPressable
          scaleDown={0.92}
          dimOnPress={false}
          onPress={() => router.push("/inbox")}
          style={[s.iconBtn, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Icon name="bell" size={21} color={c.ink} />
          {unread > 0 && (
            <View style={[s.badge, { backgroundColor: c.accent, borderColor: c.paper }]}>
              <Text style={[s.badgeText, { color: c.onAccent }]}>{unread > 9 ? "9+" : unread}</Text>
            </View>
          )}
        </AnimatedPressable>

        <View style={s.switcherWrap}>
          <GroupSwitcher tabs={tabs} scrollX={scrollX} pageWidth={W} onPick={goToPage} />
        </View>

        <AnimatedPressable
          scaleDown={0.92}
          dimOnPress={false}
          onPress={() => router.push("/groups/create")}
          style={[s.iconBtn, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Icon name="plus" size={21} color={c.ink} />
        </AnimatedPressable>
      </View>

      {/* Swipeable pager */}
      <Animated.FlatList
        ref={pagerRef}
        data={tabs}
        keyExtractor={(t: SwitcherTab) => t.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_: unknown, index: number) => ({ length: W, offset: W * index, index })}
        onScrollToIndexFailed={({ index }: { index: number }) => {
          const offset = Math.max(0, Math.min(index, tabs.length - 1)) * W;
          setTimeout(() => pagerRef.current?.scrollToOffset({ offset, animated: true }), 60);
        }}
        renderItem={({ item, index }: { item: SwitcherTab; index: number }) => (
          <View style={{ width: W }}>
            {index === 0 ? (
              <FeedPage
                proofs={proofs}
                invites={invites}
                actions={actions}
                onAccept={(id) => handleInvite(id, "ACCEPT")}
                onDecline={(id) => handleInvite(id, "DECLINE")}
              />
            ) : (
              <GroupPage
                groupId={item.key as Id<"groups">}
                groupName={item.label}
                proofs={proofs.filter((p) => p.groupId === (item.key as Id<"groups">))}
                actions={actions}
                onAddReceipt={(task) => onAddReceipt(task, item.label)}
                onFullBoard={setBoardGroupId}
                highlightCompletionId={highlightId}
                onHighlightHandled={clearHighlight}
              />
            )}
          </View>
        )}
      />

      <TabBar onAdd={() => setAddOpen(true)} />

      {/* Sheets */}
      <CommentDrawer
        completionId={commentId}
        onClose={() => setCommentId(null)}
        meInitial={me?.displayName?.charAt(0)}
        meAvatarUrl={me?.avatarUrl}
      />
      <CapSheet post={capPost} requiredCalls={capRequired} onClose={() => setCapPost(null)} />
      <LeaderboardSheet
        visible={boardGroupId != null}
        members={boardMembers}
        onClose={() => setBoardGroupId(null)}
      />
      <AddReceiptSheet
        visible={addOpen}
        groups={groups}
        onClose={() => setAddOpen(false)}
        onDone={() => setAddOpen(false)}
      />
      <UploadSheet
        task={uploadTask}
        onClose={() => setUploadTask(null)}
        onDone={() => setUploadTask(null)}
      />

      <Toast value={toast} onDismiss={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.paper },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 12,
      borderBottomWidth: 1,
      gap: 8,
    },
    switcherWrap: { flex: 1, height: 44, justifyContent: "center" },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      position: "absolute",
      top: -3,
      right: -3,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    badgeText: { fontFamily: fonts.monoMedium, fontSize: 10 },
  });
