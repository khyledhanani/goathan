"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { firstName } from "@/lib/utils";
import { errorMessage } from "@/lib/errors";
import { normalizeProofMedia } from "@/lib/upload";
import { Toast, type ToastValue } from "./toast";
import { TodaySlate } from "./today-slate";
import { ProofLightbox } from "./proof-lightbox";
import { BottomNav } from "./bottom-nav";

type Member = { displayName: string; avatarUrl?: string };

export function GroupsScreen() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const home = useQuery(api.groups.homeView);
  const upsertFromAuth = useMutation(api.profiles.upsertCurrentProfileFromAuth);
  const claim = useMutation(api.completions.claim);
  const unclaim = useMutation(api.completions.unclaim);
  const generateProofUploadUrl = useMutation(
    api.completions.generateProofUploadUrl,
  );
  const attachProof = useMutation(api.completions.attachProof);
  const [toast, setToast] = useState<ToastValue>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const onLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/");
    } catch {
      setSigningOut(false);
    }
  };

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
    }
  }, [authLoading, isAuthenticated, profile, upsertFromAuth, router]);

  const onClaim = async (taskId: Id<"tasks">) => {
    try {
      const result = await claim({ taskId });
      if (!result.ok) {
        setToast({ message: result.error, tone: "error" });
        return;
      }
      setToast({
        message: "Claimed · upload proof within 15m",
        tone: "neutral",
      });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  const onUnclaim = async (completionId: Id<"completions">) => {
    try {
      await unclaim({ completionId });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  const onUpload = async (completionId: Id<"completions">, file: File) => {
    try {
      const urlResult = await generateProofUploadUrl({ completionId });
      if (!urlResult.ok) {
        setToast({ message: urlResult.error, tone: "error" });
        return;
      }
      const { body, contentType } = await normalizeProofMedia(file);
      const res = await fetch(urlResult.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      });
      if (!res.ok) {
        setToast({ message: "Upload failed, try again", tone: "error" });
        return;
      }
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const attached = await attachProof({ completionId, storageId });
      if (!attached.ok) {
        setToast({ message: attached.error, tone: "error" });
        return;
      }
      setToast({ message: "Verified", tone: "success" });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

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

  return (
    <div className="page-wrap page-home has-bottom-nav">
      <header className="page-wrap-bar">
        <Link href="/dashboard" className="entry-brand">
          Receipts<span className="v">v0.1</span>
        </Link>
        <div className="topbar-right">
          <Link href="/profile" className="user-chip user-chip-link">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
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
          </Link>
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
            <span className="eyebrow">Where the work happens</span>
            <h1 className="h-page h-page-serif" style={{ marginTop: 8 }}>
              Groups<span className="roman">.</span>
            </h1>
            <p className="entry-dek" style={{ marginTop: 14, maxWidth: 560 }}>
              <span className="num">{home?.totals.weekPoints ?? 0}</span> pts
              this week ·{" "}
              <span className="num">{home?.totals.todayDone ?? 0}</span>/
              <span className="num">
                {home?.totals.totalDailyTasks ?? 0}
              </span>{" "}
              done today
            </p>
          </div>
        </div>

        {home && home.groups.length === 0 ? (
          <EmptyHome />
        ) : (
          home && (
            <div className="home-groups">
              {home.groups.map((g, idx) => (
                <article
                  key={g._id}
                  className={`home-card fade-up ${g.isLeading ? "leading" : ""}`}
                  style={{ animationDelay: `${60 + idx * 80}ms` }}
                >
                  <header className="home-card-head">
                    <div className="home-card-head-meta">
                      <span className="eyebrow">
                        {g.isAdmin ? "admin · you" : "member"} ·{" "}
                        {g.memberCount}{" "}
                        {g.memberCount === 1 ? "person" : "people"}
                      </span>
                      <h2 className="home-card-name">{g.name}</h2>
                      <AvatarStack members={g.memberAvatars} />
                    </div>
                    <Link
                      href={`/group/${g._id}`}
                      className="btn-primary home-card-enter"
                    >
                      Enter group
                      <span className="arrow">→</span>
                    </Link>
                  </header>

                  <div className="home-card-scoreboard">
                    <ScoreCell
                      value={`#${g.rank}`}
                      label={`of ${g.memberCount}`}
                      accent={g.isLeading}
                    />
                    <ScoreCell
                      value={g.isLeading ? "—" : `${g.gapToLeader}`}
                      label={
                        g.isLeading
                          ? "On top"
                          : g.leaderFirstName
                            ? `Behind ${g.leaderFirstName}`
                            : "Behind"
                      }
                      accent={g.isLeading}
                    />
                    <ScoreCell
                      value={`${g.stats.todayDone}/${g.stats.totalDailyTasks}`}
                      label="Today"
                    />
                    <ScoreCell
                      value={`${g.stats.weekPoints}`}
                      label="Week pts"
                    />
                  </div>

                  {g.slate.length === 0 ? (
                    <p className="muted-line" style={{ padding: "16px 0 0" }}>
                      No tasks yet in this group.
                    </p>
                  ) : (
                    <TodaySlate
                      slate={g.slate}
                      onClaim={onClaim}
                      onUnclaim={onUnclaim}
                      onUpload={onUpload}
                      onOpenProof={(url) => setLightboxUrl(url)}
                    />
                  )}
                </article>
              ))}
            </div>
          )
        )}
      </main>

      <ProofLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      <Toast value={toast} onDismiss={() => setToast(null)} />
      <BottomNav />
    </div>
  );
}

function ScoreCell({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className={`score-cell ${accent ? "accent" : ""}`}>
      <span className="score-cell-value num">{value}</span>
      <span className="score-cell-label">{label}</span>
    </div>
  );
}

function AvatarStack({ members }: { members: Member[] }) {
  if (members.length === 0) return null;
  return (
    <div className="avatar-stack">
      {members.map((m, i) => (
        <span key={i} className="avatar-stack-item" title={m.displayName}>
          {m.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.avatarUrl}
              alt=""
              width={28}
              height={28}
              className="avatar"
            />
          ) : (
            <span className="avatar avatar-fallback">
              {m.displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function EmptyHome() {
  return (
    <div className="page-head fade-up">
      <div>
        <span className="eyebrow">No squad yet</span>
        <h1 className="h-page" style={{ marginTop: 8 }}>
          Start one<span className="roman">.</span>
        </h1>
        <p className="entry-dek" style={{ marginTop: 14, maxWidth: 520 }}>
          Head to your profile to create a group or join one with a code.
        </p>
        <div style={{ marginTop: 22 }}>
          <Link href="/profile" className="btn-primary">
            Go to profile
            <span className="arrow">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
