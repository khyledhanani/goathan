import { View, Text, StyleSheet } from "react-native";
import { Btn, AccentBtn } from "@/components/ui/primitives";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import type { ProofItem } from "@/components/home/types";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — Call cap sheet INNER CONTENT
// Port of the prototype's CapSheet (flows.jsx), minus the grabber + the
// BottomSheet wrapper (the parent renders those). Uses the final chat copy:
//  · heading "Call cap?" / "You called cap" (the trailing serif "." was dropped, the "?" kept)
//  · plain muted explanation paragraph (no bright inline spans)
// ════════════════════════════════════════════════════════════════════════

interface Props {
  post: ProofItem;
  requiredCalls: number;
  onConfirm: () => void;
  onRevoke: () => void;
  onClose: () => void;
}

export function CapSheetContent({ post, requiredCalls, onConfirm, onRevoke, onClose }: Props) {
  const c = useThemeColors();
  const s = styles(c);

  const capped = post.challengedByYou;
  const caps = post.challengeCount;
  const remaining = Math.max(0, requiredCalls - caps);

  const eyebrow = remaining === 0 ? "Points pulled" : `${remaining} more to pull points`;

  const body = capped
    ? `You're challenging ${post.displayName}'s ${post.taskName}. ` +
      (remaining === 0
        ? "The points have been pulled."
        : `${remaining} more ${remaining === 1 ? "call" : "calls"} and the points get pulled.`) +
      " You can revoke your call any time."
    : `You're challenging ${post.displayName}'s proof for ${post.taskName}. It takes ${requiredCalls} calls for the group to pull the points.`;

  return (
    <View style={s.content}>
      <Text style={s.eyebrow}>{eyebrow}</Text>

      {/* progress cells */}
      <View style={s.cells}>
        {Array.from({ length: requiredCalls }).map((_, i) => {
          const filled = i < caps;
          return (
            <View
              key={i}
              style={[
                s.cell,
                {
                  backgroundColor: filled ? c.cap : c.surface2,
                  borderColor: filled ? c.cap : c.line,
                },
              ]}
            />
          );
        })}
      </View>

      <Text style={s.heading}>{capped ? "You called cap" : "Call cap?"}</Text>

      <Text style={s.body}>{body}</Text>

      <View style={s.btnRow}>
        {capped ? (
          <>
            <Btn onPress={onClose} style={{ flex: 1, backgroundColor: "transparent" }}>
              Keep it
            </Btn>
            <Btn
              onPress={onRevoke}
              style={{ flex: 1, backgroundColor: c.capBg, borderColor: c.cap }}
              textStyle={{ color: c.cap }}
            >
              Revoke cap
            </Btn>
          </>
        ) : (
          <>
            <Btn onPress={onClose} style={{ flex: 1, backgroundColor: "transparent" }}>
              Never mind
            </Btn>
            <AccentBtn onPress={onConfirm} style={{ flex: 1, backgroundColor: c.cap }}>
              Call cap
            </AccentBtn>
          </>
        )}
      </View>
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    content: {
      paddingTop: 8,
      paddingHorizontal: 24,
      paddingBottom: 6,
    },
    eyebrow: {
      fontFamily: fonts.mono,
      fontSize: 12,
      letterSpacing: 1.7,
      textTransform: "uppercase",
      color: c.cap,
    },
    cells: {
      flexDirection: "row",
      gap: 6,
      marginTop: 14,
      marginBottom: 18,
    },
    cell: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    heading: {
      fontFamily: fonts.serif,
      fontSize: 30,
      lineHeight: 34,
      color: c.inkStrong,
    },
    body: {
      fontFamily: fonts.sans,
      fontSize: 16,
      lineHeight: 24,
      color: c.muted,
      marginTop: 12,
    },
    btnRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 26,
    },
  });
