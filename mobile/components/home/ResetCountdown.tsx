import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts } from "@/lib/theme";
import type { Colors } from "@/lib/theme";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — ResetCountdown (live "Resets in HH:MM:SS" pill above standings)
// The backend defines the task day in UTC: web/convex/lib/period.ts dayKey()
// uses getUTC*, and completions.ts derives startOfDay from "T00:00:00Z". So
// the daily period boundary is the next UTC midnight — mirrored here, no new
// reset rule invented. Presentational + a 1s tick; nothing is persisted.
// ════════════════════════════════════════════════════════════════════════

function msUntilUtcMidnight(now: number): number {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
  return Math.max(0, next - now);
}

function format(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function ResetCountdown() {
  const c = useThemeColors();
  const s = styles(c);
  const [left, setLeft] = useState(() => msUntilUtcMidnight(Date.now()));

  useEffect(() => {
    const id = setInterval(() => setLeft(msUntilUtcMidnight(Date.now())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={s.wrap}>
      <View style={s.pill}>
        <Icon name="clock" size={13} color={c.muted} />
        <Text style={s.label}>
          Daily Tasks Reset in <Text style={s.time}>{format(left)}</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      justifyContent: "center",
      marginBottom: 14,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.surface,
    },
    label: {
      fontFamily: fonts.mono,
      fontSize: 12,
      letterSpacing: 0.4,
      color: c.muted,
    },
    time: {
      color: c.accent,
    },
  });
