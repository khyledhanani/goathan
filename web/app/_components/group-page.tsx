"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { firstName } from "@/lib/utils";
import { Toast, type ToastValue } from "./toast";
import { TodaySlate } from "./today-slate";
import { AddTaskModal } from "./add-task-modal";

export function GroupPage({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  const profile = useQuery(api.profiles.getCurrentProfile);
  const view = useQuery(api.groups.todayView, {
    groupId: groupId as Id<"groups">,
  });
  const toggleCompletion = useMutation(api.completions.toggle);
  const createTask = useMutation(api.tasks.create);

  const [toast, setToast] = useState<ToastValue>(null);
  const [adding, setAdding] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

  const onLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/");
    } catch {
      setSigningOut(false);
    }
  };

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

  const hello = firstName(profile.displayName);
  const { group, slate, stats, isAdmin } = view;

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const onToggle = async (taskId: Id<"tasks">) => {
    try {
      const result = await toggleCompletion({ taskId });
      if (result.state === "added") {
        setToast({ message: "Locked in", tone: "success" });
      }
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
  };

  return (
    <div className="page-wrap">
      <header className="page-wrap-bar">
        <span className="entry-brand">
          Receipts<span className="v">v0.1</span>
        </span>
        <div className="topbar-right">
          <Link href="/dashboard" className="btn-link">
            Groups
          </Link>
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
        </div>
      </header>

      <main className="page">
        <div className="page-head fade-up">
          <div>
            <span className="eyebrow">
              <b>{group.name}</b> · {stats.weekKey.replace("-W", " · week ")} · {dateLabel}
            </span>
            <h1 className="h-page" style={{ marginTop: 8 }}>
              Today<span className="roman">.</span>
            </h1>
            <p className="entry-dek" style={{ marginTop: 14, maxWidth: 560 }}>
              <span className="num">{stats.todayPoints}</span> pts today ·{" "}
              <span className="num">{stats.weekPoints}</span> this week ·{" "}
              <span className="num">{stats.todayDone}</span>/
              <span className="num">{stats.totalDailyTasks}</span> done
            </p>
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

          <TodaySlate slate={slate} onToggle={onToggle} />

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

      <Toast value={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
