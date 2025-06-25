const CACHE_NAME = "PinItDown-pwa-cache";
const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css",
  "/icons/icon-72x72.png",
  "./icons/icon-96x96.png",
  "./icons/icon-144x144.png",
  "./icons/icon-152x152.png",
  "./icons/icon-192x192.png",
  "./icons/icon-512x512.png",
  "./icons/mark.png",
];

// Install event: cache application assets
self.addEventListener("install", (event) => {
  console.log("Service Worker: Installing...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Service Worker: Caching app shell");
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log("Service Worker: Installation complete");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("Service Worker: Caching failed", error);
      })
  );
});

// Activate event: clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activating...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("Service Worker: Clearing old cache", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log(
          "Service Worker: Activation complete, now controlling client."
        );
        return self.clients.claim();
      })
  );
});

// Fetch event: serve cached content when offline
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  // Handle different types of requests
  if (
    event.request.url.includes("cdnjs.cloudflare.com") ||
    event.request.url.includes("unpkg.com")
  ) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            // Don't cache if response is not ok
            if (
              !networkResponse ||
              networkResponse.status !== 200 ||
              networkResponse.type !== "basic"
            ) {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          })
          .catch((error) => {
            console.warn(
              "Service Worker: CDN fetch failed",
              event.request.url,
              error
            );
            return caches.match(event.request);
          });
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            // Don't cache if response is not ok
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            return networkResponse;
          })
          .catch((error) => {
            console.error(
              "Service Worker: Fetch failed",
              event.request.url,
              error
            );
            if (event.request.destination === "document") {
              return caches.match("/index.html");
            }
          });
      })
    );
  }
});
