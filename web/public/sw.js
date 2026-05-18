const VERSION = "receipts-v1";
const SHELL = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("/").then((res) => res ?? new Response("offline")),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (_e) {
    return;
  }
  const title = payload.title || "Receipts";
  const body = payload.body || "";
  const tag = payload.notificationId || undefined;
  const data = {
    deepLinkPath: payload.deepLinkPath || "/dashboard",
    notificationId: payload.notificationId,
    kind: payload.kind,
  };
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag,
      data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const deepLinkPath = data.deepLinkPath || "/dashboard";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if ("focus" in client) {
          try {
            client.postMessage({
              type: "NOTIFICATION_NAV",
              deepLinkPath,
              notificationId: data.notificationId,
            });
          } catch (_e) {
            // ignore
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(deepLinkPath);
    })(),
  );
});
