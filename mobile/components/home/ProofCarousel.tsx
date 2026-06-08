import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type GestureResponderEvent,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Icon } from "@/components/ui/Icon";
import { LinearGradient } from "@/components/ui/Gradient";
import { ProofImage } from "@/components/ui/primitives";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import { timeAgo } from "@/lib/timeAgo";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import type { ProofItem, ProofActions } from "@/components/home/types";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — ProofCarousel
// Full-width paged carousel of proof receipts. Actions overlaid on the photo.
// Double-tap a slide to like (+ heart burst). Chevrons + counter when >1.
// Port of the prototype's ProofCarousel (home-feed.jsx).
// ════════════════════════════════════════════════════════════════════════

const LIKE_RED = "#FF4D5E";
const DOUBLE_TAP_MS = 320;

interface Props {
  submissions: ProofItem[];
  actions: ProofActions;
  height?: number;
  onIndexChange?: (i: number) => void;
}

export function ProofCarousel({
  submissions,
  actions,
  height = 290,
  onIndexChange,
}: Props) {
  const c = useThemeColors();
  const s = styles(c);

  const scrollRef = useRef<ScrollView>(null);
  const [slideW, setSlideW] = useState(0);
  const [cur, setCur] = useState(0);
  const curRef = useRef(0);

  const multi = submissions.length > 1;

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setSlideW((prev) => (prev !== w ? w : prev));
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const w = slideW || 1;
      const i = Math.round(e.nativeEvent.contentOffset.x / w);
      if (i !== curRef.current) {
        curRef.current = i;
        setCur(i);
        onIndexChange?.(i);
      }
    },
    [slideW, onIndexChange],
  );

  const go = useCallback(
    (d: number) => {
      if (!slideW) return;
      const next = Math.max(0, Math.min(submissions.length - 1, curRef.current + d));
      scrollRef.current?.scrollTo({ x: next * slideW, animated: true });
    },
    [slideW, submissions.length],
  );

  return (
    <View style={s.root} onLayout={onContainerLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        style={s.scroll}
      >
        {submissions.map((sub) => (
          <Slide
            key={sub.completionId}
            sub={sub}
            actions={actions}
            width={slideW}
            height={height}
            colors={c}
          />
        ))}
      </ScrollView>

      {multi && slideW > 0 && (
        <>
          {/* Counter pill (top-right) */}
          <View style={s.counter} pointerEvents="none">
            <Text style={s.counterText}>
              {cur + 1}/{submissions.length}
            </Text>
          </View>

          {/* Left chevron — only when there's a previous slide.
              (Conditional render, not opacity:0 — AnimatedPressable drives
              opacity on the UI thread and would clobber a static hide.) */}
          {cur > 0 && (
            <AnimatedPressable
              scaleDown={0.9}
              haptic={null}
              dimOnPress={false}
              onPress={() => go(-1)}
              style={[s.arrow, s.arrowLeft]}
            >
              <Icon name="chevL" size={18} color="#fff" />
            </AnimatedPressable>
          )}

          {/* Right chevron — only when there's a next slide. */}
          {cur < submissions.length - 1 && (
            <AnimatedPressable
              scaleDown={0.9}
              haptic={null}
              dimOnPress={false}
              onPress={() => go(1)}
              style={[s.arrow, s.arrowRight]}
            >
              <Icon name="chevR" size={18} color="#fff" />
            </AnimatedPressable>
          )}
        </>
      )}
    </View>
  );
}

// ── One slide ────────────────────────────────────────────────────────────

function Slide({
  sub,
  actions,
  width,
  height,
  colors,
}: {
  sub: ProofItem;
  actions: ProofActions;
  width: number;
  height: number;
  colors: Colors;
}) {
  const s = styles(colors);
  const lastTap = useRef(0);

  // Heart-burst overlay state
  const burstScale = useSharedValue(0);
  const burstOpacity = useSharedValue(0);

  const fireBurst = useCallback(() => {
    burstScale.value = 0;
    burstOpacity.value = 0;
    burstScale.value = withSequence(
      withTiming(1.15, { duration: 180, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 90 }),
    );
    burstOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withDelay(220, withTiming(0, { duration: 240 })),
    );
  }, [burstOpacity, burstScale]);

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [{ scale: burstScale.value }],
  }));

  const handleLike = useCallback(() => {
    hapticLight();
    actions.onLike(sub);
  }, [actions, sub]);

  const handleComment = useCallback(() => {
    hapticLight();
    actions.onComment(sub);
  }, [actions, sub]);

  // Double-tap on the slide → like (if not already) + burst.
  const onSlidePress = useCallback(
    (_e: GestureResponderEvent) => {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        hapticMedium();
        if (!sub.likedByYou) actions.onLike(sub);
        fireBurst();
      } else {
        lastTap.current = now;
      }
    },
    [actions, sub, fireBurst],
  );

  const liked = sub.likedByYou;
  const name = sub.isYou ? "You" : sub.displayName;

  return (
    <Pressable onPress={onSlidePress} style={[s.slide, { width }]}>
      <ProofImage
        uri={sub.imageUrl}
        label={sub.taskCategory}
        height={height}
        radius={16}
      />

      {/* Heart burst overlay (center) */}
      <Animated.View pointerEvents="none" style={[s.burst, burstStyle]}>
        <Icon name="heart" size={96} color={LIKE_RED} fill={LIKE_RED} />
      </Animated.View>

      {/* Bottom overlay bar — true transparent→dark gradient (not a flat band).
          Overshoots the bottom by a few px so the slide's rounded clip leaves
          no hairline of bright image beneath the fade. */}
      <View style={s.overlay}>
        <LinearGradient
          style={{ bottom: -4 }}
          stops={[
            { offset: 0, color: "#0C0A07", opacity: 0 },
            { offset: 0.55, color: "#0C0A07", opacity: 0.5 },
            { offset: 1, color: "#0C0A07", opacity: 1 },
          ]}
        />
        <View style={s.overlayLeft}>
          <SlideAvatar uri={sub.avatarUrl} initial={sub.displayName} size={30} />
          <View style={s.nameCol}>
            <Text style={s.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={s.when}>{timeAgo(sub.whenMs)}</Text>
          </View>
        </View>

        <View style={s.overlayRight}>
          {/* Like glass pill */}
          <AnimatedPressable
            scaleDown={0.92}
            haptic={null}
            dimOnPress={false}
            onPress={handleLike}
            style={s.pill}
          >
            <Icon
              name="heart"
              size={17}
              color={liked ? LIKE_RED : "#fff"}
              fill={liked ? LIKE_RED : undefined}
            />
            {sub.likeCount > 0 && (
              <Text style={[s.pillText, liked && { color: LIKE_RED }]}>
                {sub.likeCount}
              </Text>
            )}
          </AnimatedPressable>

          {/* Comment glass pill */}
          <AnimatedPressable
            scaleDown={0.92}
            haptic={null}
            dimOnPress={false}
            onPress={handleComment}
            style={s.pill}
          >
            <Icon name="comment" size={17} color="#fff" />
            {sub.commentCount > 0 && (
              <Text style={s.pillText}>{sub.commentCount}</Text>
            )}
          </AnimatedPressable>
        </View>
      </View>
    </Pressable>
  );
}

// ── Inline white-on-glass avatar (matches overlay context, not theme) ─────
// Uses the shared Avatar look but tuned for an always-dark photo overlay.

function SlideAvatar({
  uri,
  initial,
  size,
}: {
  uri?: string | null;
  initial?: string;
  size: number;
}) {
  return (
    <View
      style={[
        avatarStyles.wrap,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          transition={150}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={uri}
        />
      ) : (
        <Text style={[avatarStyles.letter, { fontSize: Math.round(size * 0.36) }]}>
          {(initial ?? "?").charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  letter: {
    fontFamily: fonts.mono,
    color: "#fff",
  },
});

// ── Styles ────────────────────────────────────────────────────────────────

const styles = (c: Colors) =>
  StyleSheet.create({
    root: {
      position: "relative",
      width: "100%",
    },
    scroll: {
      borderRadius: 16,
    },
    slide: {
      position: "relative",
      // Single rounded clip for image + overlay → no subpixel seam at the bottom.
      borderRadius: 16,
      overflow: "hidden",
    },
    burst: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    overlay: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 44,
      paddingHorizontal: 12,
      paddingBottom: 12,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 8,
    },
    overlayLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      minWidth: 0,
      flexShrink: 1,
      paddingBottom: 4,
    },
    nameCol: {
      minWidth: 0,
      flexShrink: 1,
    },
    name: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
      color: "#fff",
    },
    when: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: "rgba(255,255,255,0.6)",
    },
    overlayRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 0,
    },
    pill: {
      height: 34,
      paddingHorizontal: 11,
      borderRadius: 999,
      backgroundColor: "rgba(12,10,7,0.5)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    pillText: {
      fontFamily: fonts.mono,
      fontSize: 12,
      color: "#fff",
    },
    counter: {
      position: "absolute",
      top: 12,
      right: 12,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: "rgba(12,10,7,0.5)",
    },
    counterText: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: "#fff",
    },
    arrow: {
      position: "absolute",
      top: "50%",
      marginTop: -17,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "rgba(12,10,7,0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
    arrowLeft: {
      left: 10,
    },
    arrowRight: {
      right: 10,
    },
  });
