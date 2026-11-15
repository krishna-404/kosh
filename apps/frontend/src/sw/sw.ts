import { env, isDev } from '@frontend/configs/env.config';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
  __WB_DISABLE_DEV_LOGS?: boolean;
};

if (isDev) {
  self.__WB_DISABLE_DEV_LOGS = true;
}

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Skip the "waiting" state as soon as a new SW installs — paired with
// clients.claim() below, this makes new deploys take effect on the next
// page load instead of waiting for every tab to close. Matches the
// autoUpdate registerType in vite.config.ts. Without this, an SW that
// starts intercepting /api/* incorrectly (like the pre-denylist version)
// can silently break OAuth flows for days on already-installed browsers.
// self.addEventListener('install', () => {
//   self.skipWaiting();
// });

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Defensive NetworkOnly for backend paths — belt-and-suspenders to the
// NavigationRoute denylist below. That denylist handles navigation-mode
// requests (like Google's OAuth 302), which is the actual bug we hit. This
// route additionally guarantees that if a future contributor ever adds a
// catch-all Workbox handler (e.g. runtimeCaching) above, backend calls still
// bypass the SW pipeline instead of being silently cached or delayed.
// Match order matters: register this BEFORE NavigationRoute.
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/super-admin/') ||
    url.pathname.startsWith('/mobile-app/'),
  new NetworkOnly(),
);

try {
  // Use index.html without leading slash as it's the standard key in the precache manifest.
  // In development, this might fail because the manifest is handled differently by Vite.
  //
  // denylist prevents the SW from intercepting navigations that must reach the
  // backend via nginx: OAuth callbacks under /api/auth/*, the Novu bridge, oRPC
  // routes, and any admin/mobile endpoints. Without this, Google's OAuth redirect
  // to /api/auth/callback/google?code=... gets served the SPA shell from cache
  // and the code is dropped on the floor.
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//, /^\/super-admin\//, /^\/mobile-app\//],
  }));
} catch (err) {
  if (!isDev) {
    console.warn('[SW] NavigationRoute registration failed:', err);
  } else {
    console.debug('[SW] NavigationRoute skipped in dev mode (standard behavior).');
  }
}

// ─── Firebase Cloud Messaging — background push handler ─────────────────
//
// Runs inside the same SW as the Workbox precache. Do NOT
// create a separate firebase-messaging-sw.js file — a second SW at scope
// `/firebase-messaging-sw.js` would double-register push and race with
// this worker's `push` handling. The main thread passes THIS registration
// to `getToken(messaging, { serviceWorkerRegistration })` so Firebase
// binds its subscription to the worker running below.
//
// `onBackgroundMessage` only fires when the tab is NOT focused. When the
// tab is focused, Firebase suppresses the OS notification and delivers the
// message via `onMessage` on the main thread (see push.utils.ts).
if (env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_MESSAGING_SENDER_ID && env.VITE_FIREBASE_APP_ID) {
  const firebaseApp = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const messaging = getMessaging(firebaseApp);

  onBackgroundMessage(messaging, (payload) => {
    // User-visible push. Novu FCM provider maps the workflow's push step
    // to `payload.notification` (title/body) and any custom fields to
    // `payload.data`. Some browsers auto-render `notification` payloads without
    // hitting this handler; we still call showNotification here so the click
    // URL from `data.url` is applied.
    const title = payload.notification?.title ?? payload.data?.title ?? 'Notification';
    const body = payload.notification?.body ?? payload.data?.body ?? '';
    const url = payload.data?.url ?? payload.fcmOptions?.link ?? '/';
    void self.registration.showNotification(title, {
      body,
      icon: '/notification-icon-192x192.png',
      badge: '/notification-badge-96x96.png',
      data: { url },
      tag: payload.messageId,
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(
    (async () => {
      const targetUrl = new URL(url, self.location.origin).href;
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientsList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
