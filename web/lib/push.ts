function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function pushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios = (window.navigator as unknown as { standalone?: boolean })
    .standalone === true;
  return mq || ios;
}

export function notificationPermission():
  | "default"
  | "granted"
  | "denied"
  | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window))
    return "unsupported";
  return Notification.permission;
}

export type SubscribePayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
}

export async function subscribePush(
  vapidPublicKey: string,
): Promise<SubscribePayload | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  let sub: PushSubscription;
  if (existing) {
    sub = existing;
  } else {
    const keyBytes = urlBase64ToUint8Array(vapidPublicKey);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes.buffer.slice(
        keyBytes.byteOffset,
        keyBytes.byteOffset + keyBytes.byteLength,
      ) as ArrayBuffer,
    });
  }
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!sub.endpoint || !p256dh || !auth) return null;
  return {
    endpoint: sub.endpoint,
    p256dh,
    auth,
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };
}

export async function unsubscribePush(): Promise<string | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {
    // ignore
  }
  return endpoint;
}

// Helper to base64-encode raw subscription key buffers if we need to parse
// the raw form (e.g. when toJSON keys are unavailable on some browsers).
export function rawKeysToBase64(sub: PushSubscription): {
  p256dh: string | null;
  auth: string | null;
} {
  const p256dhBuffer = sub.getKey("p256dh");
  const authBuffer = sub.getKey("auth");
  return {
    p256dh: p256dhBuffer ? arrayBufferToBase64(p256dhBuffer) : null,
    auth: authBuffer ? arrayBufferToBase64(authBuffer) : null,
  };
}
