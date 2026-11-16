"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { DEMOS, get, type Grid, type Meta, type Region } from "@/lib/data";
import { CasesScene, ChecksScene, EndBeat, HeroScene, MissionScene, NoiseScene, SmoothScroll, StoryGlobe } from "@/components/Scenes";
import { Leaderboard } from "@/components/Leaderboard";

// The landing page is five scroll-scrubbed scenes over one story globe that follows them.
export default function Landing() {
  const [meta, setMeta] = useState<Meta>(null);
  const [grid, setGrid] = useState<Grid>(null);
  const [cases, setCases] = useState<Record<string, Region>>({});

  useEffect(() => {
    get("meta.json").then(setMeta).catch(() => {});
    get("grid/T2M.json").then(setGrid).catch(() => {});
    ["amazon", "himalaya"].forEach((id) => get(`regions/${id}.json`).then((r) => setCases((c) => ({ ...c, [id]: r }))).catch(() => {}));
    DEMOS.forEach((d) => get(`regions/${d.place}.json`).then((r) => setCases((c) => ({ ...c, [d.id]: r }))).catch(() => {}));
  }, []);

  // -mt-24 cancels main's pt-24 so the pinned hero stage fills the screen from the very top (its card sits below the floating nav);
  // -mb-20 cancels main's bottom padding so the end beat meets the footer.
  return (
    <div className="-mb-20 -mt-24">
      <SmoothScroll />
      <StoryGlobe grid={grid} meta={meta} />
      <HeroScene cells={meta?.grid_summary.T2M.cells} />
      {/* Solid ground: numbers never sit on top of the story globe. */}
      <section className="bleed relative bg-[var(--ground)] px-4 py-20 sm:px-8">
        <div className="mx-auto flex max-w-[900px] flex-col gap-6">
          {meta && <Leaderboard meta={meta} />}
          <Link href="/lab" className="glass flex items-center justify-between gap-4 px-5 py-4 text-ink no-underline">
            <span><span className="hud block">The lab</span><span className="text-[17px]">Think you can fool the detector? Hide a trend in noise, or fake one.</span></span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
      <MissionScene meta={meta} />
      <NoiseScene meta={meta} grid={grid} />
      <CasesScene cases={cases} />
      <ChecksScene />
      <EndBeat />
    </div>
  );
}
