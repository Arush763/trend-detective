"use client";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RollText } from "./ui";
import { install, registerServiceWorker, useCanInstall, useOnline } from "@/lib/pwa";

/** Registers the service worker and shows a small notice while the device is offline. */
export function PWA() {
  useEffect(registerServiceWorker, []);
  const online = useOnline();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
      <AnimatePresence>
        {!online && (
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="glass-strong hud pointer-events-auto flex items-center gap-2 !rounded-full px-4 py-2 text-ink">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ink-dim" />
            Offline · showing saved NASA data
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** "Install app" pill: only appears when the browser offers installation. */
export function InstallButton({ className = "" }: { className?: string }) {
  const can = useCanInstall();
  if (!can) return null;
  return (
    <button type="button" onClick={() => install()} className={`hud inline-flex min-h-11 items-center gap-2 rounded-full border border-glass-stroke bg-glass px-4 text-ink backdrop-blur-md transition-colors hover:border-signal/60 hover:text-signal ${className}`}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1.5v7.5M3.8 6l3.2 3.2L10.2 6M2 12.5h10" /></svg>
      <RollText>Install app</RollText>
    </button>
  );
}
