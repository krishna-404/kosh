# Service Worker

The service worker (`sw.ts`) handles the PWA shell and push. Kosh is online-only:
the worker holds no application data.

- `precacheAndRoute(self.__WB_MANIFEST)` — bundled build assets are precached at
  install time so the app shell loads fast and is launchable from the home screen.
- `NavigationRoute` is registered so navigations resolve from the precached
  `index.html` (SPA shell). `/api/*`, `/super-admin/*` and `/mobile-app/*` are
  denylisted and always go to the network.
- `SKIP_WAITING` message handling supports the in-app update prompt
  (`PwaUpdatePrompt`).
- **FCM push**: handles background push messages and shows a notification;
  `notificationclick` focuses or opens the target URL.

There is no local database, no sync protocol and no offline write queue. Every
read and write is an oRPC call to the backend.
