"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "./toast";
import { BottomNav } from "./bottom-nav";
import { CreateOrJoinGroups } from "./group-actions";
import { AppHeader } from "./app-header";

type Member = { displayName: string; avatarUrl?: string };
type PendingInvite = {
  _id: Id<"groupInvites">;
  groupId: Id<"groups">;
  groupName: string;
  invitedByName: string;
  invitedByAvatarUrl?: string;
  createdAt: number;
  groupExists: boolean;
};

export function GroupsScreen() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const home = useQuery(api.groups.homeView);
  const pendingInvites = useQuery(api.groups.pendingInvites);
  const upsertFromAuth = useMutation(api.profiles.upsertCurrentProfileFromAuth);
  const respondToInvite = useMutation(api.groups.respondToInvite);
  const [toast, setToast] = useState<ToastValue>(null);
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);

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

  const onInviteResponse = async (
    inviteId: Id<"groupInvites">,
    response: "ACCEPT" | "DECLINE",
  ) => {
    if (inviteBusy) return;
    setInviteBusy(String(inviteId));
    try {
      const result = await respondToInvite({ inviteId, response });
      if (!result.ok) {
        setToast({ message: result.error, tone: "error" });
        return;
      }
      if (result.state === "accepted") {
        setToast({ message: "Invite accepted", tone: "success" });
      } else {
        setToast({ message: "Invite declined", tone: "neutral" });
      }
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    } finally {
      setInviteBusy(null);
    }
  };

  return (
    <div className="page-wrap page-home has-bottom-nav">
      <AppHeader profile={profile} />

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

        {pendingInvites && pendingInvites.length > 0 && (
          <PendingInvites
            invites={pendingInvites}
            busyId={inviteBusy}
            onRespond={onInviteResponse}
          />
        )}

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

function PendingInvites({
  invites,
  busyId,
  onRespond,
}: {
  invites: PendingInvite[];
  busyId: string | null;
  onRespond: (
    inviteId: Id<"groupInvites">,
    response: "ACCEPT" | "DECLINE",
  ) => void;
}) {
  return (
    <section className="pending-invites fade-up d2">
      <header className="section-head">
        <h2 className="h-section">Invites.</h2>
        <span className="eyebrow">{invites.length} pending</span>
      </header>
      <ul className="pending-invite-list">
        {invites.map((invite) => {
          const busy = busyId === String(invite._id);
          return (
            <li key={invite._id} className="pending-invite-row">
              <div className="pending-invite-main">
                {invite.invitedByAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={invite.invitedByAvatarUrl}
                    alt=""
                    width={34}
                    height={34}
                    className="avatar"
                  />
                ) : (
                  <span className="avatar avatar-fallback">
                    {invite.invitedByName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <p className="pending-invite-title">
                    {invite.invitedByName} invited you to {invite.groupName}
                  </p>
                  <p className="pending-invite-meta mono">
                    {new Date(invite.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="pending-invite-actions">
                <button
                  className="btn-primary btn-ghost-sm"
                  disabled={busy || !invite.groupExists}
                  onClick={() => onRespond(invite._id, "ACCEPT")}
                >
                  {busy ? "Working…" : "Accept"}
                </button>
                <button
                  className="btn-ghost btn-ghost-sm"
                  disabled={busy}
                  onClick={() => onRespond(invite._id, "DECLINE")}
                >
                  Decline
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
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
