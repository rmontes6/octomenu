// Minimal service worker: exists only to satisfy PWA installability checks.
// Deliberately does NOT cache anything -- this app is data-driven (menus,
// shopping list) and needs fresh data on every load, so there is no offline
// caching of API responses or HTML navigations here.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Presence of a fetch listener is part of some browsers' historical
// installability heuristics -- pure pass-through, no caching.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
