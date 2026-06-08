import { Dimensions } from "react-native";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — Design tokens
// Ported from the "Receipts" prototype (tokens.css). Warm near-black,
// editorial serif + tracked mono, single sage-mint accent.
// Dark is the canonical mode (exact spec); light is a warm-cream mirror.
//
// Existing token keys (paper/ink/smoke/fog/mist/rule/accent…) are kept so
// older screens keep compiling; the richer design tokens (surface ramp,
// line/lineStrong, inkStrong, muted/mutedDim/faint, accentBg, capBg…) are
// added alongside. Both palettes share an identical key set.
// ════════════════════════════════════════════════════════════════════════

export const darkColors = {
  // Background ramp (warm near-black, climbing in lightness)
  bgDeep: "#131009", // behind the app / letterbox
  paper: "#1A1711", // app background          (--bg)
  bgElev: "#211D16", // raised background bands  (--bg-elev)
  surface: "#24201A", // cards, panels            (--surface)
  surface2: "#2C271F", // inputs, pressed states   (--surface-2)
  surface3: "#34302A", // avatars, chips on surface(--surface-3)

  // Legacy aliases onto the ramp
  paper2: "#24201A", // → surface
  paper3: "#2C271F", // → surface-2
  paperTranslucent: "rgba(26, 23, 17, 0.94)",

  // Ink (warm cream, descending emphasis)
  inkStrong: "#F6F1E6", // titles / emphasis
  ink: "#ECE6D8", // primary text
  smoke: "#C4BEA8", // bright secondary text
  muted: "#989183", // labels, secondary
  fog: "#989183", // → muted (legacy)
  mutedDim: "#6B6457", // tertiary, empty-state body
  mist: "#6B6457", // → mutedDim (legacy)
  faint: "#4C463A", // inactive icons / placeholder

  // Hairlines
  line: "rgba(237,231,217,0.085)",
  lineStrong: "rgba(237,231,217,0.16)",
  rule: "rgba(237,231,217,0.085)", // → line (legacy)

  // Accent (sage-mint)
  accent: "#8AC7A8",
  accentHover: "#74B997",
  accentPress: "#74B997",
  accentBg: "rgba(138,199,168,0.14)",
  accentSoft: "rgba(138,199,168,0.14)", // → accentBg (legacy)

  // Signal
  cap: "#E2564A",
  capBg: "rgba(226,86,74,0.15)",
  capSoft: "rgba(226,86,74,0.15)", // → capBg (legacy)
  warn: "#E8C25A",

  // Ink that reads on top of the mint accent (buttons etc.)
  onAccent: "#16140D",
} as const;

export const lightColors: { [K in keyof typeof darkColors]: string } = {
  bgDeep: "#E7E1CF",
  paper: "#F3EFE2",
  bgElev: "#EDE7D6",
  surface: "#FBF8EF",
  surface2: "#ECE6D2",
  surface3: "#E2DBC5",

  paper2: "#FBF8EF",
  paper3: "#E5DFC8",
  paperTranslucent: "rgba(243, 239, 226, 0.94)",

  inkStrong: "#14110A",
  ink: "#1C1A12",
  smoke: "#57523F",
  muted: "#7C745E",
  fog: "#7C745E",
  mutedDim: "#A39B85",
  mist: "#A39B85",
  faint: "#C2BAA3",

  line: "rgba(20,19,14,0.085)",
  lineStrong: "rgba(20,19,14,0.18)",
  rule: "rgba(20,19,14,0.085)",

  accent: "#1D4F3F",
  accentHover: "#285F4D",
  accentPress: "#285F4D",
  accentBg: "rgba(29,79,63,0.10)",
  accentSoft: "rgba(29,79,63,0.10)",

  cap: "#B03525",
  capBg: "rgba(176,53,37,0.10)",
  capSoft: "rgba(176,53,37,0.10)",
  warn: "#9A6A12",

  onAccent: "#F3EFE2",
} as const;

export type Colors = { [K in keyof typeof darkColors]: string };

// ── Font families (loaded via expo-font in _layout.tsx) ────────────────
// Display: InstrumentSerif · Sans: HankenGrotesk · Mono: JetBrainsMono
// The redesign uses the serif UPRIGHT (no italic) for editorial titles.

export const fonts = {
  serif: "InstrumentSerif_400Regular",
  sans: "HankenGrotesk_400Regular",
  sansMedium: "HankenGrotesk_500Medium",
  sansSemiBold: "HankenGrotesk_600SemiBold",
  sansBold: "HankenGrotesk_700Bold",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
} as const;

// Tracked-caps label preset (mono, 0.16em ≈ letterSpacing on RN)
export const labelSpacing = 1.6;

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

export const SCREEN_PAD = 24;

export const radii = {
  sm: 6,
  md: 10,
  chip: 10,
  btn: 14,
  input: 14,
  card: 22,
  cardLg: 26,
  pill: 999,
} as const;

// ── Reanimated spring configs ─────────────────────────────────────────

export const springs = {
  press: { damping: 15, stiffness: 300, mass: 0.6 },
  bounce: { damping: 12, stiffness: 200, mass: 0.8 },
  gentle: { damping: 20, stiffness: 120, mass: 1 },
  sheet: { damping: 22, stiffness: 240, mass: 0.9 },
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
  sheet: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.45,
    shadowRadius: 40,
    elevation: 20,
  },
} as const;

// ── Category accent labels (schema: MORNING|MOVE|FUEL|MIND|REST) ───────

export const CATEGORY_LABEL: Record<string, string> = {
  MORNING: "MORNING",
  MOVE: "MOVE",
  FUEL: "FUEL",
  MIND: "MIND",
  REST: "REST",
};

// Proof placeholder tints (when an image is missing — striped block)
export const PROOF_TINT = "#312B22";
