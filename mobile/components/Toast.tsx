import { useEffect } from "react";
import { Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, springs } from "@/lib/theme";
import { hapticSuccess, hapticError } from "@/lib/haptics";

export type ToastValue = { message: string; tone: "error" | "success" } | null;

interface Props {
  value: ToastValue;
  onDismiss: () => void;
}

export function Toast({ value, onDismiss }: Props) {
  const colors = useThemeColors();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-18);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    if (!value) return;

    // Fire haptic
    if (value.tone === "success") hapticSuccess();
    else hapticError();

    // Animate in
    opacity.value = withSpring(1, springs.bounce);
    translateY.value = withSpring(0, springs.bounce);
    scale.value = withSpring(1, springs.bounce);

    // Animate out after delay
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 300 });
      translateY.value = withTiming(-14, { duration: 300 });
      scale.value = withTiming(0.95, { duration: 300 }, () => {
        runOnJS(onDismiss)();
      });
    }, 2800);

    return () => clearTimeout(timer);
  }, [value]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (!value) return null;

  const bg = value.tone === "error" ? colors.cap : colors.accent;

  return (
    <Animated.View
      style={[styles.toast, { backgroundColor: bg }, animatedStyle]}
    >
      <Text style={[styles.text, { color: colors.paper }]}>
        {value.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    maxWidth: "90%",
    zIndex: 300,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 8,
  },
  text: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    letterSpacing: 0.1,
    textAlign: "center",
  },
});
