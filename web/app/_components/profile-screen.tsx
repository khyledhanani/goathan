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

export function ProfileScreen() {
  const router = useRouter();
  const { isLoading: authLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const groups = useQuery(api.groups.getMyGroups);

  const [toast, setToast] = useState<ToastValue>(null);
  const [signingOut, setSigningOut] = useState(false);

  const onLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/");
    } catch {
      setSigningOut(false);
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
        <Link href="/dashboard" className="entry-brand">
          Receipts<span className="v">v0.1</span>
        </Link>
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
                  <Link href={`/group/${g._id}`} className="btn-link">
                    Open →
                  </Link>
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
