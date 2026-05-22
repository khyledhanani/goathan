"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "./toast";
import { BottomNav } from "./bottom-nav";
import { AppHeader } from "./app-header";

function timeAgo(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return `${Math.floor(day / 7)}w`;
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "LIKE":
      return "Reaction";
    case "COMMENT":
      return "Comment";
    case "CAP_CALLED":
      return "Cap called";
    case "CAP_REVOKED":
      return "Revoked";
    case "CAP_RESTORED":
      return "Restored";
    case "MEDAL_AWARDED":
      return "Medal";
    case "MEMBER_JOINED":
      return "New member";
    case "GROUP_INVITE":
      return "Invite";
    case "DAILY_RESET_REMINDER":
      return "Reminder";
    default:
      return kind;
  }
}

export function InboxScreen() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const data = useQuery(api.notifications.recent, {});
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const [toast, setToast] = useState<ToastValue>(null);
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.replace("/");
  }, [authLoading, isAuthenticated, router]);

  const onTap = async (id: Id<"notifications">, deepLinkPath: string) => {
    try {
      await markRead({ notificationId: id });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
    }
    router.push(deepLinkPath);
  };

  const onMarkAll = async () => {
    try {
      await markAllRead({});
      setToast({ message: "All caught up", tone: "neutral" });
    } catch (e) {
      setToast({ message: errorMessage(e), tone: "error" });
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

  const unread = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="page-wrap has-bottom-nav">
      <AppHeader profile={profile} backHref="/dashboard" backLabel="← Feed" />

      <main className="page">
        <div className="page-head fade-up">
          <div style={{ flex: 1 }}>
            <span className="eyebrow">
              {unread > 0
                ? `${unread} unread`
                : items.length > 0
                  ? "Caught up"
                  : "Empty"}
            </span>
            <h1 className="h-page h-page-serif" style={{ marginTop: 8 }}>
              Inbox<span className="roman">.</span>
            </h1>
          </div>
          {unread > 0 && (
            <button
              className="btn-ghost btn-ghost-sm"
              onClick={onMarkAll}
              style={{ alignSelf: "flex-start", marginTop: 24 }}
            >
              Mark all read
            </button>
          )}
        </div>

        {data === undefined ? (
          <p className="muted-line" style={{ marginTop: 22 }}>
            Loading…
          </p>
        ) : items.length === 0 ? (
          <div className="activity-empty" style={{ marginTop: 22 }}>
            <p className="eyebrow">Empty inbox</p>
            <p className="activity-empty-line">
              Reactions, comments, and caps will land here.
            </p>
          </div>
        ) : (
          <ul className="inbox-list fade-up d1">
            {items.map((n) => (
              <li
                key={n._id}
                className={`inbox-row ${n.readAt === null ? "unread" : ""}`}
              >
                <button
                  className="inbox-row-btn"
                  onClick={() => onTap(n._id, n.deepLinkPath)}
                >
                  <span className="inbox-row-meta">
                    <span className="inbox-row-kind mono">
                      {kindLabel(n.kind)}
                    </span>
                    <span className="inbox-row-time mono">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                  <p className="inbox-row-title">{n.title}</p>
                  <p className="inbox-row-body">{n.body}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Toast value={toast} onDismiss={() => setToast(null)} />
      <BottomNav />
    </div>
  );
}
