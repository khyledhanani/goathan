import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { errorMessage } from "@/lib/errors";
import { mainGoalLabel } from "@/lib/types";
import { useThemeChoice, type ThemeChoice } from "@/lib/ThemeContext";
import { Toast, type ToastValue } from "@/components/Toast";

// ── Notification kind labels ───────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
  LIKE: "Reactions on your receipts",
  COMMENT: "Comments on your receipts",
  CAP_CALLED: "When someone calls cap on you",
  CAP_REVOKED: "When your points get revoked",
  CAP_RESTORED: "When your points are restored",
  MEDAL_AWARDED: "Weekly medal awards",
  MEMBER_JOINED: "When someone joins your group",
  GROUP_INVITE: "When someone invites you to a group",
  DAILY_RESET_REMINDER: "Daily reset reminder",
};

// ── Component ──────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors = useThemeColors();
  const s = styles(colors);
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { choice: themeChoice, setChoice: setThemeChoice } = useThemeChoice();

  const profile = useQuery(api.profiles.getCurrentProfile);
  const groups = useQuery(api.groups.getMyGroups, {});
  const notifPrefs = useQuery(api.notificationPreferences.get, {});
  const setPushEnabled = useMutation(api.notificationPreferences.setPushEnabled);
  const setKindMuted = useMutation(api.notificationPreferences.setKindMuted);
  const leaveGroup = useMutation(api.groups.leave);

  const [signingOut, setSigningOut] = useState(false);
  const [toast, setToast] = useState<ToastValue>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/");
    } catch {
      setSigningOut(false);
    }
  };

  const handleLeaveGroup = (groupId: Id<"groups">, groupName: string, isAdmin: boolean) => {
    Alert.alert(
      `Leave ${groupName}?`,
      isAdmin
        ? "You're admin. If others remain, admin passes to the longest-tenured member. All your standings and completions will be deleted."
        : "Your standings, completions, and history in this group will be deleted. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isAdmin ? "Leave anyway" : "Leave group",
          style: "destructive",
          onPress: async () => {
            setLeavingId(groupId);
            try {
              await leaveGroup({ groupId });
              setToast({ message: `Left ${groupName}`, tone: "success" });
            } catch (e) {
              setToast({ message: errorMessage(e), tone: "error" });
            }
            setLeavingId(null);
          },
        },
      ],
    );
  };

  const handleTogglePush = async (enabled: boolean) => {
    try {
      await setPushEnabled({ enabled });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  const handleToggleKind = async (kind: string, muted: boolean) => {
    try {
      await setKindMuted({ kind, muted });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

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

        <View style={s.pageHead}>
          <Text style={s.eyebrow}>Account</Text>
          <Text style={s.title}>
            Settings<Text style={{ color: colors.accent }}>.</Text>
          </Text>
        </View>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* APPEARANCE                                                  */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Appearance</Text>
          <View style={s.themeRow}>
            {(["system", "light", "dark"] as ThemeChoice[]).map((opt) => {
              const active = themeChoice === opt;
              return (
                <AnimatedPressable
                  key={opt}
                  scaleDown={0.92}
                  style={[s.themeOption, active && s.themeOptionActive]}
                  onPress={() => setThemeChoice(opt)}
                >
                  <Text
                    style={[s.themeLabel, active && s.themeLabelActive]}
                  >
                    {opt === "system" ? "System" : opt === "light" ? "Light" : "Dark"}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* YOUR DETAILS                                                */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your details</Text>
          {profile && (
            <View style={s.detailsCard}>
              <DetailRow label="Display name" value={profile.displayName} colors={colors} />
              <DetailRow label="Username" value={profile.username ? `@${profile.username}` : "—"} colors={colors} />
              <DetailRow label="Email" value={profile.email} colors={colors} />
              <DetailRow label="Goal" value={mainGoalLabel(profile.mainGoal)} colors={colors} last />
            </View>
          )}
        </View>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* NOTIFICATIONS                                               */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Notifications</Text>
          {notifPrefs && (
            <View style={s.notifCard}>
              {/* Master switch */}
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.switchLabel}>Push notifications</Text>
                  <Text style={s.switchHint}>
                    When off, push is suppressed but inbox still records everything.
                  </Text>
                </View>
                <Switch
                  value={notifPrefs.pushEnabled}
                  onValueChange={handleTogglePush}
                  trackColor={{ true: colors.accent, false: colors.paper3 }}
                  thumbColor={colors.paper}
                />
              </View>

              {/* Divider */}
              <View style={s.divider} />

              {/* Individual kinds */}
              {notifPrefs.allKinds.map((kind) => {
                const muted = notifPrefs.mutedKinds.includes(kind);
                const label = KIND_LABELS[kind] ?? kind;
                return (
                  <View key={kind} style={s.switchRow}>
                    <Text style={[s.kindLabel, muted && { color: colors.mist }]}>
                      {label}
                    </Text>
                    <Switch
                      value={!muted}
                      onValueChange={(enabled) => handleToggleKind(kind, !enabled)}
                      trackColor={{ true: colors.accent, false: colors.paper3 }}
                      thumbColor={colors.paper}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* YOUR GROUPS                                                 */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your groups</Text>
          {groups && groups.length > 0 ? (
            <View style={s.groupList}>
              {groups.map((g) => (
                <View key={g._id} style={s.groupRow}>
                  <View style={s.groupInfo}>
                    <Text style={s.groupName}>{g.name}</Text>
                    <Text style={s.roleBadge}>
                      {g.isAdmin ? "Admin" : "Member"}
                    </Text>
                  </View>
                  <View style={s.groupActions}>
                    <AnimatedPressable scaleDown={0.95} onPress={() => router.push(`/group/${g._id}`)}>
                      <Text style={s.openLink}>Open →</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      scaleDown={0.95}
                      haptic="medium"
                      onPress={() => handleLeaveGroup(g._id, g.name, g.isAdmin)}
                      disabled={leavingId === g._id}
                    >
                      <Text style={s.leaveLink}>
                        {leavingId === g._id ? "..." : "Leave"}
                      </Text>
                    </AnimatedPressable>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.emptyText}>No groups yet.</Text>
          )}
        </View>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* SIGN OUT                                                    */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <AnimatedPressable
          scaleDown={0.97}
          haptic="medium"
          style={s.signOutBtn}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator size="small" color={colors.cap} />
          ) : (
            <Text style={s.signOutText}>Sign out</Text>
          )}
        </AnimatedPressable>
      </ScrollView>

      <Toast value={toast} onDismiss={() => setToast(null)} />
    </SafeAreaView>
  );
}

// ── Detail Row ─────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  colors,
  last,
}: {
  label: string;
  value: string;
  colors: Colors;
  last?: boolean;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: 10,
        },
        !last && {
          borderBottomWidth: 1,
          borderBottomColor: colors.rule,
        },
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: 1,
          textTransform: "uppercase" as const,
          color: colors.fog,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: fonts.sansMedium,
          fontSize: 13,
          color: colors.ink,
          maxWidth: "60%",
          textAlign: "right",
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
    scroll: { paddingHorizontal: 24, paddingBottom: 60 },

    // Header
    headerBar: { paddingTop: 8, paddingBottom: 4 },
    backBtn: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.smoke, letterSpacing: 1.1, textTransform: "uppercase" },
    pageHead: { gap: 6, paddingVertical: 16, marginBottom: 8 },
    eyebrow: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.fog },
    title: { fontFamily: fonts.serif, fontStyle: "italic", fontSize: 48, color: colors.ink, letterSpacing: -1 },

    // Sections
    section: { marginBottom: 28 },
    sectionTitle: { fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.fog, marginBottom: 10 },

    // Theme toggle
    themeRow: { flexDirection: "row", gap: 8 },
    themeOption: {
      flex: 1,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.md,
      alignItems: "center",
    },
    themeOptionActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    themeLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.smoke,
    },
    themeLabelActive: { color: colors.accent },

    // Details card
    detailsCard: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.md,
      paddingHorizontal: 14,
    },

    // Notifications
    notifCard: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      gap: 12,
    },
    switchLabel: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.ink,
    },
    switchHint: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.mist,
      marginTop: 2,
      lineHeight: 13,
    },
    kindLabel: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.ink,
      flex: 1,
    },
    divider: {
      height: 1,
      backgroundColor: colors.rule,
      marginVertical: 4,
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
    groupActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    openLink: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.accent,
    },
    leaveLink: {
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      color: colors.cap,
    },
    emptyText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.fog,
    },

    // Sign out
    signOutBtn: {
      paddingVertical: 14,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.cap,
      alignItems: "center",
      marginTop: 8,
    },
    signOutText: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
      color: colors.cap,
    },
  });
