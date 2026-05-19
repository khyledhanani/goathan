"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { mainGoalLabel } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import {
  GROUP_STARTER_PACKS,
  tasksForStarterPack,
} from "@/lib/task-templates";
import { Toast, type ToastValue } from "./toast";
import { ConfirmDialog } from "./confirm-dialog";
import { BottomNav } from "./bottom-nav";
import { UserMenu } from "./user-menu";
import { NotificationSettings } from "./notification-settings";
import { ThemeToggle } from "./theme-toggle";

export function SettingsScreen() {
  const router = useRouter();
  const { isLoading: authLoading } = useConvexAuth();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const groups = useQuery(api.groups.getMyGroups);
  const leaveGroup = useMutation(api.groups.leave);

  const [toast, setToast] = useState<ToastValue>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<{
    id: string;
    name: string;
    isAdmin: boolean;
  } | null>(null);

  const onLeaveClick = (groupId: string, name: string, isAdmin: boolean) => {
    setLeaveTarget({ id: groupId, name, isAdmin });
  };

  const confirmLeave = async () => {
    if (!leaveTarget) return;
    const { id, name } = leaveTarget;
    setLeavingId(id);
    try {
      const result = await leaveGroup({
        groupId: id as Parameters<typeof leaveGroup>[0]["groupId"],
      });
      setToast({
        message:
          result.state === "deleted"
            ? `${name} was deleted`
            : `You left ${name}`,
        tone: "neutral",
      });
      setLeaveTarget(null);
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    } finally {
      setLeavingId(null);
    }
  };

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
          <Link href="/profile" className="btn-link">
            ← Profile
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
            <h1 className="h-page h-page-serif" style={{ marginTop: 8 }}>
              Settings<span className="roman">.</span>
            </h1>
          </div>
        </div>

        <section className="fade-up d1">
          <header className="section-head">
            <h2 className="h-section">Appearance.</h2>
            <span className="eyebrow">Theme</span>
          </header>
          <ThemeToggle />
        </section>

        <section className="fade-up d2" style={{ marginTop: 56 }}>
          <header className="section-head">
            <h2 className="h-section">Notifications.</h2>
            <span className="eyebrow">Push + inbox</span>
          </header>
          <NotificationSettings
            onToast={(message, tone) =>
              setToast({ message, tone: tone ?? "neutral" })
            }
          />
        </section>

        <section className="fade-up d3" style={{ marginTop: 56 }}>
          <header className="section-head">
            <h2 className="h-section">Your details.</h2>
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

        <section className="fade-up d4" style={{ marginTop: 56 }}>
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
              No groups yet. Create one or join with a code below.
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
                    <button
                      className="btn-link btn-link-danger"
                      onClick={() => onLeaveClick(g._id, g.name, g.isAdmin)}
                      disabled={leavingId === g._id}
                    >
                      Leave
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="fade-up d5" style={{ marginTop: 56 }}>
          <header className="section-head">
            <h2 className="h-section">Manage groups.</h2>
            <span className="eyebrow">Create or join</span>
          </header>
          <GroupActions
            onSuccess={(msg) => setToast({ message: msg, tone: "success" })}
            onError={(msg) => setToast({ message: msg, tone: "error" })}
          />
        </section>
      </main>

      <ConfirmDialog
        open={leaveTarget !== null}
        title={leaveTarget ? `Leave ${leaveTarget.name}?` : ""}
        body={
          leaveTarget && (
            <>
              <p>
                You&apos;ll lose your standings in this group and your
                completions will be removed.
              </p>
              {leaveTarget.isAdmin && (
                <p className="confirm-note">
                  You&apos;re admin. If anyone else is in the group, admin
                  passes to the longest-tenured member. If you&apos;re alone,
                  the group is deleted permanently.
                </p>
              )}
            </>
          )
        }
        confirmLabel={leaveTarget?.isAdmin ? "Leave anyway" : "Leave group"}
        danger
        busy={leavingId !== null}
        onCancel={() => setLeaveTarget(null)}
        onConfirm={confirmLeave}
      />

      <Toast value={toast} onDismiss={() => setToast(null)} />
      <BottomNav />
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

function GroupActions({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [starterPackId, setStarterPackId] = useState("the-cut");
  const [busy, setBusy] = useState(false);

  const createGroup = useMutation(api.groups.create);
  const joinByCode = useMutation(api.groups.joinByCode);

  const starterPack =
    GROUP_STARTER_PACKS.find((pack) => pack.id === starterPackId) ??
    GROUP_STARTER_PACKS[0];
  const starterTasks = tasksForStarterPack(starterPack);

  const canCreate = name.trim().length > 0 && !busy;
  const canJoin = /^[A-Z0-9]{6}$/.test(code) && !busy;

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "create") {
        if (!canCreate) return;
        const result = await createGroup({
          name: name.trim(),
          tasks: starterTasks,
        });
        if (!result.ok) {
          onError(result.error);
          return;
        }
        onSuccess(`Created ${name.trim()}`);
        setName("");
      } else {
        if (!canJoin) return;
        const result = await joinByCode({ inviteCode: code });
        if (!result.ok) {
          onError(result.error);
          return;
        }
        onSuccess("You're in the group");
        setCode("");
      }
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group-actions">
      <div className="seg">
        <button
          className={mode === "create" ? "active" : ""}
          onClick={() => setMode("create")}
        >
          Create a group
        </button>
        <span className="seg-dot">/</span>
        <button
          className={mode === "join" ? "active" : ""}
          onClick={() => setMode("join")}
        >
          Join with code
        </button>
      </div>

      {mode === "create" ? (
        <div className="group-create-flow">
          <label className="field">
            <span className="field-label">
              <span>Group name</span>
              <span className="hint">You&apos;ll be admin</span>
            </span>
            <input
              className="field-input"
              placeholder="The Sunday Crew"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) void submit();
              }}
            />
          </label>

          <div className="field">
            <span className="field-label">
              <span>Starter pack</span>
              <span className="hint">Can add/remove later</span>
            </span>
            <div className="starter-pack-grid">
              {GROUP_STARTER_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  className={`starter-pack-card ${
                    starterPackId === pack.id ? "active" : ""
                  }`}
                  onClick={() => setStarterPackId(pack.id)}
                >
                  <span className="starter-pack-name">{pack.label}</span>
                  <span className="starter-pack-blurb">{pack.blurb}</span>
                  <span className="starter-pack-count mono">
                    {pack.taskIds.length === 0
                      ? "No starter tasks"
                      : `${pack.taskIds.length} tasks`}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="starter-preview">
            <span className="field-label">
              <span>Starting slate</span>
              <span className="hint">
                {starterTasks.length === 0
                  ? "Blank"
                  : `${starterTasks.length} tasks`}
              </span>
            </span>
            {starterTasks.length === 0 ? (
              <p className="starter-preview-empty">
                Start with no tasks and add your own once the group is created.
              </p>
            ) : (
              <ul className="starter-task-list">
                {starterTasks.map((task) => (
                  <li
                    key={`${task.name}:${task.frequency}`}
                    className="starter-task-row"
                  >
                    <span className="starter-task-name">{task.name}</span>
                    <span className="starter-task-meta mono">
                      {task.category} · {task.frequency} · {task.points} pts
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <label className="field">
          <span className="field-label">
            <span>Invite code</span>
            <span className="hint">6 characters</span>
          </span>
          <input
            className="field-input mono-input"
            placeholder="ABC123"
            value={code}
            maxLength={6}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && canJoin) void submit();
            }}
          />
        </label>
      )}

      <div style={{ marginTop: 22 }}>
        <button
          className="btn-primary"
          disabled={mode === "create" ? !canCreate : !canJoin}
          onClick={submit}
        >
          {mode === "create"
            ? busy
              ? "Creating…"
              : "Create group"
            : busy
              ? "Joining…"
              : "Join group"}
          <span className="arrow">→</span>
        </button>
      </div>
    </div>
  );
}
