import { type ComponentProps } from "react";
import { Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { springs } from "@/lib/theme";
import { hapticLight, hapticMedium } from "@/lib/haptics";

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableProps = ComponentProps<typeof Pressable>;

interface Props extends PressableProps {
  scaleDown?: number;
  haptic?: "light" | "medium" | null;
  dimOnPress?: boolean;
}

export function AnimatedPressable({
  scaleDown = 0.97,
  haptic = "light",
  dimOnPress = true,
  onPressIn,
  onPressOut,
  style,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <ReanimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(scaleDown, springs.press);
        if (dimOnPress) opacity.value = withSpring(0.7, springs.press);
        if (haptic === "light") hapticLight();
        else if (haptic === "medium") hapticMedium();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, springs.press);
        if (dimOnPress) opacity.value = withSpring(1, springs.press);
        onPressOut?.(e);
      }}
      style={[animatedStyle, style]}
    />
  );
}
