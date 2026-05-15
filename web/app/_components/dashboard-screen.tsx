"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { mainGoalLabel } from "@/lib/types";
import { firstName } from "@/lib/utils";

export function DashboardScreen() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const upsertFromAuth = useMutation(api.profiles.upsertCurrentProfileFromAuth);
  const [toast, setToast] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (profile === undefined) return;
    if (profile === null) {
      void upsertFromAuth({});
      return;
    }
    if (!profile.onboardingCompleted) {
      router.replace("/onboarding");
    }
  }, [authLoading, isAuthenticated, profile, upsertFromAuth, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const onLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/");
    } catch {
      setSigningOut(false);
    }
  };

  if (authLoading || profile === undefined || profile === null || !profile.onboardingCompleted) {
    return (
      <div className="entry">
        <div className="entry-mid" style={{ textAlign: "center" }}>
          <p className="eyebrow">Loading…</p>
        </div>
      </div>
    );
  }

  const hello = firstName(profile.displayName);

  return (
    <div className="page-wrap">
      <header className="page-wrap-bar">
        <span className="entry-brand">
          Receipts<span className="v">v0.1</span>
        </span>
        <div className="user-chip">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              width={28}
              height={28}
              className="avatar"
            />
          ) : (
            <span className="avatar avatar-fallback">
              {hello.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="user-chip-name">{profile.displayName}</span>
          <button
            className="btn-link"
            onClick={onLogout}
            disabled={signingOut}
          >
            {signingOut ? "Out…" : "Log out"}
          </button>
        </div>
      </header>

      <main className="page">
        <div className="page-head fade-up">
          <div>
            <span className="eyebrow">
              <b>Welcome to Receipts</b>
            </span>
            <h1 className="h-page" style={{ marginTop: 8 }}>
              {hello}<span className="roman">.</span>
            </h1>
            <p className="entry-dek" style={{ marginTop: 14, maxWidth: 520 }}>
              You&apos;re in. Spin up a squad to start logging receipts, or jump
              into one with an invite code.
            </p>
          </div>
        </div>

        <section className="cta-row fade-up d1">
          <button
            className="btn-primary"
            onClick={() => setToast("Squad creation lands next")}
          >
            Create Squad
            <span className="arrow">→</span>
          </button>
          <button
            className="btn-ghost"
            onClick={() => setToast("Squad join lands next")}
          >
            Join Squad
          </button>
        </section>

        <section className="fade-up d2" style={{ marginTop: 56 }}>
          <header className="section-head">
            <h2 className="h-section">Your profile.</h2>
            <span className="eyebrow">Pulled from Google</span>
          </header>

          <dl className="profile-list">
            <ProfileRow label="Display name" value={profile.displayName} />
            <ProfileRow
              label="Username"
              value={profile.username ? `@${profile.username}` : "—"}
              muted={!profile.username}
            />
            <ProfileRow label="Email" value={profile.email} />
            <ProfileRow
              label="Main goal"
              value={mainGoalLabel(profile.mainGoal)}
              muted={!profile.mainGoal}
            />
          </dl>
        </section>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function ProfileRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="profile-row">
      <dt className="eyebrow">{label}</dt>
      <dd className={`profile-row-v ${muted ? "muted" : ""}`}>{value}</dd>
    </div>
  );
}
