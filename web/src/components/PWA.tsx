"use client";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
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
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-[#0f1730]/90 px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-[var(--soft)] shadow-2xl backdrop-blur-md">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--maybe)]" />
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
    <button type="button" onClick={() => install()} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--accent)]/50 px-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10 ${className}`}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1.5v7.5M3.8 6l3.2 3.2L10.2 6M2 12.5h10" /></svg>
      Install app
    </button>
  );
}
