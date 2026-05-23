"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { errorMessage } from "@/lib/errors";
import { Toast, type ToastValue } from "./toast";

export function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [status, setStatus] = useState<
    "idle" | "signing-in" | "dev-signing-in" | "error"
  >("idle");
  const [toast, setToast] = useState<ToastValue>(null);
  const devBypassEnabled =
    process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS === "true";

  const onSignIn = async () => {
    setStatus("signing-in");
    try {
      await signIn("google", { redirectTo: "/dashboard" });
    } catch (e) {
      setToast({
        message: errorMessage(e, "Sign-in failed. Try again."),
        tone: "error",
      });
      setStatus("error");
    }
  };

  const onDevSignIn = async () => {
    setStatus("dev-signing-in");
    try {
      await signIn("anonymous");
      router.replace("/dashboard");
    } catch (e) {
      setToast({
        message: errorMessage(e, "Dev sign-in failed."),
        tone: "error",
      });
      setStatus("error");
    }
  };

  const busy = status === "signing-in";
  const devBusy = status === "dev-signing-in";

  return (
    <div className="entry">
      <div className="entry-top fade-up">
        <span className="entry-brand">
          Receipts<span className="v">v0.1</span>
        </span>
        <span className="eyebrow">
          <b>Private</b> · invite only
        </span>
      </div>

      <div className="entry-mid">
        <h1 className="entry-hed fade-up d1">
          Receipts for<br />
          <span className="underline">anything.</span>
        </h1>
        <p className="entry-dek fade-up d2">
          Make a group. Add daily or weekly tasks. Post proof when they&apos;re
          done. Your friends decide what counts.
        </p>

        <div className="entry-tasks fade-up d2">
          {[
            "Take a selfie",
            "Make your bed",
            "Hit the gym",
            "Do cardio",
            "Drink water",
            "Read 10 pages",
            "No takeout",
            "Sleep by 11",
          ].map((t) => (
            <span key={t} className="entry-task-pill">{t}</span>
          ))}
        </div>

        <div className="fade-up d3" style={{ maxWidth: 420 }}>
          <button
            className="btn-google"
            onClick={onSignIn}
            disabled={busy || devBusy}
            aria-busy={busy}
          >
            <GoogleGlyph />
            <span>{busy ? "Opening Google…" : "Sign in with Google"}</span>
            <span className="arrow">→</span>
          </button>

          {devBypassEnabled && (
            <button
              className="btn-ghost dev-signin-btn"
              onClick={onDevSignIn}
              disabled={busy || devBusy}
              aria-busy={devBusy}
            >
              {devBusy ? "Entering dev mode…" : "Skip sign-in for local dev"}
              <span className="arrow">→</span>
            </button>
          )}

          <p className="auth-fineprint">
            We&apos;ll pull your name, email, and avatar from Google. You can change
            your tag in onboarding.
          </p>
        </div>
      </div>

      <div className="entry-foot fade-up d4">
        <span className="eyebrow">© Receipts · small promises, daily receipts</span>
        <div className="lattice">
          <div>
            <span className="k">Tasks</span>
            <span className="v">Anything</span>
          </div>
          <div>
            <span className="k">Proof</span>
            <span className="v">Photo / screenshot</span>
          </div>
          <div>
            <span className="k">Referee</span>
            <span className="v">Your&nbsp;friends</span>
          </div>
        </div>
      </div>

      <Toast value={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.58 2.68-3.9 2.68-6.62z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
