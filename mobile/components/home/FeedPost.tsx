import { useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { Icon } from "@/components/ui/Icon";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Avatar, CatBadge, Pts, ProofImage } from "@/components/ui/primitives";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { timeAgo } from "@/lib/timeAgo";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import type { ProofItem, ProofActions } from "@/components/home/types";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — FeedPost (port of the prototype's FeedPost + ReactionBar)
// Like-only reactions. Double-tap the proof image to like with a heart burst.
// Presentational: props + callbacks only.
// ════════════════════════════════════════════════════════════════════════

// Like-red — kept as a literal (signal color, not a theme token), per spec.
const LIKE_RED = "#FF4D5E";
// Dark ink that reads on top of the cap fill (signal red) when challenged.
const CAP_ON = "#1A0F0C";

const DOUBLE_TAP_MS = 320;

interface Props {
  item: ProofItem;
  actions: ProofActions;
  flat?: boolean;
}

export function FeedPost({ item, actions, flat }: Props) {
  const c = useThemeColors();
  const s = styles(c);

  // ── Double-tap → like + heart burst ──────────────────────────────────
  const lastTap = useRef(0);
  const burstScale = useSharedValue(0.3);
  const burstOpacity = useSharedValue(0);

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [{ scale: burstScale.value }],
  }));

  const playBurst = () => {
    burstScale.value = 0.3;
    burstOpacity.value = 1;
    burstScale.value = withSequence(
      withSpring(1.4, { damping: 7, stiffness: 220, mass: 0.7 }),
      withSpring(1, { damping: 12, stiffness: 180 }),
    );
    burstOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(1, { duration: 320 }),
      withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) }),
    );
  };

  const onProofTap = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      if (!item.likedByYou) {
        hapticMedium();
        actions.onLike(item);
      }
      playBurst();
    } else {
      lastTap.current = now;
    }
  };

  // ── Header text bits ─────────────────────────────────────────────────
  const name = item.isYou ? "You" : item.displayName;

  // ── ReactionBar state ────────────────────────────────────────────────
  const liked = item.likedByYou;
  const capped = item.challengedByYou;

  return (
    <View style={[s.post, !flat && s.postBordered, item.revoked && s.revoked]}>
      {/* Header */}
      <View style={s.header}>
        <AnimatedPressable
          scaleDown={0.95}
          dimOnPress={false}
          onPress={() => actions.onUser?.(item.userId)}
        >
          <Avatar uri={item.avatarUrl} initial={item.displayName} size={48} />
        </AnimatedPressable>
        <View style={s.headerCol}>
          <Text style={s.line1} numberOfLines={1}>
            <Text
              style={s.name}
              onPress={() => actions.onUser?.(item.userId)}
              suppressHighlighting
            >
              {name}
            </Text>
            <Text style={s.inWord}> in </Text>
            <Text
              style={s.group}
              onPress={() => actions.onGroup?.(item.groupId)}
              suppressHighlighting
            >
              {item.groupName}
            </Text>
          </Text>
          <View style={s.line2}>
            <CatBadge cat={item.taskCategory} />
            <Text style={s.when}> {"·"} {timeAgo(item.whenMs)}</Text>
          </View>
        </View>
      </View>

      {/* Proof — double-tap to like */}
      <View style={s.proofWrap}>
        <Pressable onPress={onProofTap}>
          <ProofImage uri={item.imageUrl} label={item.taskCategory} height={250} />
        </Pressable>
        <View style={s.burstLayer} pointerEvents="none">
          <Animated.View style={burstStyle}>
            <Icon name="heart" size={88} color={LIKE_RED} fill={LIKE_RED} />
          </Animated.View>
        </View>
      </View>

      {/* Task name + points */}
      <View style={s.taskRow}>
        <Text style={s.task} numberOfLines={1}>
          {item.taskName}
        </Text>
        <View style={s.taskRight}>
          {item.revoked && <Text style={s.revokedTag}>REVOKED</Text>}
          <Pts value={item.points} />
        </View>
      </View>

      {/* ReactionBar */}
      <View style={s.bar}>
        <View style={s.barLeft}>
          {/* Like */}
          <AnimatedPressable
            scaleDown={0.94}
            dimOnPress={false}
            haptic={null}
            onPress={() => {
              hapticLight();
              actions.onLike(item);
            }}
            style={[
              s.pill,
              liked
                ? { backgroundColor: "rgba(255,77,94,0.14)", borderColor: LIKE_RED }
                : { backgroundColor: c.surface2, borderColor: c.line },
            ]}
          >
            <Icon name="heart" size={21} color={liked ? LIKE_RED : c.muted} fill={liked ? LIKE_RED : undefined} />
            {item.likeCount > 0 && (
              <Text style={[s.pillNum, { color: liked ? LIKE_RED : c.muted }]}>
                {item.likeCount}
              </Text>
            )}
          </AnimatedPressable>

          {/* Comment */}
          <AnimatedPressable
            scaleDown={0.94}
            dimOnPress={false}
            onPress={() => actions.onComment(item)}
            style={[s.pill, { backgroundColor: c.surface2, borderColor: c.line }]}
          >
            <Icon name="comment" size={20} color={c.muted} />
            <Text style={[s.pillNum, { color: c.muted }]}>{item.commentCount}</Text>
          </AnimatedPressable>
        </View>

        {/* Cap */}
        <AnimatedPressable
          scaleDown={0.94}
          dimOnPress={false}
          haptic="medium"
          onPress={() => actions.onCap(item)}
          style={[
            s.capPill,
            capped
              ? { backgroundColor: c.cap, borderColor: c.cap }
              : { backgroundColor: c.capBg, borderColor: c.cap },
          ]}
        >
          <Icon
            name="flag"
            size={18}
            color={capped ? CAP_ON : c.cap}
            fill={capped ? CAP_ON : undefined}
          />
          <Text style={[s.capNum, { color: capped ? CAP_ON : c.cap }]}>
            {item.challengeCount}
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    post: {
      paddingVertical: 26,
    },
    postBordered: {
      borderBottomWidth: 1,
      borderBottomColor: c.line,
    },
    revoked: {
      opacity: 0.6,
    },

    // Header
    header: {
      flexDirection: "row",
      gap: 14,
      alignItems: "center",
    },
    headerCol: {
      flex: 1,
    },
    line1: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 16,
      color: c.inkStrong,
    },
    name: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 16,
      color: c.inkStrong,
    },
    inWord: {
      fontFamily: fonts.sans,
      fontSize: 16,
      color: c.muted,
    },
    group: {
      fontFamily: fonts.sans,
      fontSize: 16,
      color: c.accent,
    },
    line2: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },
    when: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: c.mutedDim,
    },

    // Proof
    proofWrap: {
      marginVertical: 16,
      position: "relative",
    },
    burstLayer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },

    // Task row
    taskRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 12,
    },
    task: {
      flex: 1,
      fontFamily: fonts.serif,
      fontSize: 26,
      lineHeight: 28,
      color: c.inkStrong,
    },
    taskRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    revokedTag: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1.4,
      color: c.cap,
    },

    // ReactionBar
    bar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 18,
    },
    barLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 46,
      paddingHorizontal: 16,
      borderRadius: radii.pill,
      borderWidth: 1,
    },
    pillNum: {
      fontFamily: fonts.mono,
      fontSize: 13,
    },
    capPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 46,
      paddingHorizontal: 17,
      borderRadius: radii.pill,
      borderWidth: 1,
    },
    capNum: {
      fontFamily: fonts.monoMedium,
      fontSize: 13,
      letterSpacing: 0.5,
    },
  });
