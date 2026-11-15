import type { Metadata } from "next";
import { Button, Card, Hud } from "@/components/ui";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

// Shown by the service worker when you're offline and open a page that was never saved.
// Self-sufficient on purpose: no data fetches.
export default function Offline() {
  return (
    <div className="flex justify-center py-20">
      <Card className="flex w-full max-w-[600px] flex-col items-start gap-5 p-8 sm:p-10">
        <Hud className="text-[var(--ink-dim)]">OFFLINE · NO CONNECTION</Hud>
        <h1 className="text-balance font-display text-[clamp(40px,6vw,64px)] leading-[0.95] tracking-[-0.03em]">You&apos;re offline, but the evidence isn&apos;t.</h1>
        <p className="max-w-[52ch] text-pretty text-lg text-[var(--ink-dim)]">
          This page wasn&apos;t saved yet. Everything below works offline: every place&apos;s NASA data was saved the first time you opened the app.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button href="/explore" variant="primary">Explore a place</Button>
          <Button href="/compare" variant="glass">Case 04: opposite trends</Button>
          <Button href="/" variant="glass">Home</Button>
        </div>
        <p className="max-w-[52ch] text-sm text-[var(--ink-dim)]">The globe needs each measurement&apos;s map file; air temperature is saved, the others are saved once you view them online.</p>
      </Card>
    </div>
  );
}
