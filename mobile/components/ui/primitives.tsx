import { type ReactNode } from "react";
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from "react-native";
import { Image } from "expo-image";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Icon } from "@/components/ui/Icon";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — shared UI primitives (port of the prototype's ui.jsx)
// ════════════════════════════════════════════════════════════════════════

// ── Serif title with the signature accent "." ──────────────────────────
export function TitleDot({
  text,
  size,
  color,
  style,
}: {
  text: string;
  size: number;
  color?: string;
  style?: TextStyle;
}) {
  const c = useThemeColors();
  return (
    <Text
      style={[
        { fontFamily: fonts.serif, fontSize: size, color: color ?? c.inkStrong, lineHeight: size * 1.02 },
        style,
      ]}
    >
      {text}
      <Text style={{ color: c.accent }}>.</Text>
    </Text>
  );
}

// ── Page title block: mono eyebrow + serif title(.) + optional trailing ──
export function ScreenHeader({
  eyebrow,
  title,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  trailing?: ReactNode;
}) {
  const c = useThemeColors();
  return (
    <View style={ph.headerRow}>
      <View style={{ flex: 1 }}>
        {eyebrow != null && (
          <Text style={[ph.eyebrow, { color: c.muted }]}>{eyebrow}</Text>
        )}
        <TitleDot text={title} size={50} style={{ marginTop: eyebrow ? 13 : 0 }} />
      </View>
      {trailing}
    </View>
  );
}

// ── In-screen section header: serif(.) + mono count ────────────────────
export function SectionHeader({
  title,
  count,
  style,
}: {
  title: string;
  count?: string;
  style?: ViewStyle;
}) {
  const c = useThemeColors();
  return (
    <View style={[ph.sectionRow, style]}>
      <TitleDot text={title} size={30} />
      {count != null && <Text style={[ph.sectionCount, { color: c.muted }]}>{count}</Text>}
    </View>
  );
}

// ── Avatar (image or mono initial) ─────────────────────────────────────
export function Avatar({
  initial,
  uri,
  size = 44,
  fontSize,
  accent = false,
}: {
  initial?: string;
  uri?: string | null;
  size?: number;
  fontSize?: number;
  accent?: boolean;
}) {
  const c = useThemeColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: accent ? c.accentBg : c.surface3,
        borderWidth: 1,
        borderColor: c.line,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
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
        <Text
          style={{
            fontFamily: fonts.mono,
            fontSize: fontSize ?? Math.round(size * 0.36),
            color: accent ? c.accent : c.muted,
          }}
        >
          {(initial ?? "?").charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

export function AvatarStack({
  items,
  size = 38,
}: {
  items: { initial?: string; uri?: string | null }[];
  size?: number;
}) {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: "row" }}>
      {items.slice(0, 5).map((it, i) => (
        <View
          key={i}
          style={{
            marginLeft: i ? -12 : 0,
            borderRadius: size / 2,
            borderWidth: 3,
            borderColor: c.paper,
          }}
        >
          <Avatar initial={it.initial} uri={it.uri} size={size} />
        </View>
      ))}
    </View>
  );
}

// ── Category badge (mono tracked caps) ─────────────────────────────────
export function CatBadge({ cat }: { cat: string }) {
  const c = useThemeColors();
  return <Text style={[ph.catBadge, { color: c.mutedDim }]}>{cat}</Text>;
}

// ── Points (+value, accent, mono) ──────────────────────────────────────
export function Pts({ value, size = 16 }: { value: number; size?: number }) {
  const c = useThemeColors();
  return <Text style={{ fontFamily: fonts.mono, fontSize: size, color: c.accent }}>+{value}</Text>;
}

// ── Proof image with striped-block fallback ────────────────────────────
export function ProofImage({
  uri,
  label = "PROOF",
  height = 250,
  radius = 16,
  style,
}: {
  uri?: string | null;
  label?: string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const c = useThemeColors();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: "100%", height, borderRadius: radius, backgroundColor: c.surface2 }, style as object]}
        contentFit="cover"
        transition={160}
        cachePolicy="memory-disk"
        recyclingKey={uri}
        placeholder={{ blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6." }}
      />
    );
  }
  return (
    <View
      style={[
        {
          height,
          borderRadius: radius,
          backgroundColor: c.surface2,
          borderWidth: 1,
          borderColor: c.line,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: 11,
          letterSpacing: 1.8,
          color: c.mutedDim,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Buttons ────────────────────────────────────────────────────────────
export function Btn({
  children,
  onPress,
  style,
  textStyle,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}) {
  const c = useThemeColors();
  return (
    <AnimatedPressable
      scaleDown={0.985}
      onPress={onPress}
      style={[
        {
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: radii.btn,
          paddingVertical: 18,
          paddingHorizontal: 20,
          alignItems: "center",
        },
        style,
      ]}
    >
      <Text style={[{ fontFamily: fonts.sansSemiBold, fontSize: 16, color: c.inkStrong }, textStyle]}>
        {children}
      </Text>
    </AnimatedPressable>
  );
}

export function AccentBtn({
  children,
  onPress,
  disabled,
  style,
  textStyle,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}) {
  const c = useThemeColors();
  return (
    <AnimatedPressable
      scaleDown={disabled ? 1 : 0.985}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      dimOnPress={!disabled}
      style={[
        {
          backgroundColor: disabled ? c.surface2 : c.accent,
          borderRadius: radii.btn,
          paddingVertical: 18,
          paddingHorizontal: 20,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
        },
        style,
      ]}
    >
      <Text
        style={[
          { fontFamily: fonts.sansSemiBold, fontSize: 16, color: disabled ? c.mutedDim : c.onAccent },
          textStyle,
        ]}
      >
        {children}
      </Text>
    </AnimatedPressable>
  );
}

export function PillBtn({
  children,
  onPress,
  color,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  color?: string;
  style?: ViewStyle;
}) {
  const c = useThemeColors();
  return (
    <AnimatedPressable
      scaleDown={0.96}
      onPress={onPress}
      style={[
        {
          borderWidth: 1,
          borderColor: c.lineStrong,
          borderRadius: radii.pill,
          paddingVertical: 12,
          paddingHorizontal: 20,
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: 13,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: color ?? c.accent,
        }}
      >
        {children}
      </Text>
    </AnimatedPressable>
  );
}

export function LinkBtn({
  children,
  onPress,
  color,
  withArrow = true,
}: {
  children: ReactNode;
  onPress?: () => void;
  color?: string;
  withArrow?: boolean;
}) {
  const c = useThemeColors();
  return (
    <AnimatedPressable
      scaleDown={0.96}
      dimOnPress
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
    >
      <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 16, color: color ?? c.accent }}>
        {children}
      </Text>
      {withArrow && <Icon name="arrowR" size={17} color={color ?? c.accent} />}
    </AnimatedPressable>
  );
}

// ── Stat grid (RANK / GAP / TODAY / WEEK) ──────────────────────────────
export function StatGrid({
  stats,
}: {
  stats: { k: string; v: string | number; s: string; hot?: boolean }[];
}) {
  const c = useThemeColors();
  return (
    <View style={[ph.statGrid, { borderTopColor: c.line }]}>
      {stats.map((st, i) => (
        <View key={i} style={{ flex: 1 }}>
          <Text style={[ph.statK, { color: c.mutedDim }]}>{st.k}</Text>
          <Text style={[ph.statV, { color: st.hot ? c.accent : c.inkStrong }]} numberOfLines={1}>
            {st.v}
          </Text>
          <Text style={[ph.statS, { color: c.mutedDim }]} numberOfLines={1}>
            {st.s}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Empty state ────────────────────────────────────────────────────────
export function EmptyState({ head, body }: { head: string; body: string }) {
  const c = useThemeColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: 26, paddingHorizontal: 20 }}>
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: 13,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: c.muted,
          textAlign: "center",
        }}
      >
        {head}
      </Text>
      <Text
        style={{
          color: c.mutedDim,
          marginTop: 12,
          fontSize: 16,
          fontFamily: fonts.sans,
          maxWidth: 300,
          textAlign: "center",
          lineHeight: 23,
        }}
      >
        {body}
      </Text>
    </View>
  );
}

const ph = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 8,
    paddingBottom: 26,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  sectionCount: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginLeft: 12,
  },
  catBadge: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  statGrid: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 20,
  },
  statK: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statV: {
    fontFamily: fonts.mono,
    fontSize: 26,
    marginTop: 8,
    marginBottom: 4,
  },
  statS: {
    fontFamily: fonts.mono,
    fontSize: 11,
  },
});

export { ph as primitiveStyles };
