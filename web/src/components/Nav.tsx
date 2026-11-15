"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { InstallButton } from "./PWA";
import { Button, RollText } from "./ui";

const LINKS = [
  { href: "/#cases", label: "Demo cases", match: "" },
  { href: "/explore", label: "Explore", match: "/explore" },
  { href: "/globe", label: "Globe", match: "/globe" },
  { href: "/how", label: "How it works", match: "/how" },
];

/** Wordmark top left, floating glass pill top right (OPEN A CASE + MENU). No full-width bar. */
export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const onExplore = path.startsWith("/explore");

  // Close on Escape (focus returns to the button) and on outside click.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); menuBtn.current?.focus(); } };
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);

  // Move focus into the panel when it opens.
  useEffect(() => { if (open) panel.current?.querySelector<HTMLElement>("a, button")?.focus(); }, [open]);

  return (
    <nav ref={root} aria-label="Main">
      <Link href="/" aria-label="Trend Detective, home"
        className="glass-strong fixed left-4 top-4 z-50 flex min-h-11 items-center gap-2.5 !rounded-full pl-2.5 pr-2.5 font-display text-[17px] tracking-[-0.03em] text-ink no-underline hover:text-ink sm:pr-4">
        <svg width="24" height="24" viewBox="0 0 28 28" aria-hidden="true">
          <circle cx="14" cy="14" r="11" fill="none" stroke="var(--signal)" strokeWidth="2" />
          <path d="M5 17 L10 12 L14 15 L19 8 L23 11" fill="none" stroke="var(--warming)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="hidden sm:inline">trend detective</span>
      </Link>

      <div className="glass-strong fixed right-4 top-4 z-50 flex items-center gap-1 !rounded-full p-1">
        {!onExplore && <Button href="/explore" className="!px-4">Open a case</Button>}
        <button ref={menuBtn} type="button" aria-expanded={open} aria-controls="nav-menu" onClick={() => setOpen(!open)}
          className="hud inline-flex min-h-11 items-center rounded-full px-4 text-ink hover:bg-white/10">
          <RollText>{open ? "Close" : "Menu"}</RollText>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div ref={panel} id="nav-menu"
            initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="glass-strong fixed right-4 top-[72px] z-50 flex w-[min(20rem,calc(100vw-2rem))] origin-top-right flex-col gap-1 p-2">
            <p className="hud px-3 pb-1 pt-2"><span aria-hidden="true" className="mr-2 text-ink-faint">{"//////"}</span>Menu</p>
            {LINKS.map((l) => {
              const on = !!l.match && path.startsWith(l.match);
              return (
                <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}
                  onClick={() => { setOpen(false); if (l.href === "/explore" && onExplore) window.dispatchEvent(new Event("explore:reset")); }}
                  className={`hud flex min-h-11 items-center justify-between rounded-xl px-3 no-underline transition-colors ${on ? "bg-white/[0.08] text-signal hover:text-signal" : "text-ink-dim hover:bg-white/[0.06] hover:text-ink"}`}>
                  <RollText>{l.label}</RollText>
                  <span aria-hidden="true" className="text-ink-faint">{on ? "●" : "→"}</span>
                </Link>
              );
            })}
            <InstallButton className="mt-1 justify-center" />
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
