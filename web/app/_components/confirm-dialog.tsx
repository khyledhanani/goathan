"use client";

import { useEffect, type ReactNode } from "react";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" onClick={busy ? undefined : onCancel}>
      <div className="modal modal-confirm" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2 className="modal-title">{title}</h2>
        </header>
        <div className="modal-confirm-body">{body}</div>
        <footer className="modal-foot">
          <button className="btn-link" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={`btn-primary ${danger ? "btn-danger" : ""}`}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? "Working…" : confirmLabel}
            <span className="arrow">→</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
