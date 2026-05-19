"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { BottomNav } from "./bottom-nav";
import { GroupCreateForm } from "./group-actions";
import { Toast, type ToastValue } from "./toast";
import { UserMenu } from "./user-menu";

export function CreateGroupScreen() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const upsertFromAuth = useMutation(api.profiles.upsertCurrentProfileFromAuth);
  const [toast, setToast] = useState<ToastValue>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    if (profile === undefined) return;
    if (profile === null || !profile.email || !profile.avatarUrl) {
      void upsertFromAuth({});
      return;
    }
    if (!profile.onboardingCompleted) {
      router.replace("/onboarding");
    }
  }, [authLoading, isAuthenticated, profile, upsertFromAuth, router]);

  if (
    authLoading ||
    profile === undefined ||
    profile === null ||
    !profile.onboardingCompleted
  ) {
    return (
      <div className="entry">
        <div className="entry-mid" style={{ textAlign: "center" }}>
          <p className="eyebrow">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap has-bottom-nav">
      <header className="page-wrap-bar">
        <div className="topbar-left">
          <Link href="/dashboard" className="entry-brand">
            Receipts<span className="v">v0.1</span>
          </Link>
          <Link href="/groups" className="btn-link">
            ← Groups
          </Link>
        </div>
        <div className="topbar-right">
          <UserMenu
            profile={{
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
            }}
          />
        </div>
      </header>

      <main className="page">
        <div className="fade-up d1">
          <GroupCreateForm
            onSuccess={(msg, groupId) => {
              setToast({ message: msg, tone: "success" });
              if (groupId) {
                router.push(`/group/${encodeURIComponent(groupId)}`);
              }
            }}
            onError={(msg) => setToast({ message: msg, tone: "error" })}
          />
        </div>
      </main>

      <Toast value={toast} onDismiss={() => setToast(null)} />
      <BottomNav />
    </div>
  );
}
