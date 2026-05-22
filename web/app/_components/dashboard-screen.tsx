"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { firstName } from "@/lib/utils";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "./toast";
import { ProofLightbox } from "./proof-lightbox";
import { StoriesRail, type StoryBundle } from "./stories-rail";
import { StoryViewer } from "./story-viewer";
import {
  FeedCard,
  type FeedCardItem,
  type ReactionKind,
} from "./feed-card";
import { FeedStatsBar } from "./feed-stats-bar";
import { BottomNav } from "./bottom-nav";
import { PushPrompt } from "./push-prompt";
import { AppHeader } from "./app-header";
import {
  resolveProofUrl,
  useSignedProofUrls,
  type ProofRef,
} from "./use-signed-proof-urls";

export function DashboardScreen() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const home = useQuery(api.groups.homeView);
  const stories = useQuery(api.proofs.storiesAcrossMyGroups);
  const feed = useQuery(api.proofs.feedAcrossMyGroups, {});

  const upsertFromAuth = useMutation(api.profiles.upsertCurrentProfileFromAuth);
  const toggleLike = useMutation(api.likes.toggle);
  const toggleChallenge = useMutation(api.challenges.toggle);
  const addComment = useMutation(api.comments.add);
  const markFeedSeen = useMutation(api.profiles.markFeedSeen);

  const [toast, setToast] = useState<ToastValue>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [storyStart, setStoryStart] = useState<number | null>(null);

  const proofRefs = useMemo(() => {
    const refs: ProofRef[] = [];
    refs.push(...((feed?.items ?? []) as ProofRef[]));
    for (const bundle of (stories ?? []) as StoryBundle[]) {
      refs.push(...(bundle.items as ProofRef[]));
    }
    return refs;
  }, [feed, stories]);
  const signedProofUrls = useSignedProofUrls(proofRefs);
  const resolvedFeedItems = useMemo(
    () =>
      feed?.items.map((item) =>
        resolveProofUrl(item as FeedCardItem & ProofRef, signedProofUrls),
      ) ?? [],
    [feed, signedProofUrls],
  );
  const resolvedStories = useMemo(
    () =>
      ((stories ?? []) as StoryBundle[]).map((bundle) => ({
        ...bundle,
        items: bundle.items.map((item) =>
          resolveProofUrl(item as ProofRef & (typeof bundle.items)[number], signedProofUrls),
        ),
      })),
    [stories, signedProofUrls],
  );

  const seenSnapshotRef = useRef<number | null>(null);
  const hasMarkedRef = useRef(false);
  if (seenSnapshotRef.current === null && feed) {
    seenSnapshotRef.current = feed.lastSeenFeedAt;
  }
  const seenThreshold = seenSnapshotRef.current ?? 0;

  useEffect(() => {
    if (!feed || hasMarkedRef.current) return;
    hasMarkedRef.current = true;
    void markFeedSeen({});
  }, [feed, markFeedSeen]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    if (profile === undefined) return;
    if (profile === null || !profile.email || !profile.avatarUrl) {
      void upsertFromAuth({});
      return;
    }
    if (!profile.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }
    try {
      const pending = localStorage.getItem("receipts.pendingJoinCode");
      if (pending && /^[A-Z0-9]{6}$/.test(pending)) {
        localStorage.removeItem("receipts.pendingJoinCode");
        router.replace(`/join/${pending}`);
      }
    } catch {
      // storage blocked, nothing to do
    }
  }, [authLoading, isAuthenticated, profile, upsertFromAuth, router]);

  const onToggleLike = async (
    completionId: Id<"completions">,
    kind: ReactionKind,
  ) => {
    try {
      await toggleLike({ completionId, kind });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  const onToggleCap = async (completionId: Id<"completions">) => {
    try {
      const result = await toggleChallenge({ completionId });
      const message =
        result.state === "added"
          ? result.revoked
            ? "Cap upheld — points revoked"
            : "Cap called"
          : result.revoked
            ? "Cap retracted"
            : "Cap retracted — points restored";
      setToast({
        message,
        tone: result.state === "added" ? "error" : "neutral",
      });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  const onComment = async (
    completionId: Id<"completions">,
    body: string,
  ): Promise<void> => {
    try {
      const result = await addComment({ completionId, body });
      if (!result.ok) {
        setToast({ message: result.error, tone: "error" });
      }
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  const splitItems = useMemo(() => {
    if (!feed) return { fresh: [] as FeedCardItem[], older: [] as FeedCardItem[] };
    const fresh: FeedCardItem[] = [];
    const older: FeedCardItem[] = [];
    for (const it of resolvedFeedItems as FeedCardItem[]) {
      if (seenThreshold > 0 && it.verifiedAt > seenThreshold) fresh.push(it);
      else older.push(it);
    }
    return { fresh, older };
  }, [feed, resolvedFeedItems, seenThreshold]);

  if (
    authLoading ||
    profile === undefined ||
    profile === null ||
    !profile.onboardingCompleted ||
    home === undefined
  ) {
    return (
      <div className="entry">
        <div className="entry-mid" style={{ textAlign: "center" }}>
          <p className="eyebrow">Loading…</p>
        </div>
      </div>
    );
  }

  const hello = firstName(profile.displayName);
  const hasGroups = (home?.totals.groupCount ?? 0) > 0;
  const totalItems = feed?.items.length ?? 0;

  return (
    <div className="page-wrap page-feed has-bottom-nav">
      <AppHeader profile={profile} variant="feed" />

      <FeedStatsBar
        todayDone={home?.totals.todayDone ?? 0}
        totalDailyTasks={home?.totals.totalDailyTasks ?? 0}
        todayPoints={home?.totals.todayPoints ?? 0}
        groupCount={home?.totals.groupCount ?? 0}
        earliestPeriodEndMs={
          home?.groups.length
            ? Math.min(...home.groups.map((g) => g.stats.periodEndMs))
            : undefined
        }
      />

      <PushPrompt eligible={(home?.totals.groupCount ?? 0) > 0} />

      <main className="page page-feed-main">
        {!hasGroups ? (
          <EmptyFeed hello={hello} />
        ) : (
          <>
            {resolvedStories.length > 0 && (
              <StoriesRail
                stories={resolvedStories}
                onOpen={(i) => setStoryStart(i)}
              />
            )}

            {feed === undefined ? (
              <p className="muted-line" style={{ marginTop: 28 }}>
                Loading feed…
              </p>
            ) : totalItems === 0 ? (
              <div className="activity-empty" style={{ marginTop: 28 }}>
                <p className="eyebrow">Quiet here</p>
                <p className="activity-empty-line">
                  No verified receipts yet. Be the first to post.
                </p>
              </div>
            ) : (
              <div className="feed-list">
                {splitItems.fresh.map((item) => (
                  <FeedCard
                    key={item.completionId}
                    item={item}
                    onOpenProof={(url) => setLightboxUrl(url)}
                    onToggleLike={onToggleLike}
                    onToggleCap={onToggleCap}
                    onComment={onComment}
                  />
                ))}

                {splitItems.fresh.length > 0 &&
                  splitItems.older.length > 0 && (
                    <div className="feed-divider" role="separator">
                      <span className="feed-divider-line" aria-hidden />
                      <span className="feed-divider-label mono">
                        Older · seen before
                      </span>
                      <span className="feed-divider-line" aria-hidden />
                    </div>
                  )}

                {splitItems.older.map((item) => (
                  <FeedCard
                    key={item.completionId}
                    item={item}
                    onOpenProof={(url) => setLightboxUrl(url)}
                    onToggleLike={onToggleLike}
                    onToggleCap={onToggleCap}
                    onComment={onComment}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <ProofLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      <StoryViewer
        stories={resolvedStories}
        startIndex={storyStart}
        onClose={() => setStoryStart(null)}
      />
      <Toast value={toast} onDismiss={() => setToast(null)} />
      <BottomNav />
    </div>
  );
}

function EmptyFeed({ hello }: { hello: string }) {
  return (
    <div className="page-head fade-up">
      <div>
        <span className="eyebrow">Welcome to Receipts</span>
        <h1 className="h-page" style={{ marginTop: 8 }}>
          {hello}<span className="roman">.</span>
        </h1>
        <p className="entry-dek" style={{ marginTop: 14, maxWidth: 520 }}>
          You&apos;re in, but not in a group yet. Head to Groups to spin one up
          or join with a code.
        </p>
        <div style={{ marginTop: 22 }}>
          <Link href="/groups" className="btn-primary">
            Go to Groups
            <span className="arrow">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
