"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { firstName } from "@/lib/utils";
import { Toast, type ToastValue } from "./toast";
import { ProofLightbox } from "./proof-lightbox";
import { ProfileGrid, type ProfileGridItem } from "./profile-grid";
import { TrophyCabinet } from "./trophy-cabinet";
import { BottomNav } from "./bottom-nav";
import { UserMenu } from "./user-menu";

export function UserProfilePage({ userId }: { userId: string }) {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();

  const me = useQuery(api.profiles.getCurrentProfile);
  const data = useQuery(api.proofs.gridForUser, {
    userId: userId as Id<"users">,
  });
  const trophies = useQuery(api.weekResults.trophiesForUser, {
    userId: userId as Id<"users">,
  });
  const streak = useQuery(api.streaks.forUser, {
    userId: userId as Id<"users">,
  });

  const [toast, setToast] = useState<ToastValue>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.replace("/");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (me && me.userId === (userId as Id<"users">)) {
      router.replace("/profile");
    }
  }, [me, userId, router]);

  void toast;

  if (authLoading || me === undefined || data === undefined) {
    return (
      <div className="entry">
        <div className="entry-mid" style={{ textAlign: "center" }}>
          <p className="eyebrow">Loading…</p>
        </div>
      </div>
    );
  }

  if (!me || data === null) return null;

  const target = data.profile;
  const items = data.items as ProfileGridItem[];
  const countLabel = items.length >= 60 ? "60+" : `${items.length}`;

  return (
    <div className="page-wrap has-bottom-nav">
      <header className="page-wrap-bar">
        <div className="topbar-left">
          <Link href="/dashboard" className="entry-brand">
            Receipts<span className="v">v0.1</span>
          </Link>
          <Link href="/dashboard" className="btn-link">
            ← Home
          </Link>
        </div>
        <div className="topbar-right">
          <UserMenu
            profile={{
              displayName: me.displayName,
              avatarUrl: me.avatarUrl,
            }}
          />
        </div>
      </header>

      <main className="page">
        {!data.sharesAnyGroup ? (
          <div className="page-head fade-up">
            <div>
              <span className="eyebrow">Profile</span>
              <h1 className="h-page h-page-serif" style={{ marginTop: 8 }}>
                {target.displayName}<span className="roman">.</span>
              </h1>
              <p className="entry-dek" style={{ marginTop: 14, maxWidth: 520 }}>
                You don&apos;t share a group with this person, so their
                receipts aren&apos;t visible.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="user-profile-hero fade-up">
              <span className="user-profile-avatar">
                {target.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={target.avatarUrl}
                    alt=""
                    width={88}
                    height={88}
                    className="avatar"
                  />
                ) : (
                  <span
                    className="avatar avatar-fallback"
                    style={{ width: 88, height: 88, fontSize: 32 }}
                  >
                    {target.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="user-profile-meta">
                <span className="eyebrow">Profile</span>
                <h1 className="h-page h-page-serif" style={{ marginTop: 6 }}>
                  {target.displayName}<span className="roman">.</span>
                </h1>
                {target.username && (
                  <p className="user-profile-handle mono">@{target.username}</p>
                )}
                <p className="user-profile-stats">
                  <span className="num">{countLabel}</span> receipts
                  {streak && streak.current > 0 && (
                    <>
                      <span className="user-profile-stats-sep" aria-hidden>
                        {" · "}
                      </span>
                      <span className="streak-flame" aria-hidden>
                        🔥
                      </span>
                      <span className="num">{streak.current}</span> day streak
                    </>
                  )}
                </p>
              </div>
            </div>

            <section className="fade-up d1" style={{ marginTop: 36 }}>
              <header className="section-head">
                <h2 className="h-section">Trophy cabinet.</h2>
                <span className="eyebrow">
                  {trophies === undefined
                    ? "Loading…"
                    : `${(trophies?.counts.gold ?? 0) + (trophies?.counts.silver ?? 0) + (trophies?.counts.bronze ?? 0)} medals`}
                </span>
              </header>
              <TrophyCabinet data={trophies ?? null} emptyOwn={false} />
            </section>

            <section className="fade-up d2" style={{ marginTop: 56 }}>
              <header className="section-head">
                <h2 className="h-section">Receipts.</h2>
                <span className="eyebrow">Verified · across shared groups</span>
              </header>
              <ProfileGrid
                items={items}
                onOpenProof={(url) => setLightboxUrl(url)}
                emptyTitle="Nothing yet"
                emptyLine={`${firstName(target.displayName)} hasn't posted a verified receipt yet.`}
              />
            </section>
          </>
        )}
      </main>

      <ProofLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      <Toast value={toast} onDismiss={() => setToast(null)} />
      <BottomNav />
    </div>
  );
}
