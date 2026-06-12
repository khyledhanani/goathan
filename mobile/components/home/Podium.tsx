import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Avatar } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { useThemeColors } from "@/lib/useThemeColors";
import { competitionRanks } from "@/lib/ranking";
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
  /** Standings period end (ms). From groups.todayView → groupPeriodBounds, so
   *  it already honors each group's settings (weekly/daily/monthly/custom). */
  periodEndMs?: number | null;
  /** Group stake from groups.todayView → group.stakeKind / group.stakeText. */
  stakeKind?: "REWARD" | "PENALTY" | null;
  stakeText?: string | null;
}

// "Current round ends in 3d 20h" — coarse day/hour (then h/m, then m) display.
function formatRound(ms: number): string {
  if (ms <= 0) return "Current round ended";
  const totalMin = Math.floor(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const dur = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return `Current round ends in ${dur}`;
}

interface Col {
  m: StandingMember;
  /** Positional column: 1 = center, 2 = left, 3 = right. Layout order only. */
  slot: 1 | 2 | 3;
  /** Number shown on the step — competition rank (ties share a rank). Also
   *  drives height/styling so tied players render at equal visual priority. */
  displayRank: number;
  h: number;
  bg: string;
  num: string;
  av: number;
}

export function Podium({ members, onFullBoard, periodEndMs, stakeKind, stakeText }: Props) {
  const c = useThemeColors();
  const s = styles(c);

  // Live "current round ends in …" — re-renders each minute (day/hour scale).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (periodEndMs == null) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [periodEndMs]);
  const roundLabel = periodEndMs == null ? null : formatRound(periodEndMs - now);

  const board = [...members].sort((a, b) => b.weekPoints - a.weekPoints);
  const ranks = competitionRanks(board, (m) => m.weekPoints);
  const top = board.slice(0, 3);
  if (top.length < 1) return null;

  // Step height + styling are keyed by displayRank (NOT position), so tied
  // players get equal height and equal first-place styling. Rank is always
  // 1, 2, or 3 here (only the top 3 rows are shown).
  const STEP: Record<number, { h: number; bg: string; num: string; av: number }> = {
    1: { h: 86, bg: c.accent, num: c.onAccent, av: 54 },
    2: { h: 58, bg: c.surface3, num: c.ink, av: 42 },
    3: { h: 42, bg: c.surface2, num: c.muted, av: 42 },
  };

  // Positional order: #2 left, #1 center, #3 right (classic podium layout).
  const cols: Col[] = [
    top[1] && { m: top[1], slot: 2 as const, displayRank: ranks[1], ...STEP[ranks[1]] },
    top[0] && { m: top[0], slot: 1 as const, displayRank: ranks[0], ...STEP[ranks[0]] },
    top[2] && { m: top[2], slot: 3 as const, displayRank: ranks[2], ...STEP[ranks[2]] },
  ].filter(Boolean) as Col[];

  return (
    <View style={s.panel}>
      {/* faux inset-top highlight line */}
      <View style={s.topHighlight} pointerEvents="none" />

      {/* Section label (top-left) · Full board link (top-right) */}
      <View style={s.linkRow}>
        <View>
          <Text style={s.kicker}>Standings</Text>
          {roundLabel && <Text style={s.subtitle}>{roundLabel}</Text>}
        </View>
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

      {/* Group stake (reward = green, penalty = red); hidden if unconfigured */}
      {stakeKind && stakeText?.trim() ? (
        <View
          style={[
            s.stake,
            stakeKind === "REWARD"
              ? { backgroundColor: c.accentBg, borderColor: c.accent }
              : { backgroundColor: c.capBg, borderColor: c.cap },
          ]}
        >
          <Text style={s.stakeText} numberOfLines={2}>
            <Text style={[s.stakeKind, { color: stakeKind === "REWARD" ? c.accent : c.cap }]}>
              {stakeKind === "REWARD" ? "🏆 Reward" : "⚡ Penalty"}
            </Text>
            {`  ·  ${stakeText.trim()}`}
          </Text>
        </View>
      ) : null}

      {/* Step columns */}
      <View style={s.cols}>
        {cols.map((col) => {
          const isFirst = col.displayRank === 1;
          return (
            <View key={col.slot} style={s.col}>
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
                  {col.displayRank}
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
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    kicker: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 0.9,
      textTransform: "uppercase",
      color: c.muted,
    },
    subtitle: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 0.3,
      color: c.mutedDim,
      marginTop: 3,
    },
    stake: {
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      borderWidth: 1,
    },
    stakeText: {
      fontFamily: fonts.sans,
      fontSize: 12.5,
      lineHeight: 17,
      color: c.smoke,
    },
    stakeKind: {
      fontFamily: fonts.sansSemiBold,
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
