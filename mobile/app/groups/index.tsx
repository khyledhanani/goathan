import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Skeleton } from "@/components/Skeleton";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "@/components/Toast";
import { BottomTabBar } from "@/components/BottomTabBar";

export default function GroupsScreen() {
  const colors = useThemeColors();
  const s = styles(colors);
  const router = useRouter();

  const home = useQuery(api.groups.homeView, {});
  const invites = useQuery(api.groups.pendingInvites, {});
  const respondToInvite = useMutation(api.groups.respondToInvite);
  const joinByCode = useMutation(api.groups.joinByCode);

  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastValue>(null);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleJoinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4 || joining) return;
    setJoining(true);
    try {
      const result = await joinByCode({ inviteCode: code });
      if (result.ok) {
        setToast({ message: "Joined group!", tone: "success" });
        setJoinCode("");
        setShowJoinInput(false);
        router.push(`/group/${result.groupId}`);
      } else {
        setToast({ message: result.error, tone: "error" });
      }
    } catch (e) {
      setToast({ message: errorMessage(e, "Could not join."), tone: "error" });
    }
    setJoining(false);
  };

  const handleInviteResponse = async (
    inviteId: Id<"groupInvites">,
    response: "ACCEPT" | "DECLINE",
  ) => {
    setRespondingId(inviteId);
    try {
      const result = await respondToInvite({ inviteId, response });
      if (result.ok) {
        setToast({
          message: result.state === "accepted" ? "Joined!" : "Declined.",
          tone: result.state === "accepted" ? "success" : "error",
        });
        if (result.state === "accepted" && result.groupId) {
          router.push(`/group/${result.groupId}`);
        }
      } else {
        setToast({ message: result.error, tone: "error" });
      }
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
    setRespondingId(null);
  };

  if (!home) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={[s.scroll, { gap: 16, paddingTop: 16 }]}>
          <Skeleton width={60} height={12} radius={4} />
          <Skeleton width={200} height={48} radius={6} />
          <Skeleton width={180} height={12} radius={4} />
          {/* Group card skeletons */}
          {[1,2].map(i => (
            <View key={i} style={{ borderWidth: 1, borderColor: colors.rule, borderRadius: 10, padding: 16, gap: 12 }}>
              <Skeleton width={120} height={10} radius={4} />
              <Skeleton width={200} height={28} radius={6} />
              <View style={{ flexDirection: "row", gap: -8 }}>
                {[1,2,3].map(j => <Skeleton key={j} width={28} height={28} radius={14} />)}
              </View>
              <Skeleton width={"100%"} height={60} radius={6} />
            </View>
          ))}
        </View>
        <BottomTabBar />
      </SafeAreaView>
    );
  }

  const pendingInvites = invites ?? [];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
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
        <View style={s.pageHead}>
          <Text style={s.eyebrow}>Where the work happens</Text>
          <Text style={s.title}>
            Groups
            <Text style={{ color: colors.accent }}>.</Text>
          </Text>
          <Text style={s.statsLine}>
            {home.totals.weekPoints} pts this week · {home.totals.todayDone}/
            {home.totals.totalDailyTasks} done today
          </Text>
        </View>

        {/* ── Create / Join ── */}
        <View style={s.actions}>
          <Pressable
            style={({ pressed }) => [
              s.actionBtn,
              { backgroundColor: pressed ? colors.ink : colors.paper3 },
            ]}
            onPress={() => router.push("/groups/create")}
          >
            {({ pressed }) => (
              <Text
                style={[
                  s.actionBtnText,
                  { color: pressed ? colors.paper : colors.ink },
                ]}
              >
                Create a group
              </Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              s.actionBtn,
              {
                backgroundColor: showJoinInput
                  ? colors.accentSoft
                  : pressed
                    ? colors.ink
                    : colors.paper3,
              },
            ]}
            onPress={() => setShowJoinInput(!showJoinInput)}
          >
            <Text
              style={[
                s.actionBtnText,
                { color: showJoinInput ? colors.accent : colors.ink },
              ]}
            >
              Join with code
            </Text>
          </Pressable>
        </View>

        {/* Join code input */}
        {showJoinInput && (
          <View style={s.joinRow}>
            <TextInput
              style={s.joinInput}
              value={joinCode}
              onChangeText={(t) =>
                setJoinCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              placeholder="INVITE CODE"
              placeholderTextColor={colors.mist}
              maxLength={8}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleJoinByCode}
            />
            <AnimatedPressable
              scaleDown={0.92}
              style={[
                s.joinBtn,
                {
                  backgroundColor:
                    joinCode.trim().length >= 4 ? colors.accent : colors.paper3,
                },
              ]}
              onPress={handleJoinByCode}
              disabled={joinCode.trim().length < 4 || joining}
            >
              {joining ? (
                <ActivityIndicator size="small" color={colors.paper} />
              ) : (
                <Text
                  style={[
                    s.joinBtnText,
                    {
                      color:
                        joinCode.trim().length >= 4 ? colors.paper : colors.mist,
                    },
                  ]}
                >
                  Join
                </Text>
              )}
            </AnimatedPressable>
          </View>
        )}

        {/* ── Pending invites ── */}
        {pendingInvites.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>
                Invites<Text style={{ color: colors.accent }}>.</Text>
              </Text>
              <Text style={s.sectionBadge}>
                {pendingInvites.length} pending
              </Text>
            </View>
            {pendingInvites.map((inv) => (
              <View key={inv._id} style={s.inviteCard}>
                <View style={s.inviteTop}>
                  {inv.invitedByAvatarUrl ? (
                    <Image
                      source={{ uri: inv.invitedByAvatarUrl }}
                      style={s.inviteAvatar}
                      transition={150}
                    />
                  ) : (
                    <View style={s.inviteAvatarFallback}>
                      <Text style={s.inviteAvatarLetter}>
                        {inv.invitedByName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.inviteText}>
                      <Text style={{ fontFamily: fonts.sansSemiBold }}>
                        {inv.invitedByName}
                      </Text>
                      {" invited you to "}
                      <Text style={{ fontFamily: fonts.sansSemiBold }}>
                        {inv.groupName}
                      </Text>
                    </Text>
                    <Text style={s.inviteDate}>
                      {new Date(inv.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                </View>
                <View style={s.inviteActions}>
                  <AnimatedPressable
                    scaleDown={0.92}
                    style={[s.inviteBtn, { backgroundColor: colors.accent }]}
                    onPress={() => handleInviteResponse(inv._id, "ACCEPT")}
                    disabled={respondingId === inv._id || !inv.groupExists}
                  >
                    <Text style={[s.inviteBtnText, { color: colors.paper }]}>
                      {respondingId === inv._id ? "..." : "Accept"}
                    </Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    scaleDown={0.92}
                    haptic="medium"
                    style={[s.inviteBtn, { backgroundColor: colors.paper3 }]}
                    onPress={() => handleInviteResponse(inv._id, "DECLINE")}
                    disabled={respondingId === inv._id}
                  >
                    <Text style={[s.inviteBtnText, { color: colors.smoke }]}>
                      Decline
                    </Text>
                  </AnimatedPressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Group cards ── */}
        {home.groups.length > 0 ? (
          <View style={s.section}>
            {home.groups.map((g) => (
              <GroupCard
                key={g._id}
                group={g}
                colors={colors}
                onPress={() => router.push(`/group/${g._id}`)}
              />
            ))}
          </View>
        ) : (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>No groups yet</Text>
            <Text style={s.emptyBody}>
              Create one or ask a friend for an invite code.
            </Text>
          </View>
        )}
      </ScrollView>

      <Toast value={toast} onDismiss={() => setToast(null)} />
      <BottomTabBar />
    </SafeAreaView>
  );
}

// ── Group Card ─────────────────────────────────────────────────────────

interface GroupCardProps {
  group: NonNullable<ReturnType<typeof useGroupType>>;
  colors: Colors;
  onPress: () => void;
}

// Helper type — extract one group from homeView
function useGroupType() {
  const h = useQuery(api.groups.homeView, {});
  return h?.groups[0];
}

function GroupCard({ group: g, colors, onPress }: GroupCardProps) {
  const s = styles(colors);
  const leading = g.isLeading;

  return (
    <AnimatedPressable scaleDown={0.98} style={s.groupCard} onPress={onPress}>
      {/* Meta */}
      <Text style={s.groupMeta}>
        {g.isAdmin ? "admin · you" : "member"} · {g.memberCount}{" "}
        {g.memberCount === 1 ? "person" : "people"}
      </Text>

      {/* Name */}
      <Text style={s.groupName}>{g.name}</Text>

      {/* Avatar stack */}
      {g.memberAvatars.length > 0 && (
        <View style={s.avatarStack}>
          {g.memberAvatars.slice(0, 5).map((m, i) =>
            m.avatarUrl ? (
              <Image
                key={i}
                source={{ uri: m.avatarUrl }}
                style={[s.stackAvatar, i > 0 && { marginLeft: -8 }]}
                transition={150}
              />
            ) : (
              <View
                key={i}
                style={[s.stackAvatarFallback, i > 0 && { marginLeft: -8 }]}
              >
                <Text style={s.stackAvatarLetter}>
                  {m.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            ),
          )}
        </View>
      )}

      {/* Stake */}
      {g.stakeText && (
        <View style={s.stakeRow}>
          <Text style={s.stakeIcon}>
            {g.stakeKind === "REWARD" ? "🏆" : "⚡"}
          </Text>
          <Text style={s.stakeLabel}>
            {g.stakeKind === "REWARD" ? "Reward" : "Penalty"}
          </Text>
          <Text style={s.stakeText} numberOfLines={2}>
            {g.stakeText}
          </Text>
        </View>
      )}

      {/* Scoreboard */}
      <View style={s.scoreboard}>
        <ScoreCell
          label="Rank"
          value={`#${g.rank}`}
          sub={`of ${g.memberCount}`}
          accent={leading}
          colors={colors}
        />
        <ScoreCell
          label="Gap"
          value={
            leading
              ? "—"
              : `${g.gapToLeader}`
          }
          sub={
            leading
              ? "Leading"
              : g.leaderFirstName
                ? `Behind ${g.leaderFirstName}`
                : "Behind"
          }
          accent={leading}
          colors={colors}
        />
        <ScoreCell
          label="Today"
          value={`${g.stats.todayDone}/${g.stats.totalDailyTasks}`}
          sub={g.stats.isPerfectToday ? "Perfect!" : ""}
          accent={g.stats.isPerfectToday}
          colors={colors}
        />
        <ScoreCell
          label="Week"
          value={`${g.stats.weekPoints}`}
          sub="pts"
          accent={false}
          colors={colors}
        />
      </View>

      {/* Enter button */}
      <View style={s.enterRow}>
        <Text style={[s.enterText, leading && { color: colors.accent }]}>
          Enter group →
        </Text>
      </View>
    </AnimatedPressable>
  );
}

function ScoreCell({
  label,
  value,
  sub,
  accent,
  colors,
}: {
  label: string;
  value: string;
  sub: string;
  accent: boolean;
  colors: Colors;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: 9,
          letterSpacing: 1.2,
          textTransform: "uppercase" as const,
          color: colors.mist,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: 16,
          color: accent ? colors.accent : colors.ink,
        }}
      >
        {value}
      </Text>
      {sub ? (
        <Text
          style={{
            fontFamily: fonts.mono,
            fontSize: 9,
            color: accent ? colors.accent : colors.fog,
            letterSpacing: 0.3,
          }}
          numberOfLines={1}
        >
          {sub}
        </Text>
      ) : null}
    </View>
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
      fontSize: 48,
      color: colors.ink,
      letterSpacing: -1,
    },
    statsLine: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.fog,
      letterSpacing: 0.5,
    },

    // Actions
    actions: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 20,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: radii.md,
      alignItems: "center",
    },
    actionBtnText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      letterSpacing: 0.1,
    },

    // Join input
    joinRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 20,
    },
    joinInput: {
      flex: 1,
      fontFamily: fonts.monoMedium,
      fontSize: 16,
      color: colors.ink,
      letterSpacing: 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
      paddingVertical: 10,
    },
    joinBtn: {
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: radii.md,
      justifyContent: "center",
      alignItems: "center",
    },
    joinBtnText: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
    },

    // Sections
    section: {
      gap: 12,
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 10,
    },
    sectionTitle: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 28,
      color: colors.ink,
      letterSpacing: -0.3,
    },
    sectionBadge: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      color: colors.accent,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.pill,
      overflow: "hidden",
      letterSpacing: 0.5,
    },

    // Invite card
    inviteCard: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.md,
      padding: 14,
      gap: 12,
    },
    inviteTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    inviteAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    inviteAvatarFallback: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.paper3,
      justifyContent: "center",
      alignItems: "center",
    },
    inviteAvatarLetter: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
      color: colors.smoke,
    },
    inviteText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.ink,
      lineHeight: 19,
    },
    inviteDate: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.mist,
      marginTop: 2,
    },
    inviteActions: {
      flexDirection: "row",
      gap: 8,
    },
    inviteBtn: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: radii.md,
    },
    inviteBtnText: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 12,
    },

    // Group card
    groupCard: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.md,
      padding: 16,
      gap: 12,
      backgroundColor: colors.paper,
    },
    groupMeta: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: "uppercase",
      color: colors.fog,
    },
    groupName: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 28,
      color: colors.ink,
      letterSpacing: -0.3,
    },
    avatarStack: {
      flexDirection: "row",
      alignItems: "center",
    },
    stackAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.paper,
    },
    stackAvatarFallback: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.paper,
      backgroundColor: colors.paper3,
      justifyContent: "center",
      alignItems: "center",
    },
    stackAvatarLetter: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 10,
      color: colors.smoke,
    },
    stakeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: colors.paper2,
      borderRadius: radii.sm,
    },
    stakeIcon: {
      fontSize: 14,
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
    scoreboard: {
      flexDirection: "row",
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.rule,
    },
    enterRow: {
      alignItems: "flex-end",
    },
    enterText: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.smoke,
      letterSpacing: 0.1,
    },

    // Empty
    emptyState: {
      paddingVertical: 60,
      alignItems: "center",
      gap: 10,
    },
    emptyTitle: {
      fontFamily: fonts.serif,
      fontStyle: "italic",
      fontSize: 28,
      color: colors.ink,
    },
    emptyBody: {
      fontFamily: fonts.sans,
      fontSize: 14,
      color: colors.fog,
      textAlign: "center",
    },
  });
