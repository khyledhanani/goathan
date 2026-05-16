"use client";

import { useEffect, useRef } from "react";

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
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!value) return;
    const t = setTimeout(() => dismissRef.current(), duration);
    return () => clearTimeout(t);
  }, [value, duration]);

  if (!value) return null;
  return (
    <div className={`toast toast-${value.tone}`} role="status" aria-live="polite">
      {value.message}
    </div>
  );
}
