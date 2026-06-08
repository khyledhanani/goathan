import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Modal,
} from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { useSignedProofUrls } from "@/lib/useSignedProofUrls";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_GAP = 3;
const GRID_COLS = 3;
const TILE_SIZE = (SCREEN_WIDTH - 48 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

const MEDAL_COLORS = {
  GOLD: "#d4a420",
  SILVER: "#a0a0a0",
  BRONZE: "#b0703c",
} as const;

type Medal = "GOLD" | "SILVER" | "BRONZE";

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

export default function UserProfileScreen() {
  const colors = useThemeColors();
  const s = styles(colors);
  const router = useRouter();
  const { userId: uid } = useLocalSearchParams<{ userId: string }>();
  const userId = uid as Id<"users">;

  const grid = useQuery(api.proofs.gridForUser, { userId });
  const trophies = useQuery(api.weekResults.trophiesForUser, { userId });
  const streak = useQuery(api.streaks.forUser, { userId });

  // Signed URLs
  const r2Ids = useMemo(() => {
    if (!grid) return [];
    return grid.items
      .filter((i: any) => i.hasR2Proof)
      .map((i: any) => i.completionId);
  }, [grid]);
  const signedUrls = useSignedProofUrls(r2Ids);

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Loading
  if (grid === undefined) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loading}>
          <Text style={s.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const profile = grid.profile;
  const totalMedals =
    (trophies?.counts.gold ?? 0) +
    (trophies?.counts.silver ?? 0) +
    (trophies?.counts.bronze ?? 0);

  // No shared group
  if (!grid.sharesAnyGroup) {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.headerBar}>
            <AnimatedPressable scaleDown={0.95} onPress={() => router.back()} hitSlop={12}>
              <Text style={s.backBtn}>← back</Text>
            </AnimatedPressable>
          </View>
          <View style={s.pageHead}>
            <Text style={s.eyebrow}>Profile</Text>
            <Text style={s.title}>
              {profile?.displayName ?? "User"}
              <Text style={{ color: colors.accent }}>.</Text>
            </Text>
          </View>
          <View style={s.emptyBox}>
            <Text style={s.emptyLine}>
              You don't share a group with this person, so their receipts aren't visible.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.headerBar}>
          <AnimatedPressable scaleDown={0.95} onPress={() => router.back()} hitSlop={12}>
            <Text style={s.backBtn}>← back</Text>
          </AnimatedPressable>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          {profile?.avatarUrl ? (
            <Image
              source={{ uri: profile.avatarUrl }}
              style={s.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarInitial}>
                {profile?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
          <Text style={s.displayName}>{profile?.displayName}</Text>
          {profile?.username && (
            <Text style={s.username}>@{profile.username}</Text>
          )}
          <View style={s.statsRow}>
            <Text style={s.statText}>
              {grid.items.length}{grid.items.length >= 60 ? "+" : ""} receipts
            </Text>
            {streak && streak.current > 0 && (
              <Text style={s.statText}>
                · 🔥 {streak.current} day streak
              </Text>
            )}
          </View>
        </View>

        {/* ── Trophy Cabinet ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>
              Trophy cabinet<Text style={{ color: colors.accent }}>.</Text>
            </Text>
            <Text style={s.sectionCount}>
              {trophies === undefined ? "Loading..." : `${totalMedals} medals`}
            </Text>
          </View>

          {trophies === undefined ? (
            <Text style={s.mutedLine}>Loading...</Text>
          ) : !trophies || trophies.items.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>No medals yet</Text>
              <Text style={s.emptyLine}>Nothing to show yet.</Text>
            </View>
          ) : (
            <View>
              <View style={s.medalCounts}>
                {(["GOLD", "SILVER", "BRONZE"] as Medal[]).map((m) => (
                  <View key={m} style={s.medalChip}>
                    <View
                      style={[s.medalDot, { backgroundColor: MEDAL_COLORS[m] }]}
                    >
                      <Text style={s.medalRank}>
                        {m === "GOLD" ? "1" : m === "SILVER" ? "2" : "3"}
                      </Text>
                    </View>
                    <Text style={s.medalNum}>
                      {trophies.counts[m.toLowerCase() as "gold" | "silver" | "bronze"]}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={s.trophyList}>
                {trophies.items.map((t: any) => (
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

        {/* ── Receipts Grid ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>
              Receipts<Text style={{ color: colors.accent }}>.</Text>
            </Text>
            <Text style={s.sectionCount}>
              Verified · across shared groups
            </Text>
          </View>

          {grid.items.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>Nothing yet</Text>
              <Text style={s.emptyLine}>
                {profile?.displayName ?? "This user"} hasn't posted a verified receipt yet.
              </Text>
            </View>
          ) : (
            <View style={s.receiptGrid}>
              {grid.items.map((item: any) => {
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
                  </AnimatedPressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Lightbox */}
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
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

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

    headerBar: { paddingTop: 8, paddingBottom: 4 },
    backBtn: {
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
      fontSize: 36,
      color: colors.ink,
      letterSpacing: -0.8,
    },

    // Hero
    hero: {
      alignItems: "center",
      gap: 4,
      paddingVertical: 20,
      marginBottom: 16,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      marginBottom: 8,
    },
    avatarFallback: {
      backgroundColor: colors.paper3,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarInitial: {
      fontFamily: fonts.sansBold,
      fontSize: 28,
      color: colors.fog,
    },
    displayName: {
      fontFamily: fonts.serif,
      fontSize: 28,
      color: colors.ink,
    },
    username: {
      fontFamily: fonts.mono,
      fontSize: 12,
      color: colors.fog,
      letterSpacing: 0.3,
    },
    statsRow: {
      flexDirection: "row",
      gap: 4,
      marginTop: 6,
    },
    statText: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.mist,
      letterSpacing: 0.3,
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

    // Empty
    emptyBox: { paddingVertical: 24, alignItems: "center", gap: 6 },
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

    // Medal counts
    medalCounts: { flexDirection: "row", gap: 20, marginBottom: 14 },
    medalChip: { flexDirection: "row", alignItems: "center", gap: 6 },
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
    medalNum: {
      fontFamily: fonts.monoMedium,
      fontSize: 14,
      color: colors.ink,
    },

    // Trophies
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
    receiptImage: { width: "100%", height: "100%" },
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
