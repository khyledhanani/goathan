"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { UserMenu, type UserMenuProfile } from "./user-menu";

type AppHeaderProps = {
  profile: UserMenuProfile;
  backHref?: string;
  backLabel?: string;
  context?: string;
  variant?: "default" | "feed";
};

export function AppHeader({
  profile,
  backHref,
  backLabel,
  context,
  variant = "default",
}: AppHeaderProps) {
  const inboxUnread = useQuery(api.notifications.unreadCount);
  const unreadLabel =
    inboxUnread && inboxUnread >= 50 ? "50+" : String(inboxUnread ?? 0);
  const hasUnread = inboxUnread !== undefined && inboxUnread > 0;
  const className =
    variant === "feed" ? "page-wrap-bar page-wrap-bar-feed" : "page-wrap-bar";
  const brand = (
    <Link href="/dashboard" className="entry-brand">
      Receipts<span className="v">v0.1</span>
    </Link>
  );

  return (
    <header className={className}>
      {backHref || context ? (
        <div className="topbar-left">
          {brand}
          {backHref && (
            <Link href={backHref} className="btn-link">
              {backLabel ?? "← Back"}
            </Link>
          )}
          {context && <span className="topbar-context">{context}</span>}
        </div>
      ) : (
        brand
      )}
      <div className="topbar-right">
        <Link
          href="/inbox"
          className="inbox-bell"
          aria-label={hasUnread ? `Inbox, ${unreadLabel} unread` : "Inbox"}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9a6 6 0 0112 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5z"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
            <path
              d="M10 19a2 2 0 004 0"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </svg>
          {hasUnread && <span className="inbox-bell-dot" aria-hidden />}
        </Link>
        <UserMenu profile={profile} />
      </div>
    </header>
  );
}
