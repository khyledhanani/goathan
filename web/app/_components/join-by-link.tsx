"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { errorMessage } from "@/lib/errors";

const PENDING_KEY = "receipts.pendingJoinCode";

export function JoinByLink({ code }: { code: string }) {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const joinByCode = useMutation(api.groups.joinByCode);

  const normalized = code.trim().toUpperCase();
  const valid = /^[A-Z0-9]{6}$/.test(normalized);

  const [status, setStatus] = useState<
    "idle" | "joining" | "joined" | "error" | "already"
  >("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const triedRef = useRef(false);

  useEffect(() => {
    if (!valid) {
      setStatus("error");
      setErrMsg("That invite code doesn't look right.");
      return;
    }
    if (authLoading) return;

    if (!isAuthenticated) {
      try {
        localStorage.setItem(PENDING_KEY, normalized);
      } catch {
        // storage blocked
      }
      router.replace("/");
      return;
    }

    if (profile === undefined) return;
    if (!profile || !profile.onboardingCompleted) {
      try {
        localStorage.setItem(PENDING_KEY, normalized);
      } catch {
        // storage blocked
      }
      router.replace("/onboarding");
      return;
    }

    if (triedRef.current) return;
    triedRef.current = true;
    setStatus("joining");
    joinByCode({ inviteCode: normalized })
      .then((result) => {
        try {
          localStorage.removeItem(PENDING_KEY);
        } catch {
          // storage blocked
        }
        if (result.ok) {
          setStatus("joined");
          router.replace(`/group/${result.groupId}`);
        } else if (result.error.includes("already")) {
          setStatus("already");
          setErrMsg(result.error);
        } else {
          setStatus("error");
          setErrMsg(result.error);
        }
      })
      .catch((e) => {
        setStatus("error");
        setErrMsg(errorMessage(e));
      });
  }, [
    valid,
    normalized,
    authLoading,
    isAuthenticated,
    profile,
    joinByCode,
    router,
  ]);

  return (
    <div className="entry">
      <div className="entry-mid" style={{ textAlign: "center", maxWidth: 420 }}>
        <p className="eyebrow">Receipts invite</p>
        <h1
          className="h-page h-page-serif"
          style={{ marginTop: 10, fontSize: "clamp(36px, 8vw, 56px)" }}
        >
          Join up<span className="roman">.</span>
        </h1>
        <p className="entry-dek" style={{ marginTop: 14 }}>
          {status === "error" && (
            <span>{errMsg ?? "We couldn't process this invite."}</span>
          )}
          {status === "already" && (
            <span>You&apos;re already in this group.</span>
          )}
          {status === "joined" && (
            <span>You&apos;re in. Heading to the group…</span>
          )}
          {(status === "idle" || status === "joining") && (
            <span>Hooking you in with code <b className="mono">{normalized}</b>…</span>
          )}
        </p>
        <div style={{ marginTop: 22 }}>
          <Link href="/dashboard" className="btn-primary">
            Go to Receipts
            <span className="arrow">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export const PENDING_JOIN_KEY = PENDING_KEY;
