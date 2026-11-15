import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

// Shown by the service worker when you're offline and open a page that was never saved.
export default function Offline() {
  return (
    <div className="flex flex-col items-center gap-5 py-24 text-center">
      <p className="eyebrow">No connection</p>
      <h1 className="text-balance font-display text-[clamp(36px,5vw,56px)] font-light leading-tight tracking-tight">You&apos;re offline, but the evidence isn&apos;t.</h1>
      <p className="max-w-[520px] text-pretty text-lg text-[var(--soft)]">
        This page wasn&apos;t saved yet. Everything below works offline: every place&apos;s NASA data was saved the first time you opened the app.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/explore" className="btn btn-primary">Explore a place</Link>
        <Link href="/compare" className="btn btn-ghost">Case 04: opposite trends</Link>
        <Link href="/" className="btn btn-ghost">Home</Link>
      </div>
      <p className="max-w-[520px] text-sm text-[var(--muted)]">The globe needs each measurement&apos;s map file; air temperature is saved, the others are saved once you view them online.</p>
    </div>
  );
}
