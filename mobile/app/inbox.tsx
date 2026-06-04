import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { timeAgo } from "@/lib/timeAgo";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "@/components/Toast";

// ── Kind labels ───────────────────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
  LIKE: "Reaction",
  COMMENT: "Comment",
  CAP_CALLED: "Cap called",
  CAP_REVOKED: "Revoked",
  CAP_RESTORED: "Restored",
  MEDAL_AWARDED: "Medal",
  MEMBER_JOINED: "New member",
  GROUP_INVITE: "Invite",
  DAILY_RESET_REMINDER: "Reminder",
  FIRST_RECEIPT: "First receipt",
};

// ── Component ─────────────────────────────────────────────────────────

export default function InboxScreen() {
  const colors = useThemeColors();
  const s = styles(colors);
  const router = useRouter();

  const data = useQuery(api.notifications.recent, {});
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastValue>(null);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleTap = async (n: any) => {
    try {
      await markRead({ notificationId: n._id });
    } catch {}
    if (n.deepLinkPath) {
      router.push(n.deepLinkPath);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead({});
      setToast({ message: "All caught up!", tone: "success" });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  const unread = data?.unreadCount ?? 0;

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
        {/* Header */}
        <View style={s.headerBar}>
          <AnimatedPressable scaleDown={0.95} onPress={() => router.back()} hitSlop={12}>
            <Text style={s.backBtn}>← back</Text>
          </AnimatedPressable>
        </View>

        <View style={s.pageHead}>
          <Text style={s.eyebrow}>
            {data === undefined
              ? "Loading..."
              : unread > 0
                ? `${unread} unread`
                : data.items.length > 0
                  ? "Caught up"
                  : "Empty"}
          </Text>
          <Text style={s.title}>
            Inbox<Text style={{ color: colors.accent }}>.</Text>
          </Text>
        </View>

        {/* Mark all read */}
        {unread > 0 && (
          <AnimatedPressable scaleDown={0.92} style={s.markAllBtn} onPress={handleMarkAllRead}>
            <Text style={s.markAllText}>Mark all read</Text>
          </AnimatedPressable>
        )}

        {/* Empty state */}
        {data && data.items.length === 0 && (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>Empty inbox</Text>
            <Text style={s.emptyLine}>
              Reactions, comments, and caps will land here.
            </Text>
          </View>
        )}

        {/* Notification list */}
        {data && data.items.length > 0 && (
          <View style={s.list}>
            {data.items.map((n: any) => {
              const isUnread = !n.readAt;
              return (
                <AnimatedPressable
                  key={n._id}
                  scaleDown={0.98}
                  style={[s.row, isUnread && s.rowUnread]}
                  onPress={() => handleTap(n)}
                >
                  {isUnread && <View style={s.unreadDot} />}
                  <View style={s.rowContent}>
                    <View style={s.rowMeta}>
                      <Text style={s.kindLabel}>
                        {KIND_LABELS[n.kind] ?? n.kind}
                      </Text>
                      <Text style={s.rowTime}>{timeAgo(n.createdAt)}</Text>
                    </View>
                    <Text style={s.rowTitle} numberOfLines={2}>
                      {n.title}
                    </Text>
                    {n.body ? (
                      <Text style={s.rowBody} numberOfLines={2}>
                        {n.body}
                      </Text>
                    ) : null}
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Toast value={toast} onDismiss={() => setToast(null)} />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.paper },
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
      fontStyle: "italic",
      fontSize: 48,
      color: colors.ink,
      letterSpacing: -1,
    },

    // Mark all
    markAllBtn: {
      alignSelf: "flex-start",
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.pill,
      marginBottom: 16,
    },
    markAllText: {
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      color: colors.accent,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },

    // Empty
    emptyBox: { paddingVertical: 40, alignItems: "center", gap: 6 },
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
    },

    // List
    list: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.md,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    rowUnread: {
      backgroundColor: colors.paper2,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
      marginTop: 5,
    },
    rowContent: { flex: 1, gap: 3 },
    rowMeta: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    kindLabel: {
      fontFamily: fonts.monoMedium,
      fontSize: 9,
      color: colors.fog,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    rowTime: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.mist,
      letterSpacing: 0.5,
    },
    rowTitle: {
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      color: colors.ink,
      lineHeight: 20,
    },
    rowBody: {
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.smoke,
      lineHeight: 17,
    },
  });
