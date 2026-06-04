import { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  StyleSheet,
} from "react-native";
import { Skeleton } from "@/components/Skeleton";
import { useRouter } from "expo-router";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { useSignedProofUrls } from "@/lib/useSignedProofUrls";
import { FeedStatsBar } from "@/components/FeedStatsBar";
import { StoriesRail, type StoryBundle } from "@/components/StoriesRail";
import { StoryViewer } from "@/components/StoryViewer";
import { FeedCard, type FeedCardItem } from "@/components/FeedCard";
import { BottomTabBar } from "@/components/BottomTabBar";

export default function DashboardScreen() {
  const colors = useThemeColors();
  const s = styles(colors);
  const router = useRouter();

  // ── Data ──────────────────────────────────────────────────────────────
  const home = useQuery(api.groups.homeView, {});
  const feed = useQuery(api.proofs.feedAcrossMyGroups, { limit: 30 });
  const stories = useQuery(api.proofs.storiesAcrossMyGroups, {});
  const markSeen = useMutation(api.profiles.markFeedSeen);
  const notifs = useQuery(api.notifications.recent, {});

  const [refreshing, setRefreshing] = useState(false);
  const [activeStory, setActiveStory] = useState<StoryBundle | null>(null);

  // Mark feed as seen on mount
  useEffect(() => {
    if (feed) {
      void markSeen({});
    }
  }, [feed != null]);

  // ── Signed proof URLs ─────────────────────────────────────────────────
  const r2CompletionIds = useMemo(() => {
    const ids: Id<"completions">[] = [];
    if (feed) {
      for (const item of feed.items) {
        if (item.hasR2Proof) ids.push(item.completionId);
      }
    }
    if (stories) {
      for (const bundle of stories) {
        for (const item of bundle.items) {
          if (item.hasR2Proof) ids.push(item.completionId);
        }
      }
    }
    return ids;
  }, [feed, stories]);

  const signedUrls = useSignedProofUrls(r2CompletionIds);

  // ── Pull to refresh ───────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Convex queries auto-refresh, just show indicator briefly
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // ── Navigation helpers ────────────────────────────────────────────────
  const navigateToUser = (userId: Id<"users">) => {
    router.push(`/u/${userId}`);
  };
  const navigateToGroup = (groupId: Id<"groups">) => {
    router.push(`/group/${groupId}`);
  };

  // ── Feed sections ─────────────────────────────────────────────────────
  const { freshItems, olderItems } = useMemo(() => {
    if (!feed) return { freshItems: [], olderItems: [] };
    const threshold = feed.lastSeenFeedAt;
    const fresh: FeedCardItem[] = [];
    const older: FeedCardItem[] = [];
    for (const item of feed.items) {
      if (item.verifiedAt > threshold) {
        fresh.push(item);
      } else {
        older.push(item);
      }
    }
    return { freshItems: fresh, olderItems: older };
  }, [feed]);

  const allItems = useMemo(() => {
    const sections: ({ type: "divider" } | { type: "card"; item: FeedCardItem })[] = [];
    for (const item of freshItems) {
      sections.push({ type: "card", item });
    }
    if (freshItems.length > 0 && olderItems.length > 0) {
      sections.push({ type: "divider" });
    }
    for (const item of olderItems) {
      sections.push({ type: "card", item });
    }
    return sections;
  }, [freshItems, olderItems]);

  // ── Earliest period end for countdown ─────────────────────────────────
  const earliestPeriodEndMs = useMemo(() => {
    if (!home) return undefined;
    let earliest: number | undefined;
    for (const g of home.groups) {
      if (!g.stats.periodEnded && g.stats.periodEndMs > 0) {
        if (!earliest || g.stats.periodEndMs < earliest) {
          earliest = g.stats.periodEndMs;
        }
      }
    }
    return earliest;
  }, [home]);

  // ── Loading state ─────────────────────────────────────────────────────
  if (!home || !feed) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={[s.listContent, { gap: 16, paddingTop: 16, flex: 1 }]}>
          {/* Header skeleton */}
          <Skeleton width={120} height={28} radius={6} />
          {/* Stats bar skeleton */}
          <Skeleton width={"100%"} height={48} radius={10} />
          {/* Stories skeleton */}
          <View style={{ flexDirection: "row", gap: 14, paddingVertical: 4 }}>
            {[1,2,3,4].map(i => (
              <View key={i} style={{ alignItems: "center", gap: 4 }}>
                <Skeleton width={52} height={52} radius={26} />
                <Skeleton width={36} height={8} radius={4} />
              </View>
            ))}
          </View>
          {/* Feed card skeletons */}
          {[1,2].map(i => (
            <View key={i} style={{ gap: 12, paddingVertical: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Skeleton width={36} height={36} radius={18} />
                <View style={{ gap: 4 }}>
                  <Skeleton width={160} height={13} radius={4} />
                  <Skeleton width={100} height={10} radius={4} />
                </View>
              </View>
              <Skeleton width={"100%"} height={200} radius={10} />
              <Skeleton width={180} height={20} radius={4} />
            </View>
          ))}
        </View>
        <BottomTabBar />
      </SafeAreaView>
    );
  }

  // ── Empty state (no groups) ───────────────────────────────────────────
  if (home.groups.length === 0) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.emptyState}>
          <Text style={s.brand}>
            Receipts
            <Text style={s.brandVersion}>{"  "}v0.1</Text>
          </Text>
          <Text style={s.emptyTitle}>No groups yet</Text>
          <Text style={s.emptyBody}>
            Join a group or create one to start logging receipts.
          </Text>
        </View>
        <BottomTabBar unreadCount={notifs?.unreadCount ?? 0} />
      </SafeAreaView>
    );
  }

  // ── Full dashboard ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Story viewer modal */}
      <StoryViewer
        bundle={activeStory}
        signedUrls={signedUrls}
        onClose={() => setActiveStory(null)}
      />

      <FlatList
        data={allItems}
        keyExtractor={(entry, i) =>
          entry.type === "divider" ? `divider-${i}` : entry.item.completionId
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.fog}
          />
        }
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={s.listHeader}>
            {/* App header */}
            <View style={s.headerBar}>
              <Text style={s.brand}>
                Receipts
                <Text style={s.brandVersion}>{"  "}v0.1</Text>
              </Text>
            </View>

            {/* Stats bar */}
            <FeedStatsBar
              todayDone={home.totals.todayDone}
              totalDailyTasks={home.totals.totalDailyTasks}
              todayPoints={home.totals.todayPoints}
              groupCount={home.totals.groupCount}
              earliestPeriodEndMs={earliestPeriodEndMs}
            />

            {/* Stories */}
            {stories && stories.length > 0 && (
              <StoriesRail
                bundles={stories}
                onPress={(bundle) => setActiveStory(bundle)}
              />
            )}

            {/* Groups quick nav */}
            <View style={s.groupsNav}>
              <Text style={s.sectionLabel}>Your groups</Text>
              <View style={s.groupPills}>
                {home.groups.map((g) => (
                  <AnimatedPressable
                    key={g._id}
                    scaleDown={0.98}
                    style={s.groupPill}
                    onPress={() => navigateToGroup(g._id)}
                  >
                    <Text style={s.groupPillName} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text style={s.groupPillStat}>
                      {g.stats.todayDone}/{g.stats.totalDailyTasks}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>

            {/* Feed label */}
            {allItems.length > 0 && (
              <Text style={s.sectionLabel}>Feed</Text>
            )}
          </View>
        }
        renderItem={({ item: entry }) => {
          if (entry.type === "divider") {
            return (
              <View style={s.divider}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>earlier</Text>
                <View style={s.dividerLine} />
              </View>
            );
          }
          return (
            <FeedCard
              item={entry.item}
              signedUrl={signedUrls[entry.item.completionId]}
              onUserPress={navigateToUser}
              onGroupPress={navigateToGroup}
            />
          );
        }}
        ListEmptyComponent={
          <View style={s.emptyFeed}>
            <Text style={s.emptyFeedText}>
              No receipts yet. Claim a task in one of your groups to get started.
            </Text>
          </View>
        }
      />
      <BottomTabBar unreadCount={notifs?.unreadCount ?? 0} />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = (colors: Colors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.paper,
    },
    loading: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.fog,
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    listContent: {
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    listHeader: {
      gap: 16,
      paddingTop: 8,
      paddingBottom: 8,
    },

    // Header
    headerBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      flexWrap: "wrap",
      gap: 12,
    },
    brand: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 28,
      color: colors.ink,
      letterSpacing: -0.3,
    },
    brandVersion: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.fog,
      letterSpacing: 1.4,
    },

    // Groups nav
    groupsNav: {
      gap: 8,
    },
    sectionLabel: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: colors.fog,
    },
    groupPills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    groupPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.md,
      backgroundColor: colors.paper2,
    },
    groupPillName: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.ink,
      maxWidth: 140,
    },
    groupPillStat: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      color: colors.accent,
    },

    // Feed divider
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.rule,
    },
    dividerText: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.mist,
      letterSpacing: 1,
      textTransform: "uppercase",
    },

    // Empty states
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
      gap: 12,
    },
    emptyTitle: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 32,
      color: colors.ink,
    },
    emptyBody: {
      fontFamily: fonts.sans,
      fontSize: 15,
      color: colors.smoke,
      textAlign: "center",
      lineHeight: 22,
    },
    emptyFeed: {
      paddingVertical: 40,
      alignItems: "center",
    },
    emptyFeedText: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.fog,
      textAlign: "center",
      lineHeight: 21,
      maxWidth: 280,
    },
  });
