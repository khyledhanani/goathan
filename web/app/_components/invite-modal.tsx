"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";

export function InviteModal({
  open,
  groupId,
  inviteCode,
  groupName,
  onClose,
  onToast,
}: {
  open: boolean;
  groupId: Id<"groups">;
  inviteCode: string;
  groupName: string;
  onClose: () => void;
  onToast: (msg: string, tone?: "neutral" | "error" | "success") => void;
}) {
  const [origin, setOrigin] = useState<string>("");
  const [canShare, setCanShare] = useState(false);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const inviteByUsername = useMutation(api.groups.inviteByUsername);

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
  const normalizedUsername = username.trim().replace(/^@+/, "").toLowerCase();
  const canInvite =
    /^[a-z0-9_.]{2,20}$/.test(normalizedUsername) && !busy;

  const copyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard?.writeText(inviteUrl);
      onToast("Invite link copied", "neutral");
    } catch {
      onToast("Couldn't copy — long-press the code to select", "error");
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

  const inviteUsername = async () => {
    if (!canInvite) return;
    setBusy(true);
    try {
      const result = await inviteByUsername({
        groupId,
        username: normalizedUsername,
      });
      if (!result.ok) {
        onToast(result.error, "error");
        return;
      }
      setUsername("");
      onToast(`Invited @${result.username}`, "success");
    } catch (e) {
      onToast(errorMessage(e), "error");
    } finally {
      setBusy(false);
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

        <div className="invite-modal-username">
          <label className="field">
            <span className="field-label">
              <span>Username</span>
              <span className="hint">Existing users</span>
            </span>
            <div className="invite-username-row">
              <input
                className="field-input mono-input"
                placeholder="@maya"
                value={username}
                maxLength={21}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canInvite) void inviteUsername();
                }}
              />
              <button
                className="btn-primary"
                disabled={!canInvite}
                onClick={inviteUsername}
              >
                {busy ? "Inviting…" : "Invite"}
              </button>
            </div>
          </label>
        </div>

        <div className="invite-modal-code-block">
          <span className="eyebrow">Or paste this code</span>
          <span className="mono invite-modal-code">{inviteCode}</span>
        </div>
      </div>
    </div>
  );
}
