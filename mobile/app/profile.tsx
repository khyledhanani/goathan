import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Modal,
} from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { useSignedProofUrls } from "@/lib/useSignedProofUrls";
import { Toast, type ToastValue } from "@/components/Toast";
import { BottomTabBar } from "@/components/BottomTabBar";

// ── Medal colors ──────────────────────────────────────────────────────

const MEDAL_COLORS = {
  GOLD: "#d4a420",
  SILVER: "#a0a0a0",
  BRONZE: "#b0703c",
} as const;

type Medal = "GOLD" | "SILVER" | "BRONZE";

// ── Helpers ───────────────────────────────────────────────────────────

function formatWeekRange(weekEndMs: number): string {
  const end = new Date(weekEndMs - 1);
  const start = new Date(weekEndMs - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${fmt(start)} – ${end.getUTCDate()}`;
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_GAP = 3;
const GRID_COLS = 3;
const TILE_SIZE = (SCREEN_WIDTH - 48 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

// ── Component ─────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const colors = useThemeColors();
  const s = styles(colors);
  const router = useRouter();

  const profile = useQuery(api.profiles.getCurrentProfile);
  const groups = useQuery(api.groups.getMyGroups, {});

  const myStreak = useQuery(
    api.streaks.forUser,
    profile ? { userId: profile.userId } : "skip",
  );
  const myTrophies = useQuery(
    api.weekResults.trophiesForUser,
    profile ? { userId: profile.userId } : "skip",
  );
  const myReceipts = useQuery(
    api.proofs.gridForUser,
    profile ? { userId: profile.userId } : "skip",
  );

  // Signed URLs for receipt grid
  const r2Ids = useMemo(() => {
    if (!myReceipts) return [];
    return myReceipts.items
      .filter((i: any) => i.hasR2Proof)
      .map((i: any) => i.completionId);
  }, [myReceipts]);
  const signedUrls = useSignedProofUrls(r2Ids);

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastValue>(null);

  if (!profile) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loading}>
          <Text style={s.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalMedals =
    (myTrophies?.counts.gold ?? 0) +
    (myTrophies?.counts.silver ?? 0) +
    (myTrophies?.counts.bronze ?? 0);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Page title + streak */}
        <View style={s.pageHead}>
          <View style={s.profileHeaderRow}>
            <Text style={s.eyebrow}>Account</Text>
            <AnimatedPressable scaleDown={0.95} onPress={() => router.push("/settings")} hitSlop={8}>
              <Text style={s.settingsLink}>settings</Text>
            </AnimatedPressable>
          </View>
          <Text style={s.title}>
            Profile<Text style={{ color: colors.accent }}>.</Text>
          </Text>

          {/* User info */}
          <View style={s.userRow}>
            {profile.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={s.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[s.avatar, s.avatarPlaceholder]}>
                <Text style={s.avatarInitial}>
                  {profile.displayName?.charAt(0)?.toUpperCase() ?? "?"}
                </Text>
              </View>
            )}
            <View style={s.userInfo}>
              <Text style={s.displayName}>{profile.displayName}</Text>
              {profile.username && (
                <Text style={s.username}>@{profile.username}</Text>
              )}
            </View>
          </View>

          {/* Streak */}
          {myStreak && (myStreak.current > 0 || myStreak.longest > 0) && (
            <View style={s.streakRow}>
              <View style={s.streakChip}>
                <Text style={s.streakFlame}>🔥</Text>
                <Text style={s.streakNum}>{myStreak.current}</Text>
                <Text style={s.streakLabel}>day streak</Text>
              </View>
              {myStreak.longest > myStreak.current && (
                <Text style={s.streakLongest}>
                  Longest <Text style={s.streakLongestNum}>{myStreak.longest}</Text>
                </Text>
              )}
            </View>
          )}
        </View>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TROPHY CABINET                                                */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>
              Trophy cabinet<Text style={{ color: colors.accent }}>.</Text>
            </Text>
            <Text style={s.sectionCount}>
              {myTrophies === undefined ? "Loading..." : `${totalMedals} medals`}
            </Text>
          </View>

          {myTrophies === undefined ? (
            <Text style={s.mutedLine}>Loading...</Text>
          ) : myTrophies === null || myTrophies.items.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>No medals yet</Text>
              <Text style={s.emptyLine}>
                Finish a week in the top 3 of any group and your trophy lands here.
              </Text>
            </View>
          ) : (
            <View>
              {/* Medal counts */}
              <View style={s.medalCounts}>
                <MedalCount medal="GOLD" count={myTrophies.counts.gold} colors={colors} />
                <MedalCount medal="SILVER" count={myTrophies.counts.silver} colors={colors} />
                <MedalCount medal="BRONZE" count={myTrophies.counts.bronze} colors={colors} />
              </View>

              {/* Trophy list */}
              <View style={s.trophyList}>
                {myTrophies.items.map((t: any) => (
                  <AnimatedPressable
                    key={t._id}
                    scaleDown={0.98}
                    style={s.trophyRow}
                    onPress={() => router.push(`/group/${t.groupId}`)}
                  >
                    <View
                      style={[
                        s.medalDot,
                        { backgroundColor: MEDAL_COLORS[t.medal as Medal] },
                      ]}
                    >
                      <Text style={s.medalRank}>
                        {t.medal === "GOLD" ? "1" : t.medal === "SILVER" ? "2" : "3"}
                      </Text>
                    </View>
                    <View style={s.trophyMeta}>
                      <Text style={s.trophyGroup} numberOfLines={1}>
                        {t.groupName}
                      </Text>
                      <Text style={s.trophyWeek}>
                        {formatWeekRange(t.weekEndMs)}
                      </Text>
                    </View>
                    <Text style={s.trophyPoints}>{t.weekPoints} pts</Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* YOUR RECEIPTS                                                 */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>
              Your receipts<Text style={{ color: colors.accent }}>.</Text>
            </Text>
            <Text style={s.sectionCount}>
              {myReceipts === undefined
                ? "Loading..."
                : `${myReceipts.items.length}${myReceipts.items.length >= 60 ? "+" : ""} verified`}
            </Text>
          </View>

          {myReceipts === undefined ? (
            <Text style={s.mutedLine}>Loading...</Text>
          ) : myReceipts.items.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>Nothing yet</Text>
              <Text style={s.emptyLine}>
                Verify a task and your receipt lands here.
              </Text>
            </View>
          ) : (
            <View style={s.receiptGrid}>
              {myReceipts.items.map((item: any) => {
                const url =
                  item.proofUrl ??
                  (item.hasR2Proof ? signedUrls[item.completionId] : null);
                return (
                  <AnimatedPressable
                    key={item.completionId}
                    scaleDown={0.92}
                    style={s.receiptTile}
                    onPress={() => {
                      if (url) setLightboxUrl(url);
                      else router.push(`/r/${item.completionId}`);
                    }}
                  >
                    {url ? (
                      <Image
                        source={{ uri: url }}
                        style={s.receiptImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[s.receiptImage, s.receiptPlaceholder]}>
                        <Text style={s.receiptPlaceholderText}>
                          {item.taskName?.charAt(0)?.toUpperCase() ?? "?"}
                        </Text>
                      </View>
                    )}
                    <View style={s.receiptOverlay}>
                      <Text style={s.receiptTaskName} numberOfLines={1}>
                        {item.taskName}
                      </Text>
                      <Text style={s.receiptPoints}>+{item.points}</Text>
                    </View>
                    {item.aiVerification && (
                      <View style={s.aiBadge}>
                        <Text style={s.aiBadgeText}>AI</Text>
                      </View>
                    )}
                  </AnimatedPressable>
                );
              })}
            </View>
          )}
        </View>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* YOUR GROUPS                                                   */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>
              Your groups<Text style={{ color: colors.accent }}>.</Text>
            </Text>
            <Text style={s.sectionCount}>
              {groups ? `${groups.length} active` : "Loading..."}
            </Text>
          </View>

          {groups === undefined ? (
            <Text style={s.mutedLine}>Loading...</Text>
          ) : groups.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>No groups yet</Text>
              <AnimatedPressable scaleDown={0.95} onPress={() => router.push("/groups")}>
                <Text style={s.emptyLink}>Create or join one →</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <View style={s.groupList}>
              {groups.map((g: any) => (
                <AnimatedPressable
                  key={g._id}
                  scaleDown={0.98}
                  style={s.groupRow}
                  onPress={() => router.push(`/group/${g._id}`)}
                >
                  <View style={s.groupInfo}>
                    <Text style={s.groupName} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text style={s.roleBadge}>
                      {g.isAdmin ? "Admin" : "Member"}
                    </Text>
                  </View>
                  <Text style={s.openLink}>Open →</Text>
                </AnimatedPressable>
              ))}
            </View>
          )}

          <AnimatedPressable
            scaleDown={0.98}
            style={s.groupsFooter}
            onPress={() => router.push("/groups")}
          >
            <Text style={s.groupsFooterText}>
              Create or join groups in{" "}
              <Text style={{ color: colors.accent }}>Groups</Text>
            </Text>
          </AnimatedPressable>
        </View>
      </ScrollView>

      {/* Lightbox modal */}
      <Modal
        visible={lightboxUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxUrl(null)}
      >
        <AnimatedPressable
          scaleDown={0.98}
          style={s.lightboxBackdrop}
          onPress={() => setLightboxUrl(null)}
        >
          {lightboxUrl && (
            <Image
              source={{ uri: lightboxUrl }}
              style={s.lightboxImage}
              contentFit="contain"
            />
          )}
          <AnimatedPressable
            scaleDown={0.92}
            style={s.lightboxClose}
            onPress={() => setLightboxUrl(null)}
          >
            <Text style={s.lightboxCloseText}>✕</Text>
          </AnimatedPressable>
        </AnimatedPressable>
      </Modal>

      <Toast value={toast} onDismiss={() => setToast(null)} />
      <BottomTabBar />
    </SafeAreaView>
  );
}

// ── Medal Count Chip ──────────────────────────────────────────────────

function MedalCount({
  medal,
  count,
  colors,
}: {
  medal: Medal;
  count: number;
  colors: Colors;
}) {
  return (
    <View style={medalCountStyles(colors).chip}>
      <View
        style={[
          medalCountStyles(colors).dot,
          { backgroundColor: MEDAL_COLORS[medal] },
        ]}
      >
        <Text style={medalCountStyles(colors).dotText}>
          {medal === "GOLD" ? "1" : medal === "SILVER" ? "2" : "3"}
        </Text>
      </View>
      <Text style={medalCountStyles(colors).num}>{count}</Text>
    </View>
  );
}

const medalCountStyles = (colors: Colors) =>
  StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    dot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: "center",
      alignItems: "center",
    },
    dotText: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      color: colors.ink,
      fontWeight: "700",
    },
    num: {
      fontFamily: fonts.monoMedium,
      fontSize: 14,
      color: colors.ink,
    },
  });

// ── Styles ────────────────────────────────────────────────────────────

const styles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
    loading: { flex: 1, justifyContent: "center", alignItems: "center" },
    loadingText: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.fog,
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    scroll: { paddingHorizontal: 24, paddingBottom: 60 },

    // Header
    profileHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    settingsLink: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      color: colors.smoke,
      letterSpacing: 1.1,
      textTransform: "uppercase",
    },
    pageHead: { gap: 6, paddingVertical: 16, marginBottom: 8 },
    eyebrow: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: colors.fog,
    },
    title: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 48,
      color: colors.ink,
      letterSpacing: -1,
    },

    // User info
    userRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginTop: 8,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
    },
    avatarPlaceholder: {
      backgroundColor: colors.paper3,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarInitial: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 20,
      color: colors.fog,
    },
    userInfo: { gap: 2 },
    displayName: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 16,
      color: colors.ink,
    },
    username: {
      fontFamily: fonts.mono,
      fontSize: 12,
      color: colors.fog,
      letterSpacing: 0.3,
    },

    // Streak
    streakRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginTop: 10,
    },
    streakChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.paper2,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radii.pill,
    },
    streakFlame: { fontSize: 14 },
    streakNum: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: colors.ink,
    },
    streakLabel: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.fog,
      letterSpacing: 0.3,
    },
    streakLongest: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.mist,
      letterSpacing: 0.5,
    },
    streakLongestNum: {
      fontFamily: fonts.monoMedium,
      color: colors.fog,
    },

    // Sections
    section: { marginBottom: 36 },
    sectionHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 12,
    },
    sectionTitle: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 28,
      color: colors.ink,
      letterSpacing: -0.3,
    },
    sectionCount: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      color: colors.fog,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    mutedLine: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.fog,
    },

    // Empty states
    emptyBox: {
      paddingVertical: 24,
      alignItems: "center",
      gap: 6,
    },
    emptyTitle: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      color: colors.fog,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    emptyLine: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.mist,
      textAlign: "center",
      lineHeight: 19,
      maxWidth: 280,
    },
    emptyLink: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.accent,
      marginTop: 4,
    },

    // Medal counts
    medalCounts: {
      flexDirection: "row",
      gap: 20,
      marginBottom: 14,
    },

    // Trophy list
    trophyList: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.md,
      overflow: "hidden",
    },
    trophyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    medalDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    medalRank: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      color: "#14130e",
      fontWeight: "700",
    },
    trophyMeta: { flex: 1, gap: 1 },
    trophyGroup: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.ink,
    },
    trophyWeek: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.mist,
      letterSpacing: 0.5,
    },
    trophyPoints: {
      fontFamily: fonts.monoMedium,
      fontSize: 12,
      color: colors.accent,
    },

    // Receipt grid
    receiptGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: GRID_GAP,
    },
    receiptTile: {
      width: TILE_SIZE,
      height: TILE_SIZE,
      borderRadius: radii.sm,
      overflow: "hidden",
    },
    receiptImage: {
      width: "100%",
      height: "100%",
    },
    receiptPlaceholder: {
      backgroundColor: colors.paper3,
      justifyContent: "center",
      alignItems: "center",
    },
    receiptPlaceholderText: {
      fontFamily: fonts.sansBold,
      fontSize: 20,
      color: colors.fog,
    },
    receiptOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0,0,0,0.55)",
      paddingHorizontal: 4,
      paddingVertical: 3,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    receiptTaskName: {
      fontFamily: fonts.sans,
      fontSize: 8,
      color: "#fff",
      flex: 1,
    },
    receiptPoints: {
      fontFamily: fonts.monoMedium,
      fontSize: 8,
      color: "#fff",
      marginLeft: 2,
    },
    aiBadge: {
      position: "absolute",
      top: 4,
      right: 4,
      backgroundColor: colors.accent,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 3,
    },
    aiBadgeText: {
      fontFamily: fonts.monoMedium,
      fontSize: 7,
      color: colors.paper,
      letterSpacing: 0.5,
    },

    // Groups
    groupList: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.md,
      overflow: "hidden",
    },
    groupRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    groupInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    groupName: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.ink,
      flexShrink: 1,
    },
    roleBadge: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.fog,
      letterSpacing: 0.5,
    },
    openLink: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.accent,
    },
    groupsFooter: { marginTop: 12 },
    groupsFooterText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.fog,
    },

    // Lightbox
    lightboxBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.92)",
      justifyContent: "center",
      alignItems: "center",
    },
    lightboxImage: {
      width: SCREEN_WIDTH - 32,
      height: SCREEN_WIDTH - 32,
      borderRadius: radii.md,
    },
    lightboxClose: {
      position: "absolute",
      top: 60,
      right: 20,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.15)",
      justifyContent: "center",
      alignItems: "center",
    },
    lightboxCloseText: {
      fontFamily: fonts.sansBold,
      fontSize: 16,
      color: "#fff",
    },
  });
