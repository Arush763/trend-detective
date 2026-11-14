"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/#cases", label: "Demo cases", match: "" },
  { href: "/explore", label: "Explore", match: "/explore" },
  { href: "/globe", label: "Globe", match: "/globe" },
  { href: "/how", label: "How it works", match: "/how" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070b1a]/70 backdrop-blur-xl">
      <nav aria-label="Main" className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-display text-[19px] font-normal tracking-tight text-[var(--text)] no-underline">
          <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden="true">
            <circle cx="14" cy="14" r="11" fill="none" stroke="#5eead4" strokeWidth="2" />
            <path d="M5 17 L10 12 L14 15 L19 8 L23 11" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          trend detective
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          {LINKS.map((l) => {
            const on = l.match && path.startsWith(l.match);
            return (
              <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}
                className={`rounded-full px-3 py-2.5 text-[12px] uppercase tracking-[0.12em] no-underline ${on ? "text-[var(--text)]" : "text-[var(--soft)] hover:text-[var(--text)]"}`}>
                {l.label}
              </Link>
            );
          })}
          <Link href="/explore" className="ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#04211d] no-underline hover:bg-[#99f6e4] hover:text-[#04211d]">
            Open a case <span aria-hidden="true">→</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
