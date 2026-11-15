import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-5 py-28 text-center">
      <p className="font-display text-[96px] font-extralight leading-none text-[var(--accent)]">404</p>
      <h1 className="text-[28px] font-bold">No signal here, just noise.</h1>
      <p className="max-w-[460px] text-[var(--soft)]">This page doesn&apos;t exist. Try a demo case or pick a place to investigate.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">Back to the start</Link>
        <Link href="/explore" className="btn btn-ghost">Explore a place</Link>
      </div>
    </div>
  );
}
