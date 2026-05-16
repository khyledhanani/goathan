"use client";

import { useEffect } from "react";

export type ToastTone = "neutral" | "error" | "success";
export type ToastValue = { message: string; tone: ToastTone } | null;

export function Toast({
  value,
  onDismiss,
  duration = 3400,
}: {
  value: ToastValue;
  onDismiss: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!value) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [value, duration, onDismiss]);

  if (!value) return null;
  return (
    <div className={`toast toast-${value.tone}`} role="status" aria-live="polite">
      {value.message}
    </div>
  );
}
