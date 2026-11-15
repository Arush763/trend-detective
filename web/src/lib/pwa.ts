"use client";
// App install + offline state, shared by the nav (Install button) and the offline notice.
import { useSyncExternalStore } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
let wired = false;

function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  // Chrome, Edge and Android fire this when the site can be installed; we keep it for our own button.
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallPrompt; notify(); });
  window.addEventListener("appinstalled", () => { deferred = null; notify(); });
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
}
if (typeof window !== "undefined") wire(); // listen as soon as this module loads, so an early prompt isn't missed
const subscribe = (l: () => void) => { wire(); listeners.add(l); return () => { listeners.delete(l); }; };

/** True when the browser has offered to install the app (never on iPhone: Safari has no install prompt). */
export const useCanInstall = () => useSyncExternalStore(subscribe, () => deferred != null, () => false);
/** False while the device is offline. */
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

export async function install() {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  notify();
}

/** Register the service worker (production builds only, so local development never serves stale files). */
export function registerServiceWorker() {
  wire();
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  const go = () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    // Hand the worker everything this page already loaded, so files fetched before it took control get saved too.
    navigator.serviceWorker.ready.then((reg) => {
      const urls = performance.getEntriesByType("resource").map((e) => e.name).filter((u) => u.startsWith(location.origin));
      reg.active?.postMessage({ type: "cache-urls", urls });
    }).catch(() => {});
  };
  if (document.readyState === "complete") go(); else window.addEventListener("load", go, { once: true });
}
