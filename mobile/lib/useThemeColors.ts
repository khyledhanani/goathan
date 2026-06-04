import { useColorScheme } from "react-native";
import { lightColors, darkColors } from "./theme";
import { useThemeChoice } from "./ThemeContext";

export type ThemeColors = {
  [K in keyof typeof lightColors]: string;
};

export function useThemeColors(): ThemeColors {
  const systemScheme = useColorScheme();
  const { choice } = useThemeChoice();

  const effective =
    choice === "system" ? systemScheme : choice;

  return effective === "dark" ? darkColors : lightColors;
}
