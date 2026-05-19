"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Toast, type ToastValue } from "./toast";
import { ProofLightbox } from "./proof-lightbox";
import { ProfileGrid, type ProfileGridItem } from "./profile-grid";
import { TrophyCabinet } from "./trophy-cabinet";
import { BottomNav } from "./bottom-nav";
import { UserMenu } from "./user-menu";

export function ProfileScreen() {
  const router = useRouter();
  const { isLoading: authLoading } = useConvexAuth();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const groups = useQuery(api.groups.getMyGroups);
  const myReceipts = useQuery(
    api.proofs.gridForUser,
    profile ? { userId: profile.userId } : "skip",
  );
  const myTrophies = useQuery(
    api.weekResults.trophiesForUser,
    profile ? { userId: profile.userId } : "skip",
  );
  const myStreak = useQuery(
    api.streaks.forUser,
    profile ? { userId: profile.userId } : "skip",
  );

  const [toast, setToast] = useState<ToastValue>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  void router;

  if (authLoading || profile === undefined) {
    return (
      <div className="entry">
        <div className="entry-mid" style={{ textAlign: "center" }}>
          <p className="eyebrow">Loading…</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

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
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
            }}
          />
        </div>
      </header>

      <main className="page">
        <div className="page-head fade-up">
          <div>
            <span className="eyebrow">Account</span>
            <h1 className="h-page" style={{ marginTop: 8 }}>
              Profile<span className="roman">.</span>
            </h1>
            {myStreak && (myStreak.current > 0 || myStreak.longest > 0) && (
              <p className="streak-line" style={{ marginTop: 14 }}>
                <span className="streak-chip">
                  <span className="streak-flame" aria-hidden>
                    🔥
                  </span>
                  <span className="num">{myStreak.current}</span>
                  <span className="streak-chip-label">day streak</span>
                </span>
                {myStreak.longest > myStreak.current && (
                  <span className="streak-longest mono">
                    Longest{" "}
                    <span className="num">{myStreak.longest}</span>
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <section className="fade-up d1">
          <header className="section-head">
            <h2 className="h-section">Trophy cabinet.</h2>
            <span className="eyebrow">
              {myTrophies === undefined
                ? "Loading…"
                : `${(myTrophies?.counts.gold ?? 0) + (myTrophies?.counts.silver ?? 0) + (myTrophies?.counts.bronze ?? 0)} medals`}
            </span>
          </header>
          <TrophyCabinet data={myTrophies ?? null} emptyOwn />
        </section>

        <section className="fade-up d2" style={{ marginTop: 56 }}>
          <header className="section-head">
            <h2 className="h-section">Your receipts.</h2>
            <span className="eyebrow">
              {myReceipts === undefined
                ? "Loading…"
                : `${myReceipts?.items.length ?? 0}${
                    (myReceipts?.items.length ?? 0) >= 60 ? "+" : ""
                  } verified`}
            </span>
          </header>
          {myReceipts === undefined ? (
            <p className="muted-line">Loading…</p>
          ) : myReceipts === null ? (
            <p className="muted-line">Sign in to view your receipts.</p>
          ) : (
            <ProfileGrid
              items={myReceipts.items as ProfileGridItem[]}
              onOpenProof={(url) => setLightboxUrl(url)}
              emptyTitle="Nothing yet"
              emptyLine="Verify a task and your receipt lands here."
            />
          )}
        </section>

        <section className="fade-up d3" style={{ marginTop: 56 }}>
          <header className="section-head">
            <h2 className="h-section">Your groups.</h2>
            <span className="eyebrow">
              {groups ? `${groups.length} active` : "Loading…"}
            </span>
          </header>
          {groups === undefined ? (
            <p className="muted-line">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="muted-line">
              No groups yet.{" "}
              <Link href="/groups" className="btn-link">
                Create or join one →
              </Link>
            </p>
          ) : (
            <ul className="profile-groups">
              {groups.map((g) => (
                <li key={g._id} className="profile-group-row">
                  <div>
                    <span className="profile-group-name">{g.name}</span>
                    <span className="profile-group-role">
                      {g.isAdmin ? "Admin" : "Member"}
                    </span>
                  </div>
                  <div className="profile-group-actions">
                    <Link href={`/group/${g._id}`} className="btn-link">
                      Open →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="muted-line" style={{ marginTop: 16 }}>
            Create or join groups in{" "}
            <Link href="/groups" className="btn-link">
              Groups
            </Link>
            .
          </p>
        </section>
      </main>

      <ProofLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      <Toast value={toast} onDismiss={() => setToast(null)} />
      <BottomNav />
    </div>
  );
}
