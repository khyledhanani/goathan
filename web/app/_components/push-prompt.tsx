"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  isStandalone,
  notificationPermission,
  pushSupported,
  subscribePush,
} from "@/lib/push";

const DISMISS_KEY = "receipts.pushPromptDismissedAt";
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function PushPrompt({ eligible }: { eligible: boolean }) {
  const upsert = useMutation(api.pushSubscriptions.upsert);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!eligible) return;
    if (typeof window === "undefined") return;
    if (!pushSupported()) return;
    if (!isStandalone()) return;
    const perm = notificationPermission();
    if (perm !== "default") return;
    try {
      const dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (dismissed && Date.now() - dismissed < DISMISS_TTL_MS) return;
    } catch {
      // storage blocked
    }
    setVisible(true);
  }, [eligible]);

  if (!visible) return null;

  const onEnable = async () => {
    setBusy(true);
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setVisible(false);
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        try {
          localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
          // ignore
        }
        setVisible(false);
        return;
      }
      const sub = await subscribePush(key);
      if (sub) {
        await upsert({
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          userAgent: sub.userAgent,
        });
      }
      setVisible(false);
    } catch {
      setVisible(false);
    } finally {
      setBusy(false);
    }
  };

  const onLater = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  return (
    <aside className="push-prompt" role="region" aria-label="Notifications">
      <div className="push-prompt-body">
        <span className="eyebrow">Stay in the loop</span>
        <p className="push-prompt-line">
          Get a ping when friends react, comment, or cap your receipts.
        </p>
      </div>
      <div className="push-prompt-actions">
        <button className="btn-link" onClick={onLater} disabled={busy}>
          Maybe later
        </button>
        <button
          className="btn-primary btn-ghost-sm"
          onClick={onEnable}
          disabled={busy}
        >
          {busy ? "Enabling…" : "Enable"}
          <span className="arrow">→</span>
        </button>
      </div>
    </aside>
  );
}
