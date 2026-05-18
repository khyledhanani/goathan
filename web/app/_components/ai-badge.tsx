"use client";

import { useEffect, useRef, useState } from "react";

export type AiVerification = {
  status:
    | "PENDING"
    | "PASSED"
    | "INCONCLUSIVE"
    | "FAILED"
    | "ERROR"
    | "SKIPPED";
  confidence: number | null;
  reasoning: string | null;
  flags: string[];
};

export function AiBadge({
  verification,
  size = "sm",
}: {
  verification: AiVerification | null;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!verification) return null;
  if (verification.status === "SKIPPED") return null;

  const variant =
    verification.status === "PASSED"
      ? "pass"
      : verification.status === "FAILED"
        ? "fail"
        : verification.status === "INCONCLUSIVE"
          ? "warn"
          : verification.status === "ERROR"
            ? "error"
            : "pending";

  const label =
    verification.status === "PASSED"
      ? "AI ✓"
      : verification.status === "FAILED"
        ? "AI ✗"
        : verification.status === "INCONCLUSIVE"
          ? "AI ⚠"
          : verification.status === "ERROR"
            ? "AI ?"
            : "AI …";

  const interactive = verification.status !== "PENDING";

  return (
    <span
      ref={ref}
      className={`ai-badge ai-badge-${variant} ai-badge-${size} ${open ? "is-open" : ""}`}
    >
      <button
        type="button"
        className="ai-badge-trigger"
        onClick={(e) => {
          if (!interactive) return;
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label={`AI verification: ${verification.status.toLowerCase()}`}
      >
        {label}
      </button>
      {open && (
        <span
          className="ai-badge-pop"
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="ai-badge-pop-title">
            {variantTitle(verification.status)}
            {verification.confidence !== null && (
              <span className="ai-badge-pop-conf mono">
                {Math.round(verification.confidence * 100)}%
              </span>
            )}
          </span>
          {verification.reasoning && (
            <span className="ai-badge-pop-body">{verification.reasoning}</span>
          )}
          {verification.flags.length > 0 && (
            <span className="ai-badge-pop-flags">
              {verification.flags.map((f) => (
                <span key={f} className="ai-badge-pop-flag mono">
                  {f}
                </span>
              ))}
            </span>
          )}
          <span className="ai-badge-pop-foot mono">
            AI signal · humans still decide
          </span>
        </span>
      )}
    </span>
  );
}

function variantTitle(status: AiVerification["status"]): string {
  switch (status) {
    case "PASSED":
      return "Looks legit";
    case "FAILED":
      return "Doesn't match";
    case "INCONCLUSIVE":
      return "Unclear";
    case "PENDING":
      return "Checking…";
    case "ERROR":
      return "Couldn't analyze";
    default:
      return "AI";
  }
}
