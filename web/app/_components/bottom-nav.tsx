"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Feed", key: "feed" },
  { href: "/groups", label: "Groups", key: "groups" },
  { href: "/profile", label: "Profile", key: "profile" },
] as const;

export function BottomNav() {
  const pathname = usePathname() ?? "/";

  const activeKey = (() => {
    if (pathname.startsWith("/groups") || pathname.startsWith("/group/"))
      return "groups";
    if (pathname.startsWith("/profile") || pathname.startsWith("/u/"))
      return "profile";
    return "feed";
  })();

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav-inner">
        {TABS.map((t) => {
          const active = activeKey === t.key;
          return (
            <Link
              key={t.key}
              href={t.href}
              className={`bottom-nav-tab ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="bottom-nav-glyph" aria-hidden>
                {t.key === "feed" && <FeedIcon active={active} />}
                {t.key === "groups" && <GroupsIcon active={active} />}
                {t.key === "profile" && <ProfileIcon active={active} />}
              </span>
              <span className="bottom-nav-label">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function FeedIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M4 12h16M4 17h10"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function GroupsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle
        cx="9"
        cy="8"
        r="3.2"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
      />
      <path
        d="M3.5 19c.7-3.1 3-5 5.5-5s4.8 1.9 5.5 5"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        strokeLinecap="round"
      />
      <circle
        cx="17"
        cy="9"
        r="2.4"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
      />
      <path
        d="M15 15c1.6-.6 4.2-.4 5.5 2"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="8.5"
        r="3.6"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
      />
      <path
        d="M4.5 20c1.2-3.6 4.2-5.5 7.5-5.5s6.3 1.9 7.5 5.5"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}
