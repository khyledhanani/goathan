"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { normalizeProofMedia } from "@/lib/upload";
import { Toast, type ToastValue } from "./toast";
import { TodaySlate } from "./today-slate";
import { AddTaskModal } from "./add-task-modal";
import { ConfirmDialog } from "./confirm-dialog";
import { StandingsTable } from "./standings-table";
import { ActivityFeed } from "./activity-feed";
import { ProofLightbox } from "./proof-lightbox";
import { DayResetCountdown, CompResetCountdown } from "./countdown";
import { BottomNav } from "./bottom-nav";
import { InviteModal } from "./invite-modal";
import { UserMenu } from "./user-menu";
import { GroupEditModal } from "./group-actions";

export function GroupPage({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();

  const profile = useQuery(api.profiles.getCurrentProfile);
  const view = useQuery(api.groups.todayView, {
    groupId: groupId as Id<"groups">,
  });
  const standings = useQuery(api.groups.weeklyStandings, {
    groupId: groupId as Id<"groups">,
  });
  const activity = useQuery(api.groups.recentActivity, {
    groupId: groupId as Id<"groups">,
  });
  const claim = useMutation(api.completions.claim);
  const unclaim = useMutation(api.completions.unclaim);
  const generateProofUploadUrl = useMutation(
    api.completions.generateProofUploadUrl,
  );
  const attachProof = useMutation(api.completions.attachProof);
  const createTask = useMutation(api.tasks.create);
  const removeTaskMutation = useMutation(api.tasks.remove);
  const toggleChallenge = useMutation(api.challenges.toggle);
  const addComment = useMutation(api.comments.add);

  const [toast, setToast] = useState<ToastValue>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{
    taskId: Id<"tasks">;
    name: string;
  } | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    if (view === null) {
      router.replace("/dashboard");
    }
  }, [authLoading, isAuthenticated, view, router]);

  if (authLoading || profile === undefined || view === undefined) {
    return (
      <div className="entry">
        <div className="entry-mid" style={{ textAlign: "center" }}>
          <p className="eyebrow">Loading…</p>
        </div>
      </div>
    );
  }

  if (!profile || view === null) {
    return null;
  }

  const { group, slate, stats, isAdmin } = view;

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const onClaim = async (taskId: Id<"tasks">) => {
    try {
      const result = await claim({ taskId });
      if (!result.ok) {
        setToast({ message: result.error, tone: "error" });
        return;
      }
      setToast({ message: "Claimed · upload proof within 15m", tone: "neutral" });
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
      const { body, contentType, meta } = await normalizeProofMedia(file);
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
      const attached = await attachProof({
        completionId,
        storageId,
        proofMeta: meta,
      });
      if (!attached.ok) {
        setToast({ message: attached.error, tone: "error" });
        return;
      }
      setToast({ message: "Verified", tone: "success" });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  const onCallCap = async (completionId: Id<"completions">) => {
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

  const askRemoveTask = (taskId: Id<"tasks">, name: string) => {
    setRemoveTarget({ taskId, name });
  };

  const confirmRemoveTask = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const result = await removeTaskMutation({ taskId: removeTarget.taskId });
      if (!result.ok) {
        setToast({ message: result.error, tone: "error" });
        return;
      }
      setToast({
        message: `Removed ${removeTarget.name}`,
        tone: "neutral",
      });
      setRemoveTarget(null);
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="page-wrap page-group has-bottom-nav">
      <header className="page-wrap-bar">
        <div className="topbar-left">
          <Link href="/dashboard" className="entry-brand">
            Receipts<span className="v">v0.1</span>
          </Link>
          <Link href="/dashboard" className="btn-link">
            ← Home
          </Link>
          <span className="topbar-context">{group.name}</span>
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
        <div className="page-head fade-up page-head-group">
          <div>
            <span className="eyebrow">
              {(() => {
                const d = stats.durationDays;
                const startDate = new Date(stats.periodEndMs - d * 86400000);
                const fmt = (dt: Date) =>
                  dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                if (stats.cadence === "monthly") {
                  return `month of ${startDate.toLocaleDateString("en-US", { month: "long" })}`;
                }
                if (d === 1) return "today";
                if (d === 7) return `week of ${fmt(startDate)}`;
                return `${d}-day comp · ${fmt(startDate)}`;
              })()}
              {" · "}{dateLabel}
            </span>
            <h1 className="h-page h-page-serif" style={{ marginTop: 8 }}>
              {group.name}<span className="roman">.</span>
            </h1>
            <p className="entry-dek" style={{ marginTop: 14, maxWidth: 560 }}>
              <span className="num">{stats.todayPoints}</span> pts today ·{" "}
              <span className="num">{stats.weekPoints}</span> this week ·{" "}
              <span className="num">{stats.todayDone}</span>/
              <span className="num">{stats.totalDailyTasks}</span> done
            </p>
            {group.stakeText && (
              <GroupStake
                kind={group.stakeKind ?? "PENALTY"}
                text={group.stakeText}
              />
            )}
            <p className="hero-countdown">
              <DayResetCountdown />
              <span className="hero-countdown-sep" aria-hidden> · </span>
              <CompResetCountdown periodEndMs={stats.periodEndMs} />
            </p>
          </div>
          <div className="group-hero-actions">
            {isAdmin && (
              <button className="btn-ghost" onClick={() => setEditing(true)}>
                Edit<span className="arrow">→</span>
              </button>
            )}
            <button
              className="btn-ghost hero-invite-btn"
              onClick={() => setInviteOpen(true)}
            >
              Invite<span className="arrow">→</span>
            </button>
          </div>
        </div>

        <section className="fade-up d1">
          <header className="section-head">
            <h2 className="h-section">Today&apos;s slate.</h2>
            <span className="eyebrow">
              {slate.filter((t) => t.frequency === "DAILY").length} daily ·{" "}
              {slate.filter((t) => t.frequency === "WEEKLY").length} weekly
            </span>
          </header>

          <TodaySlate
            slate={slate}
            onClaim={onClaim}
            onUnclaim={onUnclaim}
            onUpload={onUpload}
            onOpenProof={(url) => setLightboxUrl(url)}
            onRemoveTask={isAdmin ? askRemoveTask : undefined}
          />

          {isAdmin && (
            <button
              className="btn-ghost"
              style={{ marginTop: 20 }}
              onClick={() => setAdding(true)}
            >
              + Add task
            </button>
          )}
        </section>

        <section className="fade-up d2" style={{ marginTop: 56 }}>
          <header className="section-head">
            <h2 className="h-section">Standings.</h2>
            <span className="eyebrow">This week</span>
          </header>
          {standings === undefined ? (
            <p className="muted-line">Loading…</p>
          ) : standings === null ? (
            <p className="muted-line">Standings unavailable.</p>
          ) : (
            <StandingsTable rows={standings} />
          )}
        </section>

        <section className="fade-up d3" style={{ marginTop: 56 }}>
          <header className="section-head">
            <h2 className="h-section">On the board.</h2>
            <span className="eyebrow">Live · last {activity?.length ?? 0}</span>
          </header>
          {activity === undefined ? (
            <p className="muted-line">Loading…</p>
          ) : (
            <ActivityFeed
              items={activity}
              onCallCap={onCallCap}
              onComment={onComment}
              onOpenProof={(url) => setLightboxUrl(url)}
            />
          )}
        </section>

      </main>

      {adding && (
        <AddTaskModal
          onClose={() => setAdding(false)}
          onSubmit={async (input) => {
            const result = await createTask({
              groupId: group._id,
              ...input,
            });
            if (!result.ok) return result.error;
            setToast({ message: "Task added", tone: "success" });
            setAdding(false);
            return null;
          }}
        />
      )}

      {editing && (
        <GroupEditModal
          groupId={group._id}
          initialName={group.name}
          initialAnchorDate={group.anchorDate}
          initialAnchorDayOfMonth={group.anchorDayOfMonth}
          initialDurationDays={group.durationDays}
          initialRepeat={group.repeat}
          initialCadence={group.cadence}
          initialStakeKind={group.stakeKind}
          initialStakeText={group.stakeText}
          onClose={() => setEditing(false)}
          onSaved={(msg) => setToast({ message: msg, tone: "success" })}
        />
      )}

      <ProofLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      <ConfirmDialog
        open={removeTarget !== null}
        title={removeTarget ? `Remove ${removeTarget.name}?` : ""}
        body={
          <p>
            This deletes the task and all its history (completions, proof
            photos, comments, caps) from this group. Members will no longer see
            it on their slate.
          </p>
        }
        confirmLabel="Remove task"
        danger
        busy={removing}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={confirmRemoveTask}
      />
      <InviteModal
        open={inviteOpen}
        inviteCode={group.inviteCode}
        groupName={group.name}
        onClose={() => setInviteOpen(false)}
        onToast={(msg) => setToast({ message: msg, tone: "neutral" })}
      />
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
