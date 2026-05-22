"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  getExistingSubscription,
  isStandalone,
  notificationPermission,
  pushSupported,
  subscribePush,
  unsubscribePush,
} from "@/lib/push";

type KindMeta = { key: string; label: string };

const KINDS: KindMeta[] = [
  { key: "LIKE", label: "Reactions on your receipts" },
  { key: "COMMENT", label: "Comments on your receipts" },
  { key: "CAP_CALLED", label: "When someone calls cap on you" },
  { key: "CAP_REVOKED", label: "When your points get revoked" },
  { key: "CAP_RESTORED", label: "When your points are restored" },
  { key: "MEDAL_AWARDED", label: "Weekly medal awards" },
  { key: "MEMBER_JOINED", label: "When someone joins your group" },
  { key: "GROUP_INVITE", label: "When someone invites you to a group" },
  { key: "DAILY_RESET_REMINDER", label: "Daily reset reminder" },
];

export function NotificationSettings({
  onToast,
}: {
  onToast: (msg: string, tone?: "neutral" | "error" | "success") => void;
}) {
  const prefs = useQuery(api.notificationPreferences.get);
  const setPushEnabled = useMutation(api.notificationPreferences.setPushEnabled);
  const setKindMuted = useMutation(api.notificationPreferences.setKindMuted);
  const upsertSub = useMutation(api.pushSubscriptions.upsert);
  const removeSub = useMutation(api.pushSubscriptions.remove);

  const [supported, setSupported] = useState(true);
  const [standalone, setStandalone] = useState(true);
  const [perm, setPerm] = useState<
    "default" | "granted" | "denied" | "unsupported"
  >("default");
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(pushSupported());
    setStandalone(isStandalone());
    setPerm(notificationPermission());
    getExistingSubscription().then((s) => setSubscribed(!!s));
  }, []);

  const onEnableDevice = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        onToast("Push not configured", "error");
        return;
      }
      const next = await Notification.requestPermission();
      setPerm(next);
      if (next !== "granted") {
        onToast("Permission denied — enable in browser settings", "error");
        return;
      }
      const sub = await subscribePush(key);
      if (!sub) {
        onToast("Couldn't subscribe", "error");
        return;
      }
      await upsertSub({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        userAgent: sub.userAgent,
      });
      setSubscribed(true);
      onToast("Notifications enabled", "success");
    } catch (e) {
      onToast(`Error: ${String(e).slice(0, 80)}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const onDisableDevice = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const endpoint = await unsubscribePush();
      if (endpoint) await removeSub({ endpoint });
      setSubscribed(false);
      onToast("Notifications off on this device", "neutral");
    } catch (e) {
      onToast(`Error: ${String(e).slice(0, 80)}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const onToggleMaster = async (enabled: boolean) => {
    try {
      await setPushEnabled({ enabled });
    } catch (e) {
      onToast(`Error: ${String(e).slice(0, 80)}`, "error");
    }
  };

  const onToggleKind = async (kind: string, currentlyMuted: boolean) => {
    try {
      await setKindMuted({ kind, muted: !currentlyMuted });
    } catch (e) {
      onToast(`Error: ${String(e).slice(0, 80)}`, "error");
    }
  };

  const muted = new Set(prefs?.mutedKinds ?? []);
  const pushEnabled = prefs?.pushEnabled ?? true;

  return (
    <div className="notify-settings">
      <div className="notify-state">
        <span className="eyebrow">This device</span>
        <p className="notify-state-line">
          {!supported && "Web push isn't supported in this browser."}
          {supported && !standalone &&
            "Install Receipts to your home screen to enable notifications."}
          {supported && standalone && perm === "denied" &&
            "Permission blocked. Enable notifications for Receipts in your browser settings."}
          {supported && standalone && perm === "default" && subscribed === false &&
            "Not yet enabled on this device."}
          {supported && standalone && perm === "granted" && subscribed === false &&
            "Permission granted but no subscription on file. Re-enable to fix."}
          {supported && standalone && perm === "granted" && subscribed === true &&
            "Enabled on this device."}
          {subscribed === null && supported && standalone &&
            "Checking subscription…"}
        </p>
        {supported && standalone && perm !== "denied" && (
          subscribed ? (
            <button
              className="btn-ghost btn-ghost-sm"
              onClick={onDisableDevice}
              disabled={busy}
            >
              {busy ? "Working…" : "Turn off on this device"}
            </button>
          ) : (
            <button
              className="btn-primary btn-ghost-sm"
              onClick={onEnableDevice}
              disabled={busy}
            >
              {busy ? "Working…" : "Enable on this device"}
              <span className="arrow">→</span>
            </button>
          )
        )}
      </div>

      <div className="notify-master">
        <label className="notify-toggle">
          <input
            type="checkbox"
            checked={pushEnabled}
            onChange={(e) => onToggleMaster(e.target.checked)}
          />
          <span>Master push switch</span>
        </label>
        <p className="notify-master-hint">
          When off, push is suppressed but inbox still records everything.
        </p>
      </div>

      <ul className="notify-kinds">
        {KINDS.map((k) => {
          const m = muted.has(k.key);
          return (
            <li key={k.key} className="notify-kind-row">
              <label className="notify-toggle">
                <input
                  type="checkbox"
                  checked={!m}
                  onChange={() => onToggleKind(k.key, m)}
                  disabled={!pushEnabled}
                />
                <span>{k.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
