import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { timeAgo } from "@/lib/timeAgo";
import { errorMessage } from "@/lib/errors";
import { notifRoute } from "@/lib/notifTarget";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Icon } from "@/components/ui/Icon";
import { PillBtn, EmptyState } from "@/components/ui/primitives";
import { Toast, type ToastValue } from "@/components/Toast";
import type { Id } from "../convex/_generated/dataModel";

const KIND_LABELS: Record<string, string> = {
  LIKE: "Reaction",
  COMMENT: "Comment",
  CAP_CALLED: "Cap called",
  CAP_REVOKED: "Cap revoked",
  CAP_RESTORED: "Restored",
  MEDAL_AWARDED: "Medal",
  MEMBER_JOINED: "New member",
  GROUP_INVITE: "Invite",
  DAILY_RESET_REMINDER: "Reminder",
  FIRST_RECEIPT: "First receipt",
};
const CAP_KINDS = new Set(["CAP_CALLED", "CAP_REVOKED"]);

interface RawNotif {
  _id: Id<"notifications">;
  kind: string;
  title: string;
  body: string;
  deepLinkPath: string;
  createdAt: number;
  readAt?: number | null;
  groupId?: Id<"groups"> | null;
  completionId?: Id<"completions"> | null;
}

export default function InboxScreen() {
  const c = useThemeColors();
  const s = styles(c);
  const router = useRouter();

  const data = useQuery(api.notifications.recent, {});
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastValue>(null);

  const items = (data?.items ?? []) as RawNotif[];
  const unread = data?.unreadCount ?? 0;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/dashboard");
  };

  const handleTap = async (n: RawNotif) => {
    try {
      await markRead({ notificationId: n._id });
    } catch {}
    const route = notifRoute({
      deepLinkPath: n.deepLinkPath,
      groupId: n.groupId,
      completionId: n.completionId,
    });
    router.navigate(route as never);
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead({});
      setToast({ message: "All caught up", tone: "success" });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 700); }} tintColor={c.muted} />
        }
      >
        <AnimatedPressable
          scaleDown={0.92}
          onPress={goBack}
          style={[s.backBtn, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Icon name="chevL" size={22} color={c.ink} />
        </AnimatedPressable>

        <View style={s.topRow}>
          <Text style={[s.eyebrow, { color: c.muted }]}>Recent</Text>
          {unread > 0 && <PillBtn onPress={handleMarkAll}>Mark all read</PillBtn>}
        </View>

        {!data ? null : items.length === 0 ? (
          <View style={{ paddingTop: 40 }}>
            <EmptyState head="Empty inbox" body="Reactions, comments, and caps will land here." />
          </View>
        ) : (
          <View style={[s.list, { borderColor: c.line }]}>
            {items.map((n, i) => {
              const isUnread = !n.readAt;
              const isCap = CAP_KINDS.has(n.kind);
              return (
                <AnimatedPressable
                  key={n._id}
                  scaleDown={0.99}
                  dimOnPress={false}
                  onPress={() => handleTap(n)}
                  style={[
                    s.row,
                    { borderBottomColor: c.line, borderBottomWidth: i < items.length - 1 ? 1 : 0, opacity: isUnread ? 1 : 0.55 },
                  ]}
                >
                  <View
                    style={[
                      s.dot,
                      isUnread
                        ? { backgroundColor: c.accent }
                        : { backgroundColor: "transparent", borderWidth: 1, borderColor: c.lineStrong },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.kind, { color: isCap ? c.cap : c.muted }]}>
                      {KIND_LABELS[n.kind] ?? n.kind}
                    </Text>
                    <Text style={[s.title, { color: c.inkStrong }]} numberOfLines={2}>
                      {n.title}
                    </Text>
                    {n.body ? (
                      <Text style={[s.body, { color: c.muted }]} numberOfLines={2}>
                        {n.body}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[s.time, { color: c.mutedDim }]}>{timeAgo(n.createdAt)}</Text>
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

const styles = (c: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.paper },
    scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 60 },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 22,
    },
    eyebrow: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    list: { borderWidth: 1, borderRadius: radii.card, overflow: "hidden" },
    row: { flexDirection: "row", gap: 14, paddingVertical: 22, paddingHorizontal: 20, alignItems: "flex-start" },
    dot: { width: 9, height: 9, borderRadius: 5, marginTop: 7 },
    kind: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
    title: { fontFamily: fonts.sansSemiBold, fontSize: 18, marginTop: 7, marginBottom: 2 },
    body: { fontFamily: fonts.sans, fontSize: 15 },
    time: { fontFamily: fonts.mono, fontSize: 11 },
  });
