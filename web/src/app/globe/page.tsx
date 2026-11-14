"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { NICE, fmt, get, type Grid, type Meta } from "@/lib/data";
import { Globe, GlobeScale, cellAt, type Mode, type Pick } from "@/components/Globe";
import { CellInfo } from "@/components/CellInfo";

const STEPS: { mode: Mode; step: string; noun: string; text: string; color: string }[] = [
  { mode: "naive", step: "Step 1 · The simple test", noun: "places look like they have a trend", color: "#c7d2fe",
    text: "Each place checked on its own. That's how most maps are made, but it lets luck in." },
  { mode: "noise", step: "Step 2 · The luck test", noun: "false alarms from shuffled data", color: "#fbbf24",
    text: "We scrambled every place's years so no real trend is left. The simple test still \"finds\" a trend in about 1 place in 20. That's pure luck." },
  { mode: "real", step: "Step 3 · The strict test", noun: "places with a real signal", color: "#5eead4",
    text: "Corrected for years that resemble each other and for testing every place at once. What's left is very unlikely to be luck." },
];

export default function GlobePage() {
  const [meta, setMeta] = useState<Meta>(null);
  const [v, setV] = useState("T2M");
  const [grid, setGrid] = useState<Grid>(null);
  const [mode, setMode] = useState<Mode>("naive");
  const [enso, setEnso] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);

  useEffect(() => { get("meta.json").then(setMeta); }, []);
  useEffect(() => { get(`grid/${v}.json`).then(setGrid); }, [v]);
  if (!meta) return <p className="text-[var(--muted)]">Loading NASA data…</p>;
  const s = meta.grid_summary[v];
  const count = (m: Mode) => ({ naive: s.naive_sig, noise: s.noise_sig, real: enso ? s.enso_real_sig : s.real_sig }[m]);
  const g = grid?.var === v ? grid : null;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex max-w-[760px] flex-col gap-2.5">
        <h1 className="text-[36px] font-bold leading-tight sm:text-[44px]">Signal or noise? See it on the globe</h1>
        <p className="text-lg leading-relaxed text-[var(--soft)]">We tested every square of the planet for a trend since 1980. Step through the three tests and watch the false alarms disappear.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label="What to map">
        <span className="mr-1.5 text-sm text-[var(--muted)]">Show</span>
        {Object.keys(meta.grid_summary).map((k) => <button key={k} type="button" className="pill" aria-pressed={k === v} onClick={() => setV(k)}>{NICE[k].short}</button>)}
      </div>

      <div className="flex flex-wrap items-start gap-8">
        <figure className="m-0 flex min-w-0 flex-[1_1_520px] flex-col items-center gap-3.5">
          <div className="w-full max-w-[640px]">
            <Globe grid={g} mode={mode} enso={enso} pick={pick}
              onPick={(p) => g && setPick(cellAt(g, meta.grid.lat, meta.grid.lon, p))}
              label={`Globe of ${NICE[v].short} trends: ${STEPS.find((x) => x.mode === mode)!.step}. ${count(mode)} of ${s.cells} places marked. Click a spot for its numbers.`} />
          </div>
          <figcaption className="flex w-full flex-col items-center gap-2">
            <GlobeScale grid={g} units={NICE[v].units} mode={mode} />
            <span className="text-[13px] text-[var(--muted)]">Drag to spin · scroll to zoom · click a spot</span>
          </figcaption>
        </figure>

        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5" role="group" aria-label="Which test to show">
          <CellInfo meta={meta} grid={g} v={v} pick={pick} mode={mode} enso={enso} onClose={() => setPick(null)} />
          {STEPS.map((st) => {
            const on = st.mode === mode, c = count(st.mode);
            return (
              <button key={st.mode} type="button" aria-pressed={on} onClick={() => setMode(st.mode)}
                className="flex cursor-pointer flex-col gap-2.5 rounded-[18px] border bg-white/[0.03] px-5 py-5 text-left text-[var(--text)] transition-colors hover:bg-white/[0.06]"
                style={{ borderColor: on ? st.color : "var(--line)", borderWidth: on ? 2 : 1, background: on ? `${st.color}14` : undefined }}>
                <span className="text-[13px]" style={{ color: on ? st.color : "var(--muted)" }}>{st.step}{on && " (showing)"}</span>
                <span className="flex items-baseline gap-2.5">
                  <span className="font-display text-[32px] font-bold" style={{ color: st.mode === "naive" ? undefined : st.color }}>{c.toLocaleString()}</span>
                  <span className="text-[15px] text-[var(--soft)]">{st.noun}</span>
                </span>
                <span className="block h-2 overflow-hidden rounded-full bg-white/[0.07]">
                  <motion.span className="block h-full" style={{ background: st.color }} animate={{ width: `${(100 * c) / s.cells}%` }} transition={{ duration: 0.5 }} />
                </span>
                <span className="text-sm leading-normal text-[#a9b6d3]">{st.text}</span>
              </button>
            );
          })}
          <label className="flex min-h-11 items-center gap-2.5 px-1 text-[15px] text-[var(--soft)]">
            <input type="checkbox" className="h-[18px] w-[18px] accent-[var(--accent)]" checked={enso} onChange={(e) => setEnso(e.target.checked)} />
            Remove El Niño first <span className="text-[13px] text-[var(--muted)]">(a natural Pacific cycle; changes step 3)</span>
          </label>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.p key={v} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="rounded-2xl border border-dashed border-[var(--line)] px-6 py-5 text-[15px] leading-relaxed text-[var(--soft)]">
          <b className="text-[var(--text)]">What this shows for {NICE[v].noun}: </b>
          {fmt(s.naive_sig, 5)} places pass the simple test, and {fmt(s.real_sig, 5)} survive the strict one
          ({Math.round((100 * s.real_sig) / Math.max(s.naive_sig, 1))}% of them). Meanwhile, shuffled data with no trend at all still fooled the simple test in {fmt(s.noise_sig, 5)} places.
          {v === "DUEXTTAU" || v === "TOTEXTTAU" ? ` Caution: ${meta.variables[v].caveat}` : ""}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
