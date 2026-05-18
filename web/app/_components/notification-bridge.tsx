"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function NotificationBridge() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "NOTIFICATION_NAV" && typeof data.deepLinkPath === "string") {
        router.push(data.deepLinkPath);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [router]);
  return null;
}
