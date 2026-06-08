import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Icon } from "@/components/ui/Icon";
import { Pts } from "@/components/ui/primitives";
import { ProofCarousel } from "@/components/home/ProofCarousel";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import type { Id } from "@/convex/_generated/dataModel";
import type { GroupTask, ProofActions } from "@/components/home/types";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — TaskCard: one task as a "post". Carousel of member proofs, then
// a 70/30 "Add Your Receipt" + Cap split. Port of home-feed.jsx TaskCard.
// ════════════════════════════════════════════════════════════════════════

interface Props {
  task: GroupTask;
  actions: ProofActions;
  onAddReceipt: (task: GroupTask) => void;
  /** Pulse the card (notification deep-link landed here). */
  highlight?: boolean;
  /** Scroll the carousel to this specific receipt. */
  highlightCompletionId?: Id<"completions"> | null;
}

export function TaskCard({ task, actions, onAddReceipt, highlight, highlightCompletionId }: Props) {
  const c = useThemeColors();
  const s = styles(c);
  const [cur, setCur] = useState(0);

  const subs = task.submissions;
  const hasSubs = subs.length > 0;
  const current = subs[cur] ?? subs[0];

  // Index of the highlighted receipt within this task's carousel.
  const targetIndex = highlightCompletionId
    ? Math.max(0, subs.findIndex((sub) => sub.completionId === highlightCompletionId))
    : 0;

  // Pulse glow when this card is the notification target.
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!highlight) return;
    glow.value = 0;
    glow.value = withSequence(
      withTiming(1, { duration: 320 }),
      withTiming(1, { duration: 760 }),
      withTiming(0, { duration: 640 }),
    );
  }, [highlight, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View style={s.card}>
      <Animated.View
        pointerEvents="none"
        style={[s.glow, { borderColor: c.accent, backgroundColor: c.accentBg }, glowStyle]}
      />
      <View style={s.head}>
        <Text style={s.name} numberOfLines={1}>
          {task.name}
        </Text>
        <View style={{ flexShrink: 0, marginLeft: 12 }}>
          <Pts value={task.points} />
        </View>
      </View>

      {hasSubs ? (
        <>
          <ProofCarousel
            submissions={subs}
            actions={actions}
            onIndexChange={setCur}
            initialIndex={targetIndex}
          />
          {subs.length > 1 && (
            <View style={s.dots}>
              {subs.map((_, i) => (
                <View
                  key={i}
                  style={[
                    s.dot,
                    {
                      width: i === cur ? 18 : 6,
                      backgroundColor: i === cur ? c.accent : c.surface3,
                    },
                  ]}
                />
              ))}
            </View>
          )}
          {/* 70 / 30 actions */}
          <View style={s.actions}>
            {task.youDone ? (
              <View style={[s.youIn, { backgroundColor: c.accentBg, borderColor: c.accent }]}>
                <Icon name="check" size={18} color={c.accent} strokeWidth={2.2} />
                <Text style={[s.youInText, { color: c.accent }]}>You're in</Text>
              </View>
            ) : (
              <AnimatedPressable
                scaleDown={0.98}
                onPress={() => onAddReceipt(task)}
                style={[s.addBtn, { backgroundColor: c.accent }]}
              >
                <Icon name="camera" size={18} color={c.onAccent} />
                <Text style={[s.addText, { color: c.onAccent }]}>Add Your Receipt</Text>
              </AnimatedPressable>
            )}
            {current && (
              <AnimatedPressable
                scaleDown={0.96}
                haptic="medium"
                onPress={() => actions.onCap(current)}
                style={[
                  s.capBtn,
                  current.challengedByYou
                    ? { backgroundColor: c.cap, borderColor: c.cap }
                    : { backgroundColor: c.capBg, borderColor: c.cap },
                ]}
              >
                <Icon
                  name="flag"
                  size={18}
                  color={current.challengedByYou ? c.onAccent : c.cap}
                  fill={current.challengedByYou ? c.onAccent : undefined}
                />
                <Text
                  style={[
                    s.capText,
                    { color: current.challengedByYou ? c.onAccent : c.cap },
                  ]}
                >
                  {current.challengeCount}
                </Text>
              </AnimatedPressable>
            )}
          </View>
        </>
      ) : (
        <AnimatedPressable
          scaleDown={0.98}
          dimOnPress
          onPress={() => onAddReceipt(task)}
          style={[s.empty, { borderColor: c.lineStrong }]}
        >
          <View style={[s.emptyIcon, { backgroundColor: c.surface2 }]}>
            <Icon name="camera" size={22} color={c.muted} />
          </View>
          <Text style={[s.emptyText, { color: c.muted }]}>No receipts yet · be first</Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    card: {
      paddingVertical: 24,
      borderBottomWidth: 1,
      borderBottomColor: c.line,
    },
    glow: {
      position: "absolute",
      top: 8,
      bottom: 8,
      left: -12,
      right: -12,
      borderRadius: 18,
      borderWidth: 2,
    },
    head: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    name: {
      fontFamily: fonts.serif,
      fontSize: 26,
      color: c.inkStrong,
      flex: 1,
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
      marginTop: 12,
    },
    dot: { height: 6, borderRadius: 999 },
    actions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    addBtn: {
      flex: 7,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      height: 50,
      borderRadius: 999,
    },
    addText: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
    youIn: {
      flex: 7,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      height: 50,
      borderRadius: 999,
      borderWidth: 1,
    },
    youInText: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
    capBtn: {
      flex: 3,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 50,
      borderRadius: 999,
      borderWidth: 1,
    },
    capText: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 0.4 },
    empty: {
      width: "100%",
      borderWidth: 1,
      borderStyle: "dashed",
      borderRadius: 16,
      paddingVertical: 40,
      paddingHorizontal: 20,
      alignItems: "center",
      gap: 12,
    },
    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: {
      fontFamily: fonts.mono,
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
  });
