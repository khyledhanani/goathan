"use client";

import Link from "next/link";
import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { mainGoalLabel } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "./toast";
import { ConfirmDialog } from "./confirm-dialog";
import { BottomNav } from "./bottom-nav";
import { AppHeader } from "./app-header";
import { NotificationSettings } from "./notification-settings";
import { ThemeToggle } from "./theme-toggle";

export function SettingsScreen() {
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
      <AppHeader profile={profile} backHref="/profile" backLabel="← Profile" />

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
              No groups yet. Create one or join with a code from Groups.
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
