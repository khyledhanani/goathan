import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  View,
  StyleSheet,
  PanResponder,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/lib/useThemeColors";
import { radii, springs } from "@/lib/theme";

const { height: SCREEN_H } = Dimensions.get("window");

interface Props {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Hide the grabber + disable drag-to-dismiss (caller manages gestures). */
  noGrabber?: boolean;
  /** Fraction of the screen the sheet may grow to. Default 0.92. */
  maxHeightPct?: number;
}

// Generic warm-dark bottom sheet: fading backdrop + spring slide-up +
// drag-down-to-dismiss from the grabber. Used by Cap / Add-receipt /
// All-tasks / Leaderboard / Upload. (CommentDrawer is bespoke.)
export function BottomSheet({
  visible,
  onClose,
  children,
  noGrabber = false,
  maxHeightPct = 0.92,
}: Props) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);

  const ty = useSharedValue(SCREEN_H);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      ty.value = withSpring(0, springs.sheet);
      backdrop.value = withTiming(1, { duration: 240 });
    } else if (mounted) {
      backdrop.value = withTiming(0, { duration: 200 });
      ty.value = withTiming(SCREEN_H, { duration: 240 }, (fin) => {
        if (fin) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) ty.value = g.dy;
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.85) {
          onClose();
        } else {
          ty.value = withSpring(0, springs.sheet);
        }
      },
      onPanResponderTerminate: () => {
        ty.value = withSpring(0, springs.sheet);
      },
    }),
  ).current;

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdropBase, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: c.surface,
              borderColor: c.line,
              maxHeight: SCREEN_H * maxHeightPct,
              paddingBottom: insets.bottom + 12,
            },
            sheetStyle,
          ]}
        >
          {!noGrabber && (
            <View {...pan.panHandlers} style={styles.dragZone}>
              <View style={[styles.grabber, { backgroundColor: c.lineStrong }]} />
            </View>
          )}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdropBase: { backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.45,
    shadowRadius: 40,
    elevation: 24,
  },
  dragZone: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 6,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 999,
  },
});
