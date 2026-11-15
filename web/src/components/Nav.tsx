"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { InstallButton } from "./PWA";

const LINKS = [
  { href: "/#cases", label: "Demo cases", match: "" },
  { href: "/explore", label: "Explore", match: "/explore" },
  { href: "/globe", label: "Globe", match: "/globe" },
  { href: "/how", label: "How it works", match: "/how" },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const onExplore = path.startsWith("/explore");
  const links = (cls: string) => LINKS.map((l) => {
    const on = !!l.match && path.startsWith(l.match);
    return (
      <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}
        onClick={() => { setOpen(false); if (l.href === "/explore" && onExplore) window.dispatchEvent(new Event("explore:reset")); }}
        className={`${cls} rounded-full px-3 text-[12px] uppercase tracking-[0.12em] no-underline transition-colors ${on ? "bg-white/[0.08] text-[var(--text)]" : "text-[var(--soft)] hover:text-[var(--text)]"}`}>
        {l.label}
      </Link>
    );
  });
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070b1a]/85 backdrop-blur-md">
      <nav aria-label="Main" className="relative mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-2.5 sm:px-8">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 font-display text-[19px] font-normal tracking-tight text-[var(--text)] no-underline">
          <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden="true">
            <circle cx="14" cy="14" r="11" fill="none" stroke="#5eead4" strokeWidth="2" />
            <path d="M5 17 L10 12 L14 15 L19 8 L23 11" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          trend detective
        </Link>
        <div className="flex items-center gap-1">
          <div className="hidden items-center gap-1 lg:flex">{links("inline-flex min-h-11 items-center")}</div>
          <InstallButton className="ml-1 hidden sm:inline-flex" />
          {!onExplore && (
            <Link href="/explore" className="ml-2 hidden min-h-11 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#04211d] no-underline hover:bg-[#99f6e4] hover:text-[#04211d] sm:inline-flex">
              Open a case <span aria-hidden="true">→</span>
            </Link>
          )}
          <button type="button" aria-expanded={open} aria-controls="nav-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}
            className="ml-1 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-[var(--text)] lg:hidden">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {open ? <path d="M4 4 L14 14 M14 4 L4 14" /> : <path d="M2 5 H16 M2 9 H16 M2 13 H16" />}
            </svg>
          </button>
        </div>
        {open && (
          <div id="nav-menu" className="absolute right-4 top-full mt-2 flex w-60 flex-col gap-1 rounded-[20px] border border-white/10 bg-[#0f1730] p-2 shadow-2xl sm:right-8 lg:hidden">
            {links("flex min-h-11 items-center")}
            <InstallButton className="mt-1 justify-center sm:hidden" />
            {!onExplore && <Link href="/explore" onClick={() => setOpen(false)} className="btn btn-primary mt-1 justify-center text-[14px]">Open a case →</Link>}
          </div>
        )}
      </nav>
    </header>
  );
}
