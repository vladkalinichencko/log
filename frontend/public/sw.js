self.addEventListener("push", (event) => {
  const { title, body, url } = event.data.json();
  const show = (pages) =>
    pages.some((page) => page.visibilityState === "visible")
      ? undefined
      : self.registration.showNotification(title, { body, data: { url } });
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(show));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.url));
});
