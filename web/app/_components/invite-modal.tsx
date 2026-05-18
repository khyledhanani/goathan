"use client";

import { useEffect, useState } from "react";

export function InviteModal({
  open,
  inviteCode,
  groupName,
  onClose,
  onToast,
}: {
  open: boolean;
  inviteCode: string;
  groupName: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [origin, setOrigin] = useState<string>("");
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOrigin(window.location.origin);
    setCanShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const inviteUrl = origin ? `${origin}/join/${inviteCode}` : "";

  const copyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard?.writeText(inviteUrl);
      onToast("Invite link copied");
    } catch {
      onToast("Couldn't copy — long-press the code to select");
    }
  };

  const share = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.share({
        title: `Join ${groupName} on Receipts`,
        text: `${groupName} is keeping each other honest on Receipts. Join up:`,
        url: inviteUrl,
      });
    } catch {
      // user cancelled or share unavailable — silent
    }
  };

  return (
    <div
      className="invite-modal-scrim"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="invite-modal" onClick={(e) => e.stopPropagation()}>
        <header className="invite-modal-head">
          <span className="eyebrow">Grow the group</span>
          <h2 className="invite-modal-title">
            Invite friends<span className="roman">.</span>
          </h2>
          <p className="invite-modal-dek">
            Share this group with people you want on the board.
          </p>
          <button
            className="invite-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="invite-modal-actions">
          <button className="btn-primary invite-modal-action" onClick={copyLink}>
            Copy invite link
          </button>
          {canShare && (
            <button
              className="btn-ghost invite-modal-action"
              onClick={share}
            >
              Share…
            </button>
          )}
        </div>

        <div className="invite-modal-code-block">
          <span className="eyebrow">Or paste this code</span>
          <span className="mono invite-modal-code">{inviteCode}</span>
        </div>
      </div>
    </div>
  );
}
