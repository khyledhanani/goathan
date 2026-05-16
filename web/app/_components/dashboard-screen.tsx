"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { firstName } from "@/lib/utils";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "./toast";
import { TodaySlate } from "./today-slate";

export function DashboardScreen() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const home = useQuery(api.groups.homeView);
  const upsertFromAuth = useMutation(api.profiles.upsertCurrentProfileFromAuth);
  const toggleCompletion = useMutation(api.completions.toggle);
  const [toast, setToast] = useState<ToastValue>(null);

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
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="page-wrap">
      <header className="page-wrap-bar">
        <Link href="/dashboard" className="entry-brand">
          Receipts<span className="v">v0.1</span>
        </Link>
        <Link href="/profile" className="user-chip user-chip-link">
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
        </Link>
      </header>

      <main className="page">
        {home && home.groups.length === 0 ? (
          <EmptyHome hello={hello} />
        ) : (
          home && (
            <>
              <div className="page-head fade-up">
                <div>
                  <span className="eyebrow">
                    Today · {dateLabel} · across{" "}
                    <b>{home.totals.groupCount}</b>{" "}
                    {home.totals.groupCount === 1 ? "group" : "groups"}
                  </span>
                  <h1 className="h-page" style={{ marginTop: 8 }}>
                    Today<span className="roman">.</span>
                  </h1>
                  <p className="entry-dek" style={{ marginTop: 14, maxWidth: 560 }}>
                    <span className="num">{home.totals.todayPoints}</span> pts
                    today ·{" "}
                    <span className="num">{home.totals.weekPoints}</span> this
                    week ·{" "}
                    <span className="num">{home.totals.todayDone}</span>/
                    <span className="num">{home.totals.totalDailyTasks}</span>{" "}
                    done
                  </p>
                </div>
              </div>

              {home.groups.map((g, idx) => (
                <section
                  key={g._id}
                  className="fade-up home-group"
                  style={{ animationDelay: `${60 + idx * 60}ms` }}
                >
                  <header className="home-group-head">
                    <div>
                      <span className="eyebrow">
                        <b>{g.name}</b>
                        {g.isAdmin && <> · admin</>}
                      </span>
                      <p className="home-group-stats">
                        <span className="num">{g.stats.todayPoints}</span> today
                        · <span className="num">{g.stats.weekPoints}</span> this
                        week ·{" "}
                        <span className="num">
                          {g.stats.todayDone}/{g.stats.totalDailyTasks}
                        </span>{" "}
                        done
                      </p>
                    </div>
                    <Link href={`/group/${g._id}`} className="btn-link">
                      Open →
                    </Link>
                  </header>
                  {g.slate.length === 0 ? (
                    <p className="muted-line" style={{ paddingTop: 12 }}>
                      No tasks yet in this group.
                    </p>
                  ) : (
                    <TodaySlate slate={g.slate} onToggle={onToggle} />
                  )}
                </section>
              ))}
            </>
          )
        )}
      </main>

      <Toast value={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function EmptyHome({ hello }: { hello: string }) {
  return (
    <div className="page-head fade-up">
      <div>
        <span className="eyebrow">Welcome to Receipts</span>
        <h1 className="h-page" style={{ marginTop: 8 }}>
          {hello}<span className="roman">.</span>
        </h1>
        <p className="entry-dek" style={{ marginTop: 14, maxWidth: 520 }}>
          You&apos;re in, but not in a group yet. Head to your profile to spin
          one up or join with a code.
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
