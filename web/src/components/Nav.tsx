"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { InstallButton } from "./PWA";
import { Button, RollText, SwapText } from "./ui";
import { get } from "@/lib/data";

const LINKS = [
  { href: "/#cases", label: "Demo cases", match: "" },
  { href: "/explore", label: "Explore", match: "/explore" },
  { href: "/globe", label: "Globe", match: "/globe" },
  { href: "/how", label: "How it works", match: "/how" },
];

const UI = [0.4, 0, 0.1, 1] as const;
// MenuStack: card 0 tilts one way, cards 1–2 the other and rise further. Opens 45ms apart, closes in reverse.
const CARD: Variants = {
  closed: (i: number) => ({ opacity: 0, y: i ? 96 * 1.3 : 96, rotate: i ? -3.5 : 3.5, transition: { duration: 0.5, ease: UI, delay: (2 - i) * 0.045 } }),
  open: (i: number) => ({ opacity: 1, y: 0, rotate: 0, transition: { duration: 0.5, ease: UI, delay: i * 0.045 } }),
};

/** Wordmark top left, floating glass pill top right (OPEN A CASE + MENU). The menu is three solid cards. */
export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [fact, setFact] = useState<number | null>(null);
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

  // Move focus into the panel when it opens; load the live fact the first time.
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    if (fact == null) get("meta.json").then((m) => setFact(m.grid_summary.T2M.real_sig)).catch(() => {});
  }, [open, fact]);

  return (
    <nav ref={root} aria-label="Main">
      <Link href="/" aria-label="Trend Detective, home"
        className="nav-glass fixed left-4 top-4 z-50 flex min-h-11 items-center gap-2.5 rounded-full px-2.5 font-display text-[17px] tracking-[-0.02em] text-ink no-underline sm:pr-4">
        <svg width="24" height="24" viewBox="0 0 28 28" aria-hidden="true">
          <circle cx="14" cy="14" r="11" fill="none" stroke="var(--ink-muted)" strokeWidth="2" />
          <path d="M5 17 L10 12 L14 15 L19 8 L23 11" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="hidden sm:inline">trend detective</span>
      </Link>

      <div className="nav-glass fixed right-4 top-4 z-50 flex items-center gap-1 rounded-full p-1">
        {!onExplore && <Button href="/explore" variant="glass">Open a case</Button>}
        <button ref={menuBtn} type="button" aria-expanded={open} aria-controls="nav-menu" onClick={() => setOpen(!open)}
          className="menu-btn btn bg-ink text-ground">
          <SwapText a="Menu" b="Close" showB={open} />
          <span aria-hidden="true" className="menu-dots">••</span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div ref={panel} id="nav-menu" initial="closed" animate="open" exit="closed"
            className="fixed right-4 top-[72px] z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
            <motion.div custom={0} variants={CARD} className="glass flex flex-col p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              {LINKS.map((l) => {
                const on = !!l.match && path.startsWith(l.match);
                return (
                  <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}
                    onClick={() => { setOpen(false); if (l.href === "/explore" && onExplore) window.dispatchEvent(new Event("explore:reset")); }}
                    className="rolllink">
                    <RollText>{l.label}</RollText>
                    <span aria-hidden="true" className="rolllink-arrow">{on ? "•" : "→"}</span>
                  </Link>
                );
              })}
            </motion.div>
            <motion.div custom={1} variants={CARD} className="glass flex flex-col gap-1 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              <p className="hud">Air temperature · 1980–2025</p>
              <p className="text-[26px] leading-[30px]"><span className="tabular-nums">{fact == null ? "…" : fact.toLocaleString("en-US")}</span> places with a real trend</p>
            </motion.div>
            <motion.div custom={2} variants={CARD} className="flex flex-col gap-2 rounded-[var(--radius-sm)] bg-slate p-2 text-on-slate shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              <a href="https://github.com/Arush763/trend-detective" target="_blank" rel="noopener noreferrer" className="rolllink !text-on-slate">
                <RollText>Code on GitHub</RollText>
                <span aria-hidden="true" className="rolllink-arrow">↗</span>
              </a>
              <InstallButton className="justify-center" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
