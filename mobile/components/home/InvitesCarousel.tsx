import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { Avatar, AccentBtn } from "@/components/ui/primitives";
import { useThemeColors } from "@/lib/useThemeColors";
import { fonts, radii } from "@/lib/theme";
import type { Colors } from "@/lib/theme";
import type { PendingInvite } from "@/components/home/types";
import type { Id } from "@/convex/_generated/dataModel";

// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — Invites (dashed-border accent card + paged carousel)
// Port of the prototype's InviteCard (screens.jsx) + InvitesCarousel
// (home-feed.jsx). Presentational only: props + callbacks.
// ════════════════════════════════════════════════════════════════════════

// ── Single invite card ─────────────────────────────────────────────────
export function InviteCard({
  invite,
  onAccept,
  onDecline,
  flush,
}: {
  invite: PendingInvite;
  onAccept: (id: Id<"groupInvites">) => void;
  onDecline: (id: Id<"groupInvites">) => void;
  flush?: boolean;
}) {
  const c = useThemeColors();
  const s = styles(c);
  return (
    <View style={[s.card, !flush && { marginBottom: 12 }]}>
      <Text style={s.eyebrow}>INVITE</Text>
      <Text style={s.groupName}>{invite.groupName}</Text>
      <View style={s.fromRow}>
        <Avatar
          uri={invite.invitedByAvatarUrl}
          initial={invite.invitedByName}
          size={26}
        />
        <Text style={s.fromText}>
          <Text style={s.fromName}>{invite.invitedByName}</Text>
          {" invited you"}
        </Text>
      </View>
      <View style={s.actions}>
        <DeclineBtn onPress={() => onDecline(invite.inviteId)} />
        <AccentBtn onPress={() => onAccept(invite.inviteId)} style={s.actionBtn}>
          Accept
        </AccentBtn>
      </View>
    </View>
  );
}

// Transparent-background variant of the shared Btn (prototype: bg "transparent").
function DeclineBtn({ onPress }: { onPress: () => void }) {
  const c = useThemeColors();
  const s = styles(c);
  return (
    <AnimatedPressable scaleDown={0.985} onPress={onPress} style={s.declineBtn}>
      <Text style={s.declineText}>Decline</Text>
    </AnimatedPressable>
  );
}

// ── Carousel (single card, or paged ScrollView of cards + dots) ─────────
export function InvitesCarousel({
  invites,
  onAccept,
  onDecline,
}: {
  invites: PendingInvite[];
  onAccept: (id: Id<"groupInvites">) => void;
  onDecline: (id: Id<"groupInvites">) => void;
}) {
  const c = useThemeColors();
  const s = styles(c);
  const [width, setWidth] = useState(0);
  const [cur, setCur] = useState(0);

  if (invites.length === 0) return null;

  if (invites.length === 1) {
    return (
      <InviteCard
        invite={invites[0]}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    );
  }

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const w = width || 1;
    const i = Math.round(e.nativeEvent.contentOffset.x / w);
    if (i !== cur) setCur(i);
  };

  return (
    <View style={s.carousel} onLayout={onLayout}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {width > 0 &&
          invites.map((inv) => (
            <View key={inv.inviteId} style={{ width }}>
              <InviteCard
                invite={inv}
                onAccept={onAccept}
                onDecline={onDecline}
                flush
              />
            </View>
          ))}
      </ScrollView>
      <View style={s.dots}>
        {invites.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i === cur ? s.dotActive : s.dotIdle,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = (c: Colors) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: c.accent,
      backgroundColor: c.accentBg,
      borderRadius: radii.card,
      paddingVertical: 20,
      paddingHorizontal: 22,
    },
    eyebrow: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: c.accent,
    },
    groupName: {
      fontFamily: fonts.serif,
      fontSize: 28,
      lineHeight: 30,
      color: c.inkStrong,
      marginTop: 8,
      marginBottom: 4,
    },
    fromRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 18,
    },
    fromText: {
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 14,
      color: c.muted,
    },
    fromName: {
      fontFamily: fonts.sansSemiBold,
      color: c.ink,
    },
    actions: {
      flexDirection: "row",
      gap: 12,
    },
    actionBtn: {
      flex: 1,
    },
    declineBtn: {
      flex: 1,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: radii.btn,
      paddingVertical: 18,
      paddingHorizontal: 20,
      alignItems: "center",
    },
    declineText: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 16,
      color: c.inkStrong,
    },

    // Carousel
    carousel: {
      marginBottom: 24,
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      marginTop: 12,
    },
    dot: {
      height: 6,
      borderRadius: 999,
    },
    dotActive: {
      width: 18,
      backgroundColor: c.accent,
    },
    dotIdle: {
      width: 6,
      backgroundColor: c.surface3,
    },
  });
