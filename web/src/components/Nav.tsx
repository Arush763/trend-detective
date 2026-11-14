"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/#cases", label: "Demo cases", match: "" },
  { href: "/explore", label: "Explore a place", match: "/explore" },
  { href: "/globe", label: "Globe", match: "/globe" },
  { href: "/how", label: "How it works", match: "/how" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center justify-between gap-4 pt-7">
      <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-bold text-[var(--text)] no-underline">
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <circle cx="14" cy="14" r="11" fill="none" stroke="#5eead4" strokeWidth="2" />
          <path d="M5 17 L10 12 L14 15 L19 8 L23 11" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Trend Detective
      </Link>
      <div className="flex flex-wrap gap-1">
        {LINKS.map((l) => {
          const on = l.match && path.startsWith(l.match);
          return (
            <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}
              className={`border-b-2 px-3.5 py-3 text-[15px] no-underline ${on ? "border-[var(--accent)] text-[var(--text)]" : "border-transparent text-[var(--soft)] hover:text-[var(--text)]"}`}>
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
