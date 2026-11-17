// Firebase Cloud Messaging — shows a push notification when the app isn't
// in the foreground. apiKey/appId below are placeholders: fill them in
// from the Web app "Prism" in the Firebase console (Project settings ->
// your web app -> SDK setup and configuration) -- NOT the Android app's
// values. projectId/messagingSenderId are already filled in from the
// registered Firebase project. Wrapped in try/catch so a placeholder
// config fails silently without breaking the cache logic below.
try {
  importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js");

  firebase.initializeApp({
    apiKey: "REPLACE_WITH_VITE_FIREBASE_API_KEY",
    authDomain: "prism0001.firebaseapp.com",
    projectId: "prism0001",
    messagingSenderId: "69576681235",
    appId: "REPLACE_WITH_VITE_FIREBASE_APP_ID",
  });

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? "Uttarpatra";
    const body = payload.notification?.body ?? "";
    self.registration.showNotification(title, { body, icon: "/logo.webp" });
  });
} catch {
  // Firebase config not finished yet, or messaging unsupported here.
}

const SHELL_CACHE = "shell-v5";
const SHELL_ASSETS = ["/", "/offline.html", "/manifest.json", "/logo.webp", "/favicon.ico", "/privacy.html", "/terms.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () =>
        (await caches.match(url.pathname === "/privacy.html" || url.pathname === "/terms.html" ? url.pathname : "/")) ??
        (await caches.match("/offline.html")),
      ),
    );
  }
});
