import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";

interface Props {
  todayDone: number;
  totalDailyTasks: number;
  todayPoints: number;
  groupCount: number;
  earliestPeriodEndMs?: number;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0h";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function FeedStatsBar({
  todayDone,
  totalDailyTasks,
  todayPoints,
  groupCount,
  earliestPeriodEndMs,
}: Props) {
  const colors = useThemeColors();
  const s = styles(colors);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const remaining = earliestPeriodEndMs ? earliestPeriodEndMs - now : null;

  return (
    <View style={s.bar}>
      <Stat label="done" value={`${todayDone}/${totalDailyTasks}`} s={s} />
      <View style={s.dot} />
      <Stat label="pts" value={String(todayPoints)} s={s} />
      <View style={s.dot} />
      <Stat label={groupCount === 1 ? "group" : "groups"} value={String(groupCount)} s={s} />
      {remaining != null && remaining > 0 && (
        <>
          <View style={s.dot} />
          <Stat label="left" value={formatCountdown(remaining)} s={s} />
        </>
      )}
    </View>
  );
}

function Stat({ label, value, s }: { label: string; value: string; s: ReturnType<typeof styles> }) {
  const colors = useThemeColors();
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, { color: colors.ink }]}>{value}</Text>
      <Text style={[s.statLabel, { color: colors.fog }]}>{label}</Text>
    </View>
  );
}

const styles = (colors: Colors) =>
  StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.paper2,
      borderRadius: radii.md,
      gap: 12,
    },
    stat: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
    },
    statValue: {
      fontFamily: fonts.monoMedium,
      fontSize: 13,
      letterSpacing: 0.5,
    },
    statLabel: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.mist,
    },
  });
