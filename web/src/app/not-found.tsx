import { Button, Card, Hud } from "@/components/ui";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex justify-center py-20">
      <Card className="flex w-full max-w-[560px] flex-col items-start gap-5 p-8 sm:p-10">
        <Hud className="text-[var(--false-alarm)]">ERROR_404 · PAGE NOT FOUND</Hud>
        <h1 className="text-balance font-display text-[clamp(40px,6vw,64px)] leading-[0.95] tracking-[-0.03em]">No signal here, just noise.</h1>
        <p className="max-w-[46ch] text-[var(--ink-dim)]">This page doesn&apos;t exist. Try a demo case or pick a place to investigate.</p>
        <div className="flex flex-wrap gap-3">
          <Button href="/" variant="primary">Back to the start</Button>
          <Button href="/explore" variant="glass">Explore a place</Button>
        </div>
      </Card>
    </div>
  );
}
