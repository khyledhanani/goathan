export const colors = {
  bg:        "#090B0A",
  surface:   "#0F1210",
  surface2:  "#161A17",
  surface3:  "#1E2420",
  border:    "#262D29",
  borderHi:  "#354039",

  white:     "#E8F0EA",
  white2:    "#A8B8AE",
  muted:     "#5C6E64",
  faint:     "#3A4840",

  accent:       "#FF6B1A",
  accentDim:    "rgba(255,107,26,0.14)",
  accentGlow:   "rgba(255,107,26,0.24)",

  danger:    "#FF4535",
  dangerDim: "rgba(255,69,53,0.14)",

  gold:      "#F5C842",
  goldDim:   "rgba(245,200,66,0.12)",
} as const;

export const font = {
  // Use system fonts — swap in custom fonts via expo-font later
  display: { fontFamily: "System", fontWeight: "900" as const },
  mono:    { fontFamily: "Courier New" },
  body:    { fontFamily: "System" },
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
} as const;
