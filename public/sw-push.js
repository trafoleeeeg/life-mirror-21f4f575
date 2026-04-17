// Minimal service worker for Web Push (no offline caching to avoid Lovable preview issues).
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: "Inner Glyph", body: event.data?.text() ?? "" };
  }
  const title = data.title || "Inner Glyph";
  const options = {
    body: data.body || "",
    icon: "/app-icon-512.png",
    badge: "/app-icon-512.png",
    tag: data.tag || "inner-glyph",
    data: { url: data.url || "/app/ping" },
    actions: [
      { action: "open", title: "Открыть" },
      { action: "dismiss", title: "Позже" },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const targetUrl = event.notification.data?.url || "/app/ping";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
