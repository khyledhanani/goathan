"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { mainGoalLabel } from "@/lib/types";
import { firstName } from "@/lib/utils";

type GroupSummary = {
  _id: Id<"groups">;
  name: string;
  inviteCode: string;
  isAdmin: boolean;
  createdAt: number;
  joinedAt: number;
};

export function DashboardScreen() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const groups = useQuery(api.groups.getMyGroups);
  const upsertFromAuth = useMutation(api.profiles.upsertCurrentProfileFromAuth);
  const [toast, setToast] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (profile === undefined) return;
    if (profile === null || !profile.email || !profile.avatarUrl) {
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
  const hasGroups = (groups?.length ?? 0) > 0;

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
          <button className="btn-link" onClick={onLogout} disabled={signingOut}>
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
            <p className="entry-dek" style={{ marginTop: 14, maxWidth: 560 }}>
              {hasGroups
                ? "Your groups are below. Spin up another or jump into one with an invite code."
                : "You're in. Spin up a group with friends, or jump into one with an invite code."}
            </p>
          </div>
        </div>

        <section className="fade-up d1">
          <GroupActions
            onCreate={() => setToast("Group created")}
            onJoin={(name) => setToast(`Joined ${name}`)}
            onError={(msg) => setToast(msg)}
          />
        </section>

        {groups === undefined ? null : groups.length > 0 ? (
          <section className="fade-up d2" style={{ marginTop: 56 }}>
            <header className="section-head">
              <h2 className="h-section">Your groups.</h2>
              <span className="eyebrow">
                {groups.length} {groups.length === 1 ? "group" : "groups"}
              </span>
            </header>
            <div className="group-stack">
              {groups.map((g) => (
                <GroupCard
                  key={g._id}
                  group={g}
                  onCopy={() => {
                    navigator.clipboard?.writeText(g.inviteCode).catch(() => {});
                    setToast("Invite code copied");
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="fade-up d3" style={{ marginTop: 56 }}>
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

function GroupActions({
  onCreate,
  onJoin,
  onError,
}: {
  onCreate: (name: string) => void;
  onJoin: (groupName: string) => void;
  onError: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGroup = useMutation(api.groups.create);
  const joinByCode = useMutation(api.groups.joinByCode);

  const canCreate = name.trim().length > 0 && !busy;
  const canJoin = /^[A-Z0-9]{6}$/.test(code) && !busy;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "create") {
        if (!canCreate) return;
        await createGroup({ name: name.trim() });
        onCreate(name.trim());
        setName("");
      } else {
        if (!canJoin) return;
        await joinByCode({ inviteCode: code });
        onJoin(code);
        setCode("");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      onError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group-actions">
      <div className="seg">
        <button
          className={mode === "create" ? "active" : ""}
          onClick={() => {
            setMode("create");
            setError(null);
          }}
        >
          Create a group
        </button>
        <span className="seg-dot">/</span>
        <button
          className={mode === "join" ? "active" : ""}
          onClick={() => {
            setMode("join");
            setError(null);
          }}
        >
          Join with code
        </button>
      </div>

      {mode === "create" ? (
        <label className="field">
          <span className="field-label">
            <span>Group name</span>
            <span className="hint">You'll be admin</span>
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
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canJoin) void submit();
            }}
          />
        </label>
      )}

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <div style={{ marginTop: 22 }}>
        <button
          className="btn-primary"
          disabled={mode === "create" ? !canCreate : !canJoin}
          onClick={submit}
        >
          {mode === "create"
            ? busy ? "Creating…" : "Create group"
            : busy ? "Joining…" : "Join group"}
          <span className="arrow">→</span>
        </button>
      </div>
    </div>
  );
}

function GroupCard({
  group,
  onCopy,
}: {
  group: GroupSummary;
  onCopy: () => void;
}) {
  const roster = useQuery(api.groups.getRoster, { groupId: group._id });

  return (
    <article className="group-card">
      <header className="group-card-head">
        <div>
          <span className="eyebrow">{group.isAdmin ? "Admin · you" : "Member"}</span>
          <h3 className="group-card-name">{group.name}</h3>
        </div>
        <div className="group-card-code">
          <span className="eyebrow">Invite code</span>
          <div className="group-card-code-row">
            <span className="mono group-card-code-value">{group.inviteCode}</span>
            <button className="btn-ghost btn-ghost-sm" onClick={onCopy}>
              Copy
            </button>
          </div>
        </div>
      </header>

      <div className="group-card-roster">
        <span className="eyebrow">Roster · {roster?.length ?? "…"}</span>
        {roster === undefined ? (
          <p className="muted-line">Loading…</p>
        ) : (
          <ul className="roster-list">
            {roster.map((m) => (
              <li key={m.userId} className="roster-row">
                {m.avatarUrl ? (
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
                <div className="roster-main">
                  <span className="roster-name">
                    {m.displayName}
                    {m.isYou && <span className="roster-you">you</span>}
                  </span>
                  <span className="roster-sub">
                    {m.username ? `@${m.username}` : "—"}
                    {m.isAdmin && " · admin"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
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
