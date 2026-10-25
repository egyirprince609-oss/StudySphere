/* Study Sphere Ai minimal app-shell cache. Authentication/provider calls stay network-only. */
const CACHE_NAME = "study-sphere-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./signup.html",
  "./login.html",
  "./forgot-password.html",
  "./styles.css",
  "./authentication.js",
  "./manifest.json",
  "./logo.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(error => {
    // A single missing asset should not make installation of the worker fatal.
    console.warn("Some Study Sphere Ai shell files could not be cached:", error);
  }).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("study-sphere-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Never intercept Firebase/Google or third-party service traffic.
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(async () => {
      const cached = await caches.match(request);
      return cached || caches.match("./index.html");
    }));
    return;
  }
  event.respondWith(caches.match(request).then(cached => {
    const network = fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    });
    return cached || network;
  }));
});
