import { type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";
import { useThemeColors } from "@/lib/useThemeColors";

interface Props {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width, height, radius = 6, style }: Props) {
  const colors = useThemeColors();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.paper3,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
