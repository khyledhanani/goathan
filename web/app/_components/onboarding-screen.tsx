"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { MAIN_GOAL_OPTIONS, type MainGoal } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "./toast";

export function OnboardingScreen() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const upsertFromAuth = useMutation(api.profiles.upsertCurrentProfileFromAuth);
  const completeOnboarding = useMutation(api.profiles.completeOnboarding);
  const [signingOut, setSigningOut] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [mainGoal, setMainGoal] = useState<MainGoal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastValue>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (profile === undefined) return;
    if (profile === null) {
      void upsertFromAuth({});
      return;
    }
    setBootstrapped(true);
    if (profile.onboardingCompleted) {
      router.replace("/dashboard");
      return;
    }
    setDisplayName((curr) => curr || profile.displayName || "");
    setUsername((curr) => curr || profile.username || "");
    setMainGoal((curr) => curr ?? profile.mainGoal ?? null);
  }, [authLoading, isAuthenticated, profile, upsertFromAuth, router]);

  const usernameValid = /^[a-z0-9_.]{2,20}$/.test(username.trim());
  const usernameHint =
    username.length > 0 && !usernameValid
      ? "2–20 chars · a–z, 0–9, _ or ."
      : null;

  const canSubmit = useMemo(
    () =>
      displayName.trim().length > 0 &&
      usernameValid &&
      !submitting,
    [displayName, usernameValid, submitting],
  );

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await completeOnboarding({
        displayName: displayName.trim(),
        username: username.trim(),
        mainGoal: mainGoal ?? undefined,
      });
      router.replace("/dashboard");
    } catch (e) {
      setToast({ message: errorMessage(e, "Could not save. Try again."), tone: "error" });
      setSubmitting(false);
    }
  };

  if (authLoading || profile === undefined || !bootstrapped) {
    return <PageBootstrap />;
  }

  return (
    <div className="entry onboarding">
      <div className="entry-top fade-up">
        <span className="entry-brand">
          Receipts<span className="v">v0.1</span>
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span className="eyebrow">
            Step <b>1 of 1</b> · onboarding
          </span>
          <button
            className="btn-link"
            onClick={async () => {
              setSigningOut(true);
              try {
                await signOut();
                router.replace("/");
              } catch {
                setSigningOut(false);
              }
            }}
            disabled={signingOut}
          >
            {signingOut ? "Out…" : "Log out"}
          </button>
        </div>
      </div>

      <div className="entry-mid">
        <h1 className="entry-hed fade-up d1">
          You&apos;re <span className="underline">in</span>.
        </h1>
        <p className="entry-dek fade-up d2">
          Set your tag and pick your angle. You can change either later.
        </p>

        <div className="fade-up d3 onboard-form">
          <label className="field">
            <span className="field-label">
              <span>Display name</span>
              <span className="hint">Visible to your group</span>
            </span>
            <input
              className="field-input"
              value={displayName}
              maxLength={32}
              autoFocus
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="What should we tag you as"
            />
          </label>

          <label className="field">
            <span className="field-label">
              <span>Username</span>
              <span className="hint">
                {usernameHint ?? "Required · a–z, 0–9, _ or ."}
              </span>
            </span>
            <input
              className="field-input mono-input"
              value={username}
              maxLength={20}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))
              }
              placeholder="rahul"
            />
          </label>

          <div className="field" style={{ marginTop: 26 }}>
            <span className="field-label">
              <span>What&apos;s the angle?</span>
              <span className="hint">Pick one (optional)</span>
            </span>
            <div className="goal-grid">
              {MAIN_GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`goal-card ${mainGoal === opt.value ? "active" : ""}`}
                  onClick={() => setMainGoal(mainGoal === opt.value ? null : opt.value)}
                >
                  <span className="goal-card-label">{opt.label}</span>
                  <span className="goal-card-blurb">{opt.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 28, display: "flex", gap: 12, alignItems: "center" }}>
            <button className="btn-primary" disabled={!canSubmit} onClick={onSubmit}>
              {submitting ? "Locking in…" : "Bring the receipts"}
              <span className="arrow">→</span>
            </button>
            <span className="eyebrow">You can edit this later</span>
          </div>
        </div>
      </div>

      <div className="entry-foot fade-up d4">
        <span className="eyebrow">No receipts, no rank</span>
        <span className="eyebrow">Private · invite only</span>
      </div>

      <Toast value={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function PageBootstrap() {
  return (
    <div className="entry">
      <div className="entry-mid" style={{ textAlign: "center" }}>
        <p className="eyebrow">Loading…</p>
      </div>
    </div>
  );
}
