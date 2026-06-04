import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import type { Id } from "../convex/_generated/dataModel";

export interface StandingsMember {
  userId: Id<"users">;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  isAdmin: boolean;
  isYou: boolean;
  weekPoints: number;
  perfectDays?: number;
}

interface Props {
  standings: StandingsMember[];
}

export function StandingsTable({ standings }: Props) {
  const colors = useThemeColors();
  const s = styles(colors);

  if (standings.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>No one on the board yet.</Text>
      </View>
    );
  }

  return (
    <View style={s.table}>
      {standings.map((m, i) => (
        <View
          key={m.userId}
          style={[
            s.row,
            i < standings.length - 1 && s.rowBorder,
            m.isYou && s.rowYou,
          ]}
        >
          {/* Rank */}
          <Text style={[s.rank, m.isYou && { color: colors.accent }]}>
            {String(i + 1).padStart(2, "0")}
          </Text>

          {/* Avatar */}
          {m.avatarUrl ? (
            <Image source={{ uri: m.avatarUrl }} style={s.avatar} transition={150} />
          ) : (
            <View style={s.avatarFallback}>
              <Text style={s.avatarLetter}>
                {m.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Name + badges */}
          <View style={s.info}>
            <View style={s.nameLine}>
              <Text style={s.name} numberOfLines={1}>
                {m.displayName}
              </Text>
              {m.isYou && <Text style={s.youBadge}>you</Text>}
              {m.isAdmin && <Text style={s.adminBadge}>admin</Text>}
            </View>
            <View style={s.metaLine}>
              <Text style={s.username}>
                {m.username ? `@${m.username}` : "—"}
              </Text>
              {(m.perfectDays ?? 0) > 0 && (
                <Text style={s.perfect}>
                  {m.perfectDays} perfect {m.perfectDays === 1 ? "day" : "days"}
                </Text>
              )}
            </View>
          </View>

          {/* Points */}
          <View style={s.pointsCol}>
            <Text style={[s.points, m.isYou && { color: colors.accent }]}>
              {m.weekPoints}
            </Text>
            <Text style={s.ptsLabel}>pts</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = (colors: Colors) =>
  StyleSheet.create({
    table: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radii.md,
      overflow: "hidden",
    },
    empty: {
      paddingVertical: 32,
      alignItems: "center",
    },
    emptyText: {
      fontFamily: fonts.sans,
      fontSize: 13,
      color: colors.fog,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 10,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    rowYou: {
      backgroundColor: colors.accentSoft + "44",
    },
    rank: {
      fontFamily: fonts.monoMedium,
      fontSize: 14,
      color: colors.fog,
      width: 24,
      textAlign: "center",
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    avatarFallback: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.paper3,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarLetter: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
      color: colors.smoke,
    },
    info: {
      flex: 1,
      gap: 1,
    },
    nameLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    name: {
      fontFamily: fonts.sansMedium,
      fontSize: 13,
      color: colors.ink,
      flexShrink: 1,
    },
    youBadge: {
      fontFamily: fonts.monoMedium,
      fontSize: 9,
      color: colors.accent,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: radii.pill,
      overflow: "hidden",
      letterSpacing: 0.5,
    },
    adminBadge: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.fog,
      letterSpacing: 0.5,
    },
    metaLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    username: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.mist,
    },
    perfect: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.accent,
      letterSpacing: 0.3,
    },
    pointsCol: {
      alignItems: "flex-end",
    },
    points: {
      fontFamily: fonts.monoMedium,
      fontSize: 16,
      color: colors.ink,
    },
    ptsLabel: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.mist,
      letterSpacing: 0.5,
    },
  });
