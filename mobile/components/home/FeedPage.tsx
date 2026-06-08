import { useEffect, useRef, type ReactNode } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { FeedPost } from "@/components/home/FeedPost";
import { InvitesCarousel } from "@/components/home/InvitesCarousel";
import { EmptyState } from "@/components/ui/primitives";
import type { Id } from "@/convex/_generated/dataModel";
import type { ProofItem, ProofActions, PendingInvite } from "@/components/home/types";

interface Props {
  proofs: ProofItem[];
  invites: PendingInvite[];
  actions: ProofActions;
  onAccept: (id: Id<"groupInvites">) => void;
  onDecline: (id: Id<"groupInvites">) => void;
}

// The aggregated "Feed" page: pending invites + every group's receipts.
// New posts (ids that weren't in the first loaded batch) animate in; the
// initial batch and reactive re-renders (likes, caps) do not re-animate.
export function FeedPage({ proofs, invites, actions, onAccept, onDecline }: Props) {
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  // Decide (during render) which posts are genuinely new. Only after the first
  // batch has been seeded do later arrivals qualify — keeps the first paint calm.
  const animateIds = new Set<string>();
  if (initialized.current) {
    for (const p of proofs) {
      if (!seen.current.has(p.completionId)) animateIds.add(p.completionId);
    }
  }

  useEffect(() => {
    for (const p of proofs) seen.current.add(p.completionId);
    initialized.current = true;
  }, [proofs]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {invites.length > 0 && (
        <InvitesCarousel invites={invites} onAccept={onAccept} onDecline={onDecline} />
      )}
      {proofs.length > 0 ? (
        proofs.map((p) => (
          <PostEnter key={p.completionId} animate={animateIds.has(p.completionId)}>
            <FeedPost item={p} actions={actions} />
          </PostEnter>
        ))
      ) : (
        <View style={{ paddingTop: 60 }}>
          <EmptyState
            head="No receipts yet"
            body="When you or your group post proof, it lands here. Tap the camera to drop your first receipt."
          />
        </View>
      )}
    </ScrollView>
  );
}

// `entering` only fires on mount; gating it by `animate` means existing posts
// (which never remount, thanks to the completionId key) never re-animate.
function PostEnter({ animate, children }: { animate: boolean; children: ReactNode }) {
  return (
    <Animated.View entering={animate ? FadeInDown.duration(420).springify().damping(20).mass(0.9) : undefined}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 130,
  },
});
