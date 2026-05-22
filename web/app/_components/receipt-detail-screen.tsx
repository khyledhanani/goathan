"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "./toast";
import { ProofLightbox } from "./proof-lightbox";
import { BottomNav } from "./bottom-nav";
import { AppHeader } from "./app-header";
import {
  FeedCard,
  type FeedCardItem,
  type ReactionKind,
} from "./feed-card";
import {
  resolveProofUrl,
  useSignedProofUrls,
  type ProofRef,
} from "./use-signed-proof-urls";

export function ReceiptDetailScreen({
  completionId,
}: {
  completionId: string;
}) {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const item = useQuery(api.proofs.byCompletionId, {
    completionId: completionId as Id<"completions">,
  });

  const toggleLike = useMutation(api.likes.toggle);
  const toggleChallenge = useMutation(api.challenges.toggle);
  const addComment = useMutation(api.comments.add);

  const [toast, setToast] = useState<ToastValue>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const signedProofUrls = useSignedProofUrls(
    item && item !== null ? [item as ProofRef] : [],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.replace("/");
  }, [authLoading, isAuthenticated, router]);

  const onToggleLike = async (
    id: Id<"completions">,
    kind: ReactionKind,
  ) => {
    try {
      await toggleLike({ completionId: id, kind });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  const onToggleCap = async (id: Id<"completions">) => {
    try {
      const result = await toggleChallenge({ completionId: id });
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
    id: Id<"completions">,
    body: string,
  ): Promise<void> => {
    try {
      const result = await addComment({ completionId: id, body });
      if (!result.ok) {
        setToast({ message: result.error, tone: "error" });
      }
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  if (authLoading || profile === undefined || item === undefined) {
    return (
      <div className="entry">
        <div className="entry-mid" style={{ textAlign: "center" }}>
          <p className="eyebrow">Loading…</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  if (item === null) {
    return (
      <div className="page-wrap has-bottom-nav">
        <AppHeader profile={profile} backHref="/dashboard" backLabel="← Feed" />
        <main className="page">
          <div className="page-head fade-up">
            <div>
              <span className="eyebrow">404</span>
              <h1 className="h-page h-page-serif" style={{ marginTop: 8 }}>
                Receipt gone<span className="roman">.</span>
              </h1>
              <p className="entry-dek" style={{ marginTop: 14, maxWidth: 520 }}>
                This receipt was deleted or you&apos;re no longer in the
                group it belongs to.
              </p>
              <div style={{ marginTop: 22 }}>
                <Link href="/dashboard" className="btn-primary">
                  Back to feed
                  <span className="arrow">→</span>
                </Link>
              </div>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page-wrap has-bottom-nav">
      <AppHeader profile={profile} backHref="/dashboard" backLabel="← Feed" />

      <main className="page page-feed-main">
        <div className="page-head fade-up">
          <div>
            <span className="eyebrow">
              Receipt · in{" "}
              <Link
                href={`/group/${item.groupId}`}
                className="btn-link"
                style={{ fontWeight: 700 }}
              >
                {item.groupName}
              </Link>
            </span>
            <h1 className="h-page h-page-serif" style={{ marginTop: 8 }}>
              {item.taskName}
              <span className="roman">.</span>
            </h1>
          </div>
        </div>

        <div className="feed-list" style={{ marginTop: 24 }}>
          <FeedCard
            item={resolveProofUrl(item as FeedCardItem & ProofRef, signedProofUrls)}
            onOpenProof={(url) => setLightboxUrl(url)}
            onToggleLike={onToggleLike}
            onToggleCap={onToggleCap}
            onComment={onComment}
          />
        </div>
      </main>

      <ProofLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      <Toast value={toast} onDismiss={() => setToast(null)} />
      <BottomNav />
    </div>
  );
}
