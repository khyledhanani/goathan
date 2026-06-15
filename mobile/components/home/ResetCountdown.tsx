import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts } from "@/lib/theme";
import type { Colors } from "@/lib/theme";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — ResetCountdown (live "Resets in HH:MM:SS" pill above standings)
// The daily reset boundary is computed by the backend in the group's timezone
// (web/convex/lib/period.ts) and delivered as an absolute timestamp via
// groups.todayView → stats.dailyResetMs. This component just counts down to
// that instant — no reset rule lives on the client. Presentational + a 1s tick.
// ════════════════════════════════════════════════════════════════════════

interface Props {
  /** Absolute ms of the next daily reset, in the group timezone. */
  nextResetMs?: number | null;
}

function format(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function ResetCountdown({ nextResetMs }: Props) {
  const c = useThemeColors();
  const s = styles(c);
  const [left, setLeft] = useState(() =>
    nextResetMs == null ? 0 : Math.max(0, nextResetMs - Date.now()),
  );

  useEffect(() => {
    if (nextResetMs == null) return;
    const tick = () => setLeft(Math.max(0, nextResetMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextResetMs]);

  if (nextResetMs == null) return null;

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
