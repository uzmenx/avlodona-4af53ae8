// Polyfill for crypto.randomUUID (especially for Android WebView / Capacitor)
if (typeof window !== 'undefined') {
  try {
    if (!window.crypto) {
      Object.defineProperty(window, 'crypto', {
        value: {},
        writable: true,
        configurable: true
      });
    }
    if (!window.crypto.randomUUID) {
      const randomUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      };
      try {
        Object.defineProperty(window.crypto, 'randomUUID', {
          value: randomUUID,
          writable: true,
          configurable: true
        });
      } catch (e) {
        (window.crypto as any).randomUUID = randomUUID;
      }
    }
  } catch (e) {
    console.warn('Failed to polyfill crypto.randomUUID:', e);
  }
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerPushNotifications } from "./lib/pushNotifications";
import { applyPlatformPerfMode } from "./lib/platformPerf";


applyPlatformPerfMode();

const SW_RESET_KEY = "avlodona:sw-reset:v1";

const clearStalePwaState = async () => {
  if (!("serviceWorker" in navigator)) return false;

  const registrations = await navigator.serviceWorker.getRegistrations();
  const staleRegistrations = registrations.filter((registration) => {
    const scriptUrl =
      registration.active?.scriptURL ||
      registration.waiting?.scriptURL ||
      registration.installing?.scriptURL ||
      "";

    return Boolean(scriptUrl) && !scriptUrl.endsWith("/sw-push.js");
  });

  if (staleRegistrations.length === 0) return false;

  await Promise.all(staleRegistrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(
      cacheKeys
        .filter(
          (key) =>
            key.includes("workbox") ||
            key.includes("vite-pwa") ||
            key.includes("supabase-cache")
        )
        .map((key) => caches.delete(key))
    );
  }

  return true;
};

const bootstrap = async () => {
  let shouldReload = false;

  try {
    if (!sessionStorage.getItem(SW_RESET_KEY)) {
      shouldReload = await clearStalePwaState();
    }
  } catch (error) {
    console.warn("PWA cleanup skipped:", error);
  }

  createRoot(document.getElementById("root")!).render(<App />);
  registerPushNotifications();

  if (shouldReload) {
    sessionStorage.setItem(SW_RESET_KEY, "1");
    window.location.reload();
  }
};

void bootstrap();
