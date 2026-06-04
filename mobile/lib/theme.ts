import { Dimensions } from "react-native";

// ── Color palette (matches web globals.css :root) ──────────────────────

export const lightColors = {
  paper: "#f3efe2",
  paper2: "#ece6d2",
  paper3: "#e5dfc8",
  paperTranslucent: "rgba(243, 239, 226, 0.94)",
  ink: "#14130e",
  smoke: "#57523f",
  fog: "#8f8772",
  mist: "#b8b09a",
  rule: "#d5cdb3",
  accent: "#1d4f3f",
  accentHover: "#285f4d",
  accentSoft: "#d6e3dc",
  cap: "#b03525",
  capSoft: "#f0d8d2",
} as const;

export const darkColors = {
  paper: "#1c1a14",
  paper2: "#25221a",
  paper3: "#2f2b20",
  paperTranslucent: "rgba(28, 26, 20, 0.94)",
  ink: "#f0ebd8",
  smoke: "#c4bea8",
  fog: "#8f8772",
  mist: "#574f3d",
  rule: "#3a3528",
  accent: "#7ec4a3",
  accentHover: "#92d3b5",
  accentSoft: "#1f3329",
  cap: "#df705a",
  capSoft: "#3c1d17",
} as const;

export type Colors = typeof lightColors;

// ── Font families (loaded via expo-font in _layout.tsx) ────────────────

export const fonts = {
  serif: "InstrumentSerif_400Regular",
  sans: "HankenGrotesk_400Regular",
  sansMedium: "HankenGrotesk_500Medium",
  sansSemiBold: "HankenGrotesk_600SemiBold",
  sansBold: "HankenGrotesk_700Bold",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
} as const;

// ── Spacing & sizing ───────────────────────────────────────────────────

const { width: screenWidth } = Dimensions.get("window");

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  xxxl: 40,
} as const;

export const pagePadding = {
  horizontal: screenWidth < 720 ? 24 : 56,
  vertical: screenWidth < 720 ? 28 : 40,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  pill: 999,
} as const;

// ── Reanimated spring configs ─────────────────────────────────────────

export const springs = {
  press: { damping: 15, stiffness: 300, mass: 0.6 },
  bounce: { damping: 12, stiffness: 200, mass: 0.8 },
  gentle: { damping: 20, stiffness: 120, mass: 1 },
} as const;

// ── Timing durations ─────────────────────────────────────────────────

export const durations = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

// ── Shadow presets ────────────────────────────────────────────────────

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 8,
  },
} as const;
