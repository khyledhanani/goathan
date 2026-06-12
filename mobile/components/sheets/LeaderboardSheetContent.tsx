import { View, Text, StyleSheet } from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Icon } from "@/components/ui/Icon";
import { TitleDot, Avatar } from "@/components/ui/primitives";
import { useThemeColors } from "@/lib/useThemeColors";
import { competitionRanks } from "@/lib/ranking";
import { fonts } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import type { StandingMember } from "@/components/home/types";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — Leaderboard sheet INNER content (port of flows.jsx
// LeaderboardSheet). Grabber + BottomSheet wrapper provided by the parent.
// gold / silver / bronze podium + the rest. Presentational only.
// ════════════════════════════════════════════════════════════════════════

// Solid medal colors (fg = dark ink that reads on the medal).
const MEDALS: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#D9A93B", fg: "#3a2c08" }, // gold
  2: { bg: "#AEB2BC", fg: "#2a2c30" }, // silver
  3: { bg: "#B06E3C", fg: "#3a2410" }, // bronze
};

interface Props {
  members: StandingMember[];
  onClose: () => void;
}

export function LeaderboardSheetContent({ members, onClose }: Props) {
  const c = useThemeColors();
  const s = styles(c);

  const board = [...members].sort((a, b) => b.weekPoints - a.weekPoints);
  const ranks = competitionRanks(board, (m) => m.weekPoints);

  return (
    <View>
      {/* Header: serif title(.) + round close button */}
      <View style={s.header}>
        <TitleDot text="Leaderboard" size={30} style={{ marginTop: 0 }} />
        <AnimatedPressable scaleDown={0.92} style={s.closeBtn} onPress={onClose}>
          <Icon name="x" size={18} color={c.muted} />
        </AnimatedPressable>
      </View>

      {/* Rows */}
      <View style={s.list}>
        {board.map((m, i) => {
          const rank = ranks[i];
          const me = m.isYou;
          const medal = MEDALS[rank];
          return (
            <View
              key={String(m.userId)}
              style={[
                s.row,
                me && { backgroundColor: c.accentBg, borderColor: c.accent },
              ]}
            >
              {/* Rank badge */}
              {medal ? (
                <View style={[s.medal, { backgroundColor: medal.bg }]}>
                  <Text style={[s.medalText, { color: medal.fg }]}>{rank}</Text>
                </View>
              ) : (
                <Text style={s.plainRank}>{rank}</Text>
              )}

              {/* Avatar */}
              <Avatar initial={m.displayName} uri={m.avatarUrl} size={40} accent={me} />

              {/* Name + sub */}
              <View style={s.mid}>
                <Text style={s.name} numberOfLines={1} ellipsizeMode="tail">
                  {m.displayName}
                  {me && <Text style={s.youTag}>{"  YOU"}</Text>}
                </Text>
                {m.lastWeekPoints != null && (
                  <Text style={s.sub}>last week {m.lastWeekPoints} pts</Text>
                )}
              </View>

              {/* Week points */}
              <Text
                style={[
                  s.points,
                  { color: rank <= 3 ? c.inkStrong : c.muted },
                ]}
              >
                {m.weekPoints}
                <Text style={s.pointsUnit}> pts</Text>
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 24,
      paddingTop: 18,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    closeBtn: {
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 20,
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    list: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 14,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: "transparent",
      backgroundColor: "transparent",
    },
    medal: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    medalText: {
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 18,
    },
    plainRank: {
      width: 28,
      textAlign: "center",
      fontFamily: fonts.mono,
      fontSize: 14,
      color: c.mutedDim,
    },
    mid: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 16,
      color: c.inkStrong,
    },
    youTag: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1,
      color: c.accent,
    },
    sub: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: c.mutedDim,
      marginTop: 2,
    },
    points: {
      fontFamily: fonts.mono,
      fontSize: 17,
    },
    pointsUnit: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: c.mutedDim,
    },
  });
