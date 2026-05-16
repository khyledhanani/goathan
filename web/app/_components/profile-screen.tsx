"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { mainGoalLabel } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "./toast";
import { ConfirmDialog } from "./confirm-dialog";

export function ProfileScreen() {
  const router = useRouter();
  const { isLoading: authLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const groups = useQuery(api.groups.getMyGroups);
  const leaveGroup = useMutation(api.groups.leave);

  const [toast, setToast] = useState<ToastValue>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<{
    id: string;
    name: string;
    isAdmin: boolean;
  } | null>(null);

  const onLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/");
    } catch {
      setSigningOut(false);
    }
  };

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
    <div className="page-wrap">
      <header className="page-wrap-bar">
        <div className="topbar-left">
          <Link href="/dashboard" className="entry-brand">
            Receipts<span className="v">v0.1</span>
          </Link>
          <Link href="/dashboard" className="btn-link">
            ← Home
          </Link>
        </div>
        <button className="btn-link" onClick={onLogout} disabled={signingOut}>
          {signingOut ? "Out…" : "Log out"}
        </button>
      </header>

      <main className="page">
        <div className="page-head fade-up">
          <div>
            <span className="eyebrow">Account</span>
            <h1 className="h-page" style={{ marginTop: 8 }}>
              Profile<span className="roman">.</span>
            </h1>
          </div>
        </div>

        <section className="fade-up d1">
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

        <section className="fade-up d2" style={{ marginTop: 56 }}>
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

        <section className="fade-up d3" style={{ marginTop: 56 }}>
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
  const [busy, setBusy] = useState(false);

  const createGroup = useMutation(api.groups.create);
  const joinByCode = useMutation(api.groups.joinByCode);

  const canCreate = name.trim().length > 0 && !busy;
  const canJoin = /^[A-Z0-9]{6}$/.test(code) && !busy;

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "create") {
        if (!canCreate) return;
        const result = await createGroup({ name: name.trim() });
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
