import { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Share,
  Alert,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { Skeleton } from "@/components/Skeleton";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useConvex } from "convex/react";
import * as Clipboard from "expo-clipboard";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSignedProofUrls } from "@/lib/useSignedProofUrls";
import { hapticSuccess } from "@/lib/haptics";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "@/components/Toast";
import { TodaySlate } from "@/components/TodaySlate";
import { StandingsTable } from "@/components/StandingsTable";
import { ActivityFeed } from "@/components/ActivityFeed";
import { pickProofImage, takeProofPhoto, uploadProof } from "@/lib/upload";

export default function GroupDetailScreen() {
  const colors = useThemeColors();
  const s = styles(colors);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id as Id<"groups">;

  // ── Data ──────────────────────────────────────────────────────────────
  const today = useQuery(api.groups.todayView, { groupId });
  const standings = useQuery(api.groups.weeklyStandings, { groupId });
  const activity = useQuery(api.groups.recentActivity, { groupId, limit: 20 });

  const convex = useConvex();
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastValue>(null);
  const [uploadPhase, setUploadPhase] = useState<string | null>(null);
  const [lastVerifiedId, setLastVerifiedId] = useState<Id<"completions"> | null>(null);

  // ── Signed URLs for activity proofs ───────────────────────────────────
  const r2Ids = useMemo(() => {
    if (!activity) return [];
    return activity
      .filter((a) => a.hasR2Proof)
      .map((a) => a.completionId);
  }, [activity]);
  const signedUrls = useSignedProofUrls(r2Ids);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // ── Proof upload handler ─────────────────────────────────────────────
  const handleUploadProof = (completionId: Id<"completions">, taskName: string) => {
    const doUpload = async (source: "camera" | "library") => {
      console.log("[Upload] Starting proof upload:", { completionId, taskName, source });
      const asset =
        source === "camera"
          ? await takeProofPhoto()
          : await pickProofImage();

      if (!asset) {
        console.log("[Upload] User cancelled image selection");
        return;
      }

      console.log("[Upload] Asset selected:", {
        width: asset.width,
        height: asset.height,
        uri: asset.uri?.slice(0, 60),
      });

      setUploadPhase("Compressing...");
      const result = await uploadProof(convex, completionId, asset, (phase) => {
        console.log("[Upload] Phase:", phase);
        const labels = {
          picking: "Selecting...",
          compressing: "Compressing...",
          uploading: "Uploading...",
          verifying: "Verifying...",
        };
        setUploadPhase(labels[phase]);
      });
      setUploadPhase(null);

      if (result.ok) {
        console.log("[Upload] Success for:", taskName);
        hapticSuccess();
        setToast({ message: `Verified "${taskName}"`, tone: "success" });
        setLastVerifiedId(completionId);
      } else {
        console.error("[Upload] Failed:", result.error);
        setToast({ message: result.error, tone: "error" });
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Take Photo", "Choose from Library", "Cancel"],
          cancelButtonIndex: 2,
          title: `Proof for "${taskName}"`,
        },
        (idx) => {
          if (idx === 0) doUpload("camera");
          else if (idx === 1) doUpload("library");
        },
      );
    } else {
      Alert.alert(`Proof for "${taskName}"`, undefined, [
        { text: "Take Photo", onPress: () => doUpload("camera") },
        { text: "Choose from Library", onPress: () => doUpload("library") },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  // ── Invite share ──────────────────────────────────────────────────────
  const handleShareInvite = async () => {
    if (!today) return;
    const code = today.group.inviteCode;
    try {
      await Share.share({
        message: `Join my group "${today.group.name}" on Receipts! Use code: ${code}`,
      });
    } catch {
      // Copy to clipboard as fallback
      await Clipboard.setStringAsync(code);
      setToast({ message: `Code ${code} copied`, tone: "success" });
    }
  };

  const handleCopyCode = async () => {
    if (!today) return;
    await Clipboard.setStringAsync(today.group.inviteCode);
    hapticSuccess();
    setToast({ message: "Invite code copied!", tone: "success" });
  };

  // ── Loading ───────────────────────────────────────────────────────────
  if (!today) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={{ paddingHorizontal: 24, gap: 16, paddingTop: 16 }}>
          <Skeleton width={60} height={12} radius={4} />
          <Skeleton width={240} height={36} radius={6} />
          <Skeleton width={160} height={12} radius={4} />
          {/* Slate row skeletons */}
          <View style={{ borderWidth: 1, borderColor: colors.rule, borderRadius: 10, overflow: "hidden" }}>
            {[1,2,3,4].map(i => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, gap: 10, borderBottomWidth: i < 4 ? 1 : 0, borderBottomColor: colors.rule }}>
                <Skeleton width={22} height={22} radius={11} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Skeleton width={140} height={14} radius={4} />
                  <Skeleton width={100} height={10} radius={4} />
                </View>
                <Skeleton width={50} height={28} radius={999} />
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const { group, slate, stats, isAdmin } = today;

  // Period label
  const periodLabel = stats.cadence === "monthly"
    ? `month of ${new Date().toLocaleString("en-US", { month: "long" })}`
    : stats.durationDays === 7
      ? "this week"
      : `${stats.durationDays}-day period`;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.fog}
          />
        }
      >
        {/* ── Header ── */}
        <View style={s.headerBar}>
          <AnimatedPressable scaleDown={0.95} onPress={() => router.back()} hitSlop={12}>
            <Text style={s.backBtn}>← back</Text>
          </AnimatedPressable>
          <View style={s.headerActions}>
            {isAdmin && (
              <AnimatedPressable scaleDown={0.95} onPress={() => router.push(`/group/edit/${groupId}`)}>
                <Text style={s.headerLink}>edit</Text>
              </AnimatedPressable>
            )}
            <AnimatedPressable scaleDown={0.95} onPress={handleShareInvite}>
              <Text style={s.headerLink}>invite</Text>
            </AnimatedPressable>
          </View>
        </View>

        <View style={s.pageHead}>
          <Text style={s.eyebrow}>{periodLabel}</Text>
          <Text style={s.title}>{group.name}</Text>
          <Text style={s.statsLine}>
            {stats.todayPoints} pts today · {stats.weekPoints} this week ·{" "}
            {stats.todayDone}/{stats.totalDailyTasks} done
          </Text>
          {stats.isPerfectToday && (
            <Text style={s.perfectBadge}>Perfect day!</Text>
          )}
        </View>

        {/* Stake */}
        {group.stakeText && (
          <View style={s.stakeRow}>
            <Text style={s.stakeIcon}>
              {group.stakeKind === "REWARD" ? "🏆" : "⚡"}
            </Text>
            <Text style={s.stakeLabel}>
              {group.stakeKind === "REWARD" ? "Reward" : "Penalty"}
            </Text>
            <Text style={s.stakeText} numberOfLines={2}>
              {group.stakeText}
            </Text>
          </View>
        )}

        {/* Invite code */}
        <AnimatedPressable scaleDown={0.92} style={s.codeRow} onPress={handleCopyCode}>
          <Text style={s.codeLabel}>Invite code</Text>
          <Text style={s.codeValue}>{group.inviteCode}</Text>
          <Text style={s.codeCopy}>copy</Text>
        </AnimatedPressable>

        {/* ── Today's Slate ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>
            Today's slate<Text style={{ color: colors.accent }}>.</Text>
          </Text>
          <TodaySlate
            slate={slate}
            stats={stats}
            isAdmin={isAdmin}
            onUploadProof={handleUploadProof}
            onError={(msg) => setToast({ message: msg, tone: "error" })}
          />
        </View>

        {/* ── Standings ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>
            Standings<Text style={{ color: colors.accent }}>.</Text>
          </Text>
          {standings ? (
            <StandingsTable standings={standings} />
          ) : (
            <View style={{ gap: 2 }}>
              {[1,2,3].map(i => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, gap: 10 }}>
                  <Skeleton width={24} height={14} radius={4} />
                  <Skeleton width={32} height={32} radius={16} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Skeleton width={100} height={13} radius={4} />
                    <Skeleton width={70} height={10} radius={4} />
                  </View>
                  <Skeleton width={36} height={16} radius={4} />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Activity ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>
            On the board<Text style={{ color: colors.accent }}>.</Text>
          </Text>
          {activity ? (
            <ActivityFeed items={activity} signedUrls={signedUrls} />
          ) : (
            <View style={{ gap: 14 }}>
              {[1,2,3].map(i => (
                <View key={i} style={{ flexDirection: "row", gap: 10 }}>
                  <Skeleton width={30} height={30} radius={15} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Skeleton width={200} height={13} radius={4} />
                    <Skeleton width={120} height={10} radius={4} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Upload progress overlay */}
      {uploadPhase && (
        <View style={s.uploadOverlay}>
          <View style={s.uploadBox}>
            <Text style={s.uploadPhase}>{uploadPhase}</Text>
          </View>
        </View>
      )}

      {/* Expand proof prompt */}
      {lastVerifiedId && !uploadPhase && (
        <Animated.View entering={SlideInDown.springify().damping(15).stiffness(200)} style={s.expandPrompt}>
          <Text style={s.expandText}>Use this proof for more tasks?</Text>
          <View style={s.expandActions}>
            <AnimatedPressable
              scaleDown={0.92}
              style={[s.expandBtn, { backgroundColor: colors.accent }]}
              onPress={() => {
                const cId = lastVerifiedId;
                setLastVerifiedId(null);
                router.push(`/group/expand/${cId}`);
              }}
            >
              <Text style={[s.expandBtnText, { color: colors.paper }]}>
                Expand proof
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              scaleDown={0.92}
              style={[s.expandBtn, { backgroundColor: colors.paper3 }]}
              onPress={() => setLastVerifiedId(null)}
            >
              <Text style={[s.expandBtnText, { color: colors.smoke }]}>
                Dismiss
              </Text>
            </AnimatedPressable>
          </View>
        </Animated.View>
      )}

      <Toast value={toast} onDismiss={() => setToast(null)} />
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
    scroll: {
      paddingHorizontal: 24,
      paddingBottom: 40,
    },

    // Header
    headerBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 8,
      paddingBottom: 4,
    },
    backBtn: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      color: colors.smoke,
      letterSpacing: 1.1,
      textTransform: "uppercase",
    },
    headerActions: {
      flexDirection: "row",
      gap: 14,
    },
    headerLink: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      color: colors.smoke,
      letterSpacing: 1.1,
      textTransform: "uppercase",
    },

    // Page head
    pageHead: {
      gap: 6,
      paddingVertical: 16,
    },
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
      fontSize: 40,
      color: colors.ink,
      letterSpacing: -0.8,
    },
    statsLine: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.fog,
      letterSpacing: 0.5,
    },
    perfectBadge: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      color: colors.accent,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.pill,
      alignSelf: "flex-start",
      overflow: "hidden",
      letterSpacing: 0.5,
      marginTop: 4,
    },

    // Stake
    stakeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.paper2,
      borderRadius: radii.md,
      marginBottom: 12,
    },
    stakeIcon: {
      fontSize: 16,
    },
    stakeLabel: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      color: colors.fog,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    stakeText: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.smoke,
    },

    // Invite code
    codeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.paper2,
      borderRadius: radii.md,
      marginBottom: 20,
    },
    codeLabel: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.mist,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    codeValue: {
      fontFamily: fonts.monoMedium,
      fontSize: 16,
      color: colors.ink,
      letterSpacing: 2,
      flex: 1,
    },
    codeCopy: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      color: colors.accent,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },

    // Sections
    section: {
      marginBottom: 28,
      gap: 12,
    },
    sectionTitle: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 28,
      color: colors.ink,
      letterSpacing: -0.3,
    },

    // Upload overlay
    uploadOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 200,
    },
    uploadBox: {
      backgroundColor: colors.paper,
      paddingVertical: 20,
      paddingHorizontal: 32,
      borderRadius: radii.md,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 10,
    },
    uploadPhase: {
      fontFamily: fonts.monoMedium,
      fontSize: 13,
      color: colors.ink,
      letterSpacing: 0.5,
    },

    // Expand proof prompt
    expandPrompt: {
      position: "absolute",
      bottom: 40,
      left: 24,
      right: 24,
      backgroundColor: colors.paper2,
      borderRadius: radii.md,
      padding: 16,
      gap: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
      zIndex: 100,
    },
    expandText: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.ink,
    },
    expandActions: {
      flexDirection: "row",
      gap: 8,
    },
    expandBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: radii.pill,
    },
    expandBtnText: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
    },
  });
