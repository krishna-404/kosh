import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the service worker. Kosh is online-only: the worker exists for
 * installability, the in-app update prompt and push notifications — it holds
 * no application data.
 */
export function initPWA() {
  registerSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (r) {
        // Monitor installation state
        const sw = r.installing || r.waiting || r.active;
        if (sw) {
          sw.addEventListener('statechange', () => {
            const state = sw.state;
            if (state === 'installing') {
              console.info('[PWA] SW installing...');
            }
            if (state === 'activated') {
              console.info('[PWA] SW activated.');
            }
          });
        }
      }
    },
    onRegisterError(error: unknown) {
      console.error('[PWA] SW registration failed: ', error);
    },
  });
}
