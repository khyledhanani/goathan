import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Modal,
} from "react-native";
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
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Icon } from "@/components/ui/Icon";
import {
  ScreenHeader,
  SectionHeader,
  EmptyState,
  Avatar,
  Pts,
  LinkBtn,
  ProofImage,
} from "@/components/ui/primitives";
import { TabBar } from "@/components/ui/TabBar";
import { AddReceiptSheet } from "@/components/sheets/AddReceiptSheet";

const MEDAL_COLORS = { GOLD: "#D9A93B", SILVER: "#AEB2BC", BRONZE: "#B06E3C" } as const;
type Medal = "GOLD" | "SILVER" | "BRONZE";

const SCREEN_WIDTH = Dimensions.get("window").width;
const TILE_W = (SCREEN_WIDTH - 48 - 12) / 2;

interface RawTrophy {
  _id: string;
  groupId: Id<"groups">;
  groupName: string;
  weekEndMs: number;
  weekPoints: number;
  medal: Medal;
}
interface RawReceipt {
  completionId: Id<"completions">;
  taskName: string;
  taskCategory: string;
  points: number;
  proofUrl?: string | null;
  hasR2Proof: boolean;
}
interface RawGroup {
  _id: Id<"groups">;
  name: string;
  isAdmin: boolean;
}

export default function ProfileScreen() {
  const c = useThemeColors();
  const s = styles(c);
  const router = useRouter();

  const profile = useQuery(api.profiles.getCurrentProfile);
  const groups = useQuery(api.groups.getMyGroups, {}) as RawGroup[] | undefined;
  const myStreak = useQuery(api.streaks.forUser, profile ? { userId: profile.userId } : "skip");
  const myTrophies = useQuery(api.weekResults.trophiesForUser, profile ? { userId: profile.userId } : "skip");
  const myReceipts = useQuery(api.proofs.gridForUser, profile ? { userId: profile.userId } : "skip");

  const receiptItems = (myReceipts?.items ?? []) as RawReceipt[];
  const r2Ids = useMemo(
    () => receiptItems.filter((i) => i.hasR2Proof).map((i) => i.completionId),
    [receiptItems],
  );
  const signedUrls = useSignedProofUrls(r2Ids);

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  if (!profile) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.loading}>
          <Text style={s.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalMedals =
    (myTrophies?.counts.gold ?? 0) +
    (myTrophies?.counts.silver ?? 0) +
    (myTrophies?.counts.bronze ?? 0);
  const trophies = (myTrophies?.items ?? []) as RawTrophy[];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow="Account"
          title="Profile"
          trailing={
            <AnimatedPressable scaleDown={0.94} onPress={() => router.push("/settings")} hitSlop={8} style={{ paddingTop: 6 }}>
              <Text style={s.settingsLink}>Settings</Text>
            </AnimatedPressable>
          }
        />

        {/* Identity */}
        <View style={s.identity}>
          <Avatar initial={profile.displayName} uri={profile.avatarUrl} size={96} fontSize={34} />
          <View style={{ gap: 4 }}>
            <Text style={s.name}>{profile.displayName}</Text>
            {profile.username && <Text style={s.handle}>@{profile.username}</Text>}
            {myStreak && myStreak.current > 0 && (
              <View style={[s.streakChip, { backgroundColor: c.surface2 }]}>
                <Icon name="flame" size={13} color={c.accent} fill={c.accent} />
                <Text style={[s.streakNum, { color: c.inkStrong }]}>{myStreak.current}</Text>
                <Text style={[s.streakLabel, { color: c.muted }]}>day streak</Text>
              </View>
            )}
          </View>
        </View>

        {/* Trophy cabinet */}
        <SectionHeader title="Trophy cabinet" count={`${totalMedals} Medals`} style={{ marginBottom: 22 }} />
        {trophies.length === 0 ? (
          <EmptyState
            head="No medals yet"
            body="Finish a week in the top 3 of any group and your trophy lands here."
          />
        ) : (
          <View>
            <View style={s.medalCounts}>
              {(["GOLD", "SILVER", "BRONZE"] as Medal[]).map((m) => (
                <View key={m} style={s.medalCount}>
                  <View style={[s.medalDot, { backgroundColor: MEDAL_COLORS[m] }]}>
                    <Text style={s.medalRank}>{m === "GOLD" ? "1" : m === "SILVER" ? "2" : "3"}</Text>
                  </View>
                  <Text style={[s.medalNum, { color: c.ink }]}>
                    {m === "GOLD"
                      ? myTrophies?.counts.gold
                      : m === "SILVER"
                        ? myTrophies?.counts.silver
                        : myTrophies?.counts.bronze}
                  </Text>
                </View>
              ))}
            </View>
            <View style={[s.list, { borderColor: c.line }]}>
              {trophies.map((t, i) => (
                <AnimatedPressable
                  key={t._id}
                  scaleDown={0.98}
                  onPress={() => router.navigate(`/dashboard?group=${t.groupId}`)}
                  style={[s.trophyRow, { borderBottomColor: c.line, borderBottomWidth: i < trophies.length - 1 ? 1 : 0 }]}
                >
                  <View style={[s.medalDot, { backgroundColor: MEDAL_COLORS[t.medal] }]}>
                    <Text style={s.medalRank}>{t.medal === "GOLD" ? "1" : t.medal === "SILVER" ? "2" : "3"}</Text>
                  </View>
                  <Text style={[s.trophyGroup, { color: c.ink }]} numberOfLines={1}>
                    {t.groupName}
                  </Text>
                  <Pts value={t.weekPoints} size={12} />
                </AnimatedPressable>
              ))}
            </View>
          </View>
        )}

        {/* Receipts */}
        <SectionHeader
          title="Your receipts"
          count={`${receiptItems.length}${receiptItems.length >= 60 ? "+" : ""} Verified`}
          style={{ marginTop: 52, marginBottom: 22 }}
        />
        {receiptItems.length === 0 ? (
          <EmptyState head="Nothing yet" body="Verify a task and your receipt lands here." />
        ) : (
          <View style={s.grid}>
            {receiptItems.map((item) => {
              const url = signedUrls[item.completionId] ?? item.proofUrl ?? null;
              return (
                <AnimatedPressable
                  key={item.completionId}
                  scaleDown={0.96}
                  onPress={() => (url ? setLightboxUrl(url) : router.push(`/r/${item.completionId}`))}
                  style={[s.tile, { borderColor: c.line }]}
                >
                  <ProofImage uri={url} label={item.taskCategory} height={120} radius={0} />
                  <View style={s.tileMeta}>
                    <Text style={[s.tileName, { color: c.ink }]} numberOfLines={1}>
                      {item.taskName}
                    </Text>
                    <Pts value={item.points} size={13} />
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>
        )}

        {/* Groups */}
        <SectionHeader
          title="Your groups"
          count={`${groups?.length ?? 0} Active`}
          style={{ marginTop: 52, marginBottom: 18 }}
        />
        {(groups ?? []).map((g) => (
          <AnimatedPressable
            key={g._id}
            scaleDown={0.98}
            onPress={() => router.navigate(`/dashboard?group=${g._id}`)}
            style={[s.groupRow, { borderColor: c.line }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Text style={s.groupName} numberOfLines={1}>{g.name}</Text>
              <Text style={[s.groupRole, { color: c.mutedDim }]}>{g.isAdmin ? "Admin" : "Member"}</Text>
            </View>
            <LinkBtn onPress={() => router.navigate(`/dashboard?group=${g._id}`)}>Open</LinkBtn>
          </AnimatedPressable>
        ))}
        <Text style={[s.footer, { color: c.muted }]}>
          Start a{" "}
          <Text style={{ color: c.accent, fontFamily: fonts.sansSemiBold }} onPress={() => router.push("/groups/create")}>
            new group
          </Text>
          {" "}or join one from an invite.
        </Text>
      </ScrollView>

      {/* Lightbox */}
      <Modal visible={lightboxUrl !== null} transparent animationType="fade" onRequestClose={() => setLightboxUrl(null)}>
        <AnimatedPressable scaleDown={1} dimOnPress={false} style={s.lightbox} onPress={() => setLightboxUrl(null)}>
          {lightboxUrl && <Image source={{ uri: lightboxUrl }} style={s.lightboxImg} contentFit="contain" />}
        </AnimatedPressable>
      </Modal>

      <TabBar onAdd={() => setAddOpen(true)} />

      <AddReceiptSheet
        visible={addOpen}
        groups={groups ?? []}
        onClose={() => setAddOpen(false)}
        onDone={() => setAddOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.paper },
    loading: { flex: 1, justifyContent: "center", alignItems: "center" },
    loadingText: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: c.muted,
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 130 },
    settingsLink: {
      fontFamily: fonts.mono,
      fontSize: 12,
      color: c.muted,
      letterSpacing: 1.6,
      textTransform: "uppercase",
    },
    identity: { flexDirection: "row", alignItems: "center", gap: 22, marginBottom: 40 },
    name: { fontFamily: fonts.sansSemiBold, fontSize: 26, color: c.inkStrong },
    handle: { fontFamily: fonts.mono, fontSize: 15, color: c.muted },
    streakChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radii.pill,
      alignSelf: "flex-start",
      marginTop: 6,
    },
    streakNum: { fontFamily: fonts.sansBold, fontSize: 14 },
    streakLabel: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.4 },

    medalCounts: { flexDirection: "row", gap: 22, marginBottom: 16 },
    medalCount: { flexDirection: "row", alignItems: "center", gap: 6 },
    medalDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    medalRank: { fontFamily: fonts.serif, fontSize: 13, color: "#241c08" },
    medalNum: { fontFamily: fonts.monoMedium, fontSize: 15 },

    list: { borderWidth: 1, borderRadius: radii.card, overflow: "hidden" },
    trophyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
    trophyGroup: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15 },

    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    tile: { width: TILE_W, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
    tileMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
    tileName: { fontFamily: fonts.serif, fontSize: 16, flex: 1, marginRight: 8 },

    groupRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderRadius: radii.input,
      paddingVertical: 20,
      paddingHorizontal: 20,
      marginBottom: 14,
    },
    groupName: { fontFamily: fonts.serif, fontSize: 24, color: c.inkStrong },
    groupRole: {
      fontFamily: fonts.mono,
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginLeft: 12,
    },
    footer: { fontFamily: fonts.sans, fontSize: 16, marginTop: 4 },

    lightbox: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" },
    lightboxImg: { width: SCREEN_WIDTH - 32, height: SCREEN_WIDTH - 32, borderRadius: radii.md },
  });
