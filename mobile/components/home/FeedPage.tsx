import { useEffect, useRef, type ReactNode } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { FeedPost } from "@/components/home/FeedPost";
import { InvitesCarousel } from "@/components/home/InvitesCarousel";
import { EmptyState } from "@/components/ui/primitives";
import { useThemeColors } from "@/lib/useThemeColors";
import type { Id } from "@/convex/_generated/dataModel";
import type { ProofItem, ProofActions, PendingInvite } from "@/components/home/types";

interface Props {
  proofs: ProofItem[];
  invites: PendingInvite[];
  actions: ProofActions;
  onAccept: (id: Id<"groupInvites">) => void;
  onDecline: (id: Id<"groupInvites">) => void;
  /** Shared Home-feed refresh state (native RefreshControl). Drives both manual
   *  pull and the programmatic Home-tab refresh. The feed is live via Convex, so
   *  this is brief UI feedback, not a real refetch. */
  refreshing: boolean;
  onRefresh: () => void;
}

// How far to pull the feed down to reveal the native RefreshControl when the
// refresh is triggered programmatically (Home tab) — roughly the iOS spinner
// height. iOS clamps to the actual refresh inset, so a generous value is fine.
const PULL_REVEAL = -72;

// The aggregated "Feed" page: pending invites + every group's receipts.
// New posts (ids that weren't in the first loaded batch) animate in; the
// initial batch and reactive re-renders (likes, caps) do not re-animate.
export function FeedPage({ proofs, invites, actions, onAccept, onDecline, refreshing, onRefresh }: Props) {
  const c = useThemeColors();
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const manualPull = useRef(false);
  const prevRefreshing = useRef(false);

  // A manual pull already reveals the RefreshControl. A programmatic refresh
  // (Home tab from a group) sets `refreshing` without a gesture, so reveal the
  // SAME native spinner by pulling the feed down into the refresh zone — this
  // also scrolls the feed to the top, matching the manual pull-to-refresh feel.
  useEffect(() => {
    if (refreshing && !prevRefreshing.current && !manualPull.current) {
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ y: PULL_REVEAL, animated: true }),
      );
    }
    if (!refreshing) manualPull.current = false;
    prevRefreshing.current = refreshing;
  }, [refreshing]);

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
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            manualPull.current = true;
            onRefresh();
          }}
          tintColor={c.accent}
          colors={[c.accent]}
          progressBackgroundColor={c.surface}
        />
      }
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
