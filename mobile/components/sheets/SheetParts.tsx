import { type ReactNode } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Icon } from "@/components/ui/Icon";
import { TitleDot, ProofImage, AccentBtn, Btn } from "@/components/ui/primitives";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts } from "@/lib/theme";

// Shared building blocks for the add-receipt / upload sheets.

export function SheetHeader({
  eyebrow,
  title,
  onBack,
  onClose,
}: {
  eyebrow?: string;
  title: string;
  onBack?: () => void;
  onClose: () => void;
}) {
  const c = useThemeColors();
  return (
    <View style={sp.headerRow}>
      <View style={{ flex: 1 }}>
        {eyebrow != null && <Text style={[sp.eyebrow, { color: c.muted }]}>{eyebrow}</Text>}
        <TitleDot text={title} size={30} style={{ marginTop: eyebrow ? 8 : 0 }} />
      </View>
      <AnimatedPressable
        scaleDown={0.9}
        onPress={onBack ?? onClose}
        style={[sp.roundBtn, { backgroundColor: c.surface2, borderColor: c.line }]}
      >
        <Icon name={onBack ? "chevL" : "x"} size={18} color={c.muted} />
      </AnimatedPressable>
    </View>
  );
}

export function CaptureStep({
  label,
  ptsLabel,
  onPick,
  busy,
  phase,
}: {
  label: string;
  ptsLabel: string;
  onPick: (source: "camera" | "library") => void;
  busy?: boolean;
  phase?: string | null;
}) {
  const c = useThemeColors();
  return (
    <View>
      <View style={{ position: "relative" }}>
        <ProofImage uri={null} label={label} height={290} />
        <View style={sp.captureCenter} pointerEvents="none">
          <View style={[sp.captureCircle, { backgroundColor: "rgba(20,18,12,0.55)" }]}>
            <Icon name="camera" size={27} color={c.ink} />
          </View>
        </View>
        {busy && (
          <View style={[sp.busyOverlay, { backgroundColor: "rgba(12,10,7,0.6)" }]}>
            <ActivityIndicator color={c.accent} />
            {phase ? <Text style={[sp.busyText, { color: "#fff" }]}>{phase}</Text> : null}
          </View>
        )}
      </View>
      <View style={{ gap: 12, marginTop: 20 }}>
        <AccentBtn onPress={() => onPick("camera")} disabled={busy}>
          {ptsLabel}
        </AccentBtn>
        <Btn onPress={busy ? undefined : () => onPick("library")} style={{ backgroundColor: "transparent" }}>
          Choose from library
        </Btn>
      </View>
    </View>
  );
}

export function DoneStep({
  title,
  sub,
  onClose,
  onAgain,
}: {
  title: string;
  sub: ReactNode;
  onClose: () => void;
  onAgain?: () => void;
}) {
  const c = useThemeColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: 8 }}>
      <View style={[sp.doneCircle, { backgroundColor: c.accentBg, borderColor: c.accent }]}>
        <Icon name="check" size={38} color={c.accent} strokeWidth={2} />
      </View>
      <TitleDot text={title} size={30} />
      <Text style={[sp.doneSub, { color: c.muted }]}>{sub}</Text>
      <View style={{ gap: 12, marginTop: 26, width: "100%" }}>
        {onAgain && (
          <Btn onPress={onAgain} style={{ backgroundColor: "transparent" }}>
            Add another
          </Btn>
        )}
        <AccentBtn onPress={onClose}>Done</AccentBtn>
      </View>
    </View>
  );
}

const sp = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 6,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  captureCenter: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  captureCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  busyOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  busyText: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.6 },
  doneCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  doneSub: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: fonts.sans,
    maxWidth: 280,
    textAlign: "center",
    lineHeight: 23,
  },
});
