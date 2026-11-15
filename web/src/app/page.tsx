"use client";
import { useEffect, useState } from "react";
import { DEMOS, get, type Grid, type Meta, type Region } from "@/lib/data";
import { CasesScene, ChecksScene, HeroScene, MissionScene, NoiseScene, SmoothScroll } from "@/components/Scenes";

// The landing page is five scroll-scrubbed scenes: each pins to the screen while you scroll through it.
export default function Landing() {
  const [meta, setMeta] = useState<Meta>(null);
  const [grid, setGrid] = useState<Grid>(null);
  const [cases, setCases] = useState<Record<string, Region>>({});

  useEffect(() => {
    get("meta.json").then(setMeta).catch(() => {});
    get("grid/T2M.json").then(setGrid).catch(() => {});
    DEMOS.forEach((d) => get(`regions/${d.place}.json`).then((r) => setCases((c) => ({ ...c, [d.id]: r }))).catch(() => {}));
  }, []);

  return (
    <div className="-mb-20 -mt-8">
      <SmoothScroll />
      <HeroScene grid={grid} cells={meta?.grid_summary.T2M.cells} />
      <MissionScene meta={meta} />
      <NoiseScene meta={meta} grid={grid} />
      <CasesScene cases={cases} />
      <ChecksScene />
    </div>
  );
}
