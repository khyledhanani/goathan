"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Toast, type ToastValue } from "./toast";
import { BottomNav } from "./bottom-nav";
import { UserMenu } from "./user-menu";
import { CreateOrJoinGroups } from "./group-actions";

type Member = { displayName: string; avatarUrl?: string };

export function GroupsScreen() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const home = useQuery(api.groups.homeView);
  const upsertFromAuth = useMutation(api.profiles.upsertCurrentProfileFromAuth);
  const [toast, setToast] = useState<ToastValue>(null);

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

  return (
    <div className="page-wrap page-home has-bottom-nav">
      <header className="page-wrap-bar">
        <Link href="/dashboard" className="entry-brand">
          Receipts<span className="v">v0.1</span>
        </Link>
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

        <div className="fade-up d1" style={{ marginBottom: 32 }}>
          <CreateOrJoinGroups
            onSuccess={(msg) => setToast({ message: msg, tone: "success" })}
            onError={(msg) => setToast({ message: msg, tone: "error" })}
          />
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
                      {g.stakeText && (
                        <GroupStake
                          kind={g.stakeKind ?? "PENALTY"}
                          text={g.stakeText}
                        />
                      )}
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

                  {g.stats.taskCount === 0 && (
                    <p className="muted-line" style={{ padding: "16px 0 0" }}>
                      No tasks yet in this group.
                    </p>
                  )}
                </article>
              ))}
            </div>
          )
        )}
      </main>

      <Toast value={toast} onDismiss={() => setToast(null)} />
      <BottomNav />
    </div>
  );
}

function GroupStake({
  kind,
  text,
}: {
  kind: "PENALTY" | "REWARD";
  text: string;
}) {
  const isReward = kind === "REWARD";
  const label = isReward ? "Reward" : "Penalty";
  return (
    <span
      className={`group-stake-badge ${kind.toLowerCase()}`}
      aria-label={`${label}: ${text}`}
    >
      <span className="stake-icon" aria-hidden>{isReward ? "🏆" : "⚡"}</span>
      <span className="stake-label">{label}</span>
      <span className="stake-text">{text}</span>
    </span>
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
          Create a group or join one with a code above. Your groups will appear
          here once you&apos;re in.
        </p>
      </div>
    </div>
  );
}
