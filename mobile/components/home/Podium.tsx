import { View, Text, StyleSheet } from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Avatar } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import type { StandingMember } from "@/components/home/types";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — Podium (top 3 of a group's weekly board).
// Port of the prototype's Podium (home-feed.jsx). Elevated panel with an
// accent glow, a "Full board" link, and the classic #2/#1/#3 step layout.
// Presentational only.
// ════════════════════════════════════════════════════════════════════════

interface Props {
  members: StandingMember[];
  onFullBoard: () => void;
}

interface Col {
  m: StandingMember;
  rank: 1 | 2 | 3;
  h: number;
  bg: string;
  num: string;
  av: number;
}

export function Podium({ members, onFullBoard }: Props) {
  const c = useThemeColors();
  const s = styles(c);

  const board = [...members].sort((a, b) => b.weekPoints - a.weekPoints);
  const top = board.slice(0, 3);
  if (top.length < 1) return null;

  // Order: #2 left, #1 center, #3 right.
  const cols: Col[] = [
    top[1] && { m: top[1], rank: 2, h: 58, bg: c.surface3, num: c.ink, av: 42 },
    top[0] && { m: top[0], rank: 1, h: 86, bg: c.accent, num: c.onAccent, av: 54 },
    top[2] && { m: top[2], rank: 3, h: 42, bg: c.surface2, num: c.muted, av: 42 },
  ].filter(Boolean) as Col[];

  return (
    <View style={s.panel}>
      {/* faux inset-top highlight line */}
      <View style={s.topHighlight} pointerEvents="none" />

      {/* Full board link (top-right) */}
      <View style={s.linkRow}>
        <AnimatedPressable
          scaleDown={0.96}
          dimOnPress
          onPress={onFullBoard}
          style={s.link}
        >
          <Text style={s.linkText}>Full board</Text>
          <Icon name="arrowR" size={13} color={c.accent} />
        </AnimatedPressable>
      </View>

      {/* Step columns */}
      <View style={s.cols}>
        {cols.map((col) => {
          const isFirst = col.rank === 1;
          return (
            <View key={col.rank} style={s.col}>
              {isFirst && (
                <Icon name="medal" size={22} color={c.accent} />
              )}
              <View
                style={[
                  s.avatarWrap,
                  isFirst && { borderWidth: 2, borderColor: c.accent },
                ]}
              >
                <Avatar
                  initial={col.m.displayName.charAt(0)}
                  uri={col.m.avatarUrl}
                  size={col.av}
                  accent={isFirst}
                />
              </View>
              <Text style={s.handle} numberOfLines={1}>
                {col.m.displayName}
              </Text>
              <Text
                style={[
                  s.pts,
                  { color: isFirst ? c.accent : c.muted },
                ]}
              >
                {col.m.weekPoints} pts
              </Text>
              <View
                style={[
                  s.step,
                  { height: col.h, backgroundColor: col.bg },
                ]}
              >
                <Text
                  style={[
                    s.stepNum,
                    { fontSize: isFirst ? 30 : 24, color: col.num },
                  ]}
                >
                  {col.rank}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    panel: {
      position: "relative",
      backgroundColor: c.bgElev,
      borderWidth: 1,
      borderColor: c.lineStrong,
      borderRadius: 22,
      paddingTop: 18,
      paddingHorizontal: 16,
      paddingBottom: 0,
      marginBottom: 24,
      overflow: "hidden",
    },
    topHighlight: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: "rgba(255,255,255,0.05)",
    },
    linkRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "baseline",
    },
    link: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    linkText: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 0.9,
      textTransform: "uppercase",
      color: c.accent,
    },
    cols: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      marginTop: 18,
    },
    col: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      gap: 7,
    },
    avatarWrap: {
      borderRadius: 999,
    },
    handle: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 12,
      color: c.inkStrong,
      maxWidth: 74,
    },
    pts: {
      fontFamily: fonts.mono,
      fontSize: 11,
    },
    step: {
      width: "100%",
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    stepNum: {
      fontFamily: fonts.serif,
    },
  });
