// CityPlus Service Worker
const CACHE_NAME = "cityplus-v3";
const STATIC_ASSETS = [
    "/",
    "/index.html",
    "/login.html",
    "/staff-setup.html",
    "/css/styles.css",
    "/js/theme.js",
    "/js/landing.js",
    "/js/auth.js",
    "/js/staff-setup.js",
    "/manifest.json"
];

// Install — cache core static assets
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// Fetch — Network-first for everything to ensure latest UI updates
self.addEventListener("fetch", (event) => {
    const { request } = event;

    // Skip non-GET requests
    if (request.method !== "GET") return;

    // Network-first approach: Try to get from network, fallback to cache
    event.respondWith(
        fetch(request)
            .then((response) => {
                // If it's a valid response, cache it for future offline use
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // If network fails (offline), try the cache
                return caches.match(request);
            })
    );
});
