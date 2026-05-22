"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { firstName } from "@/lib/utils";

export type UserMenuProfile = {
  displayName: string;
  username?: string;
  avatarUrl?: string;
};

export function UserMenu({ profile }: { profile: UserMenuProfile }) {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hello = firstName(profile.displayName);
  const chipLabel = profile.username ? `@${profile.username}` : profile.displayName;

  const onLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/");
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-chip user-chip-link"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
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
        <span className="user-chip-name">{chipLabel}</span>
      </button>

      {open && (
        <div className="user-menu-pop" role="menu">
          <Link
            href="/profile"
            className="user-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            View profile
          </Link>
          <Link
            href="/settings"
            className="user-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <button
            type="button"
            className="user-menu-item user-menu-item-danger"
            role="menuitem"
            onClick={onLogout}
            disabled={signingOut}
          >
            {signingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
