"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { NICE, get, type Grid, type Meta } from "@/lib/data";
import { Globe, GlobeScale, cellAt, type Mode, type Pick } from "@/components/Globe";
import { CellInfo } from "@/components/CellInfo";

const STEPS: { mode: Mode; step: string; noun: string; text: string; color: string }[] = [
  { mode: "naive", step: "Step 1 · The simple test", noun: "places look like they have a trend", color: "#c7d2fe",
    text: "Each place checked on its own. That's how most maps are made, but it lets luck in." },
  { mode: "noise", step: "Step 2 · The luck test", noun: "false alarms from shuffled data", color: "#fbbf24",
    text: "We scrambled every place's years so no real trend is left. The simple test still \"finds\" a trend in about 1 place in 20. That's pure luck." },
  { mode: "real", step: "Step 3 · The strict test", noun: "places with a real signal", color: "#5eead4",
    text: "Corrected for years that resemble each other and for testing every place at once. Of the squares that survive, at most about 1 in 20 should be a false alarm." },
];
const n0 = (x: number) => x.toLocaleString("en-US");

export default function GlobePage() {
  const [meta, setMeta] = useState<Meta>(null);
  const [v, setV] = useState("T2M");
  const [grid, setGrid] = useState<Grid>(null);
  const [mode, setMode] = useState<Mode>("naive");
  const [enso, setEnso] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    get("meta.json").then((m) => {
      setMeta(m);
      // ?v= picks the variable (e.g. from a case's verdict). Read after commit, not during render: see explore/page.tsx.
      const q = new URLSearchParams(window.location.search).get("v");
      if (q && m.grid_summary[q]) setV(q);
    }).catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => {
    let live = true;
    get(`grid/${v}.json`).then((x) => live && setGrid(x)).catch((e) => live && setErr(String(e)));
    return () => { live = false; };
  }, [v]);
  if (err) return <p className="text-red-300">Could not load the data ({err}). Try reloading the page.</p>;
  if (!meta) return <p className="text-[var(--muted)]" role="status">Loading NASA data…</p>;
  const s = meta.grid_summary[v];
  const count = (m: Mode) => ({ naive: s.naive_sig, noise: s.noise_sig, real: enso ? s.enso_real_sig : s.real_sig }[m]);
  const g = grid?.var === v ? grid : null; // the numbers wait for the new variable; the globe keeps the old picture meanwhile
  const choose = (k: string) => { setV(k); window.history.replaceState(null, "", `/globe?v=${k}`); };
  const jump = (id: string) => {
    const r = meta.regions.find((x: any) => x.id === id);
    if (r && g) setPick(cellAt(g, meta.grid.lat, meta.grid.lon, { lat: (r.box[0] + r.box[1]) / 2, lng: (r.box[2] + r.box[3]) / 2 }));
  };

  return (
    <div className="flex flex-col gap-7">
      <header className="flex max-w-[760px] flex-col gap-2.5">
        <h1 className="text-balance font-display text-[clamp(36px,4.5vw,56px)] font-light leading-[1.05] tracking-tight">Signal or noise? See it on the globe</h1>
        <p className="text-pretty text-lg leading-relaxed text-[var(--soft)]">We tested every square of the planet for a trend since 1980. Step through the three tests and watch the false alarms disappear.</p>
      </header>

      <div className="-mx-4 flex flex-nowrap items-center gap-2.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="What to map">
        <span className="mr-1.5 shrink-0 text-sm text-[var(--muted)]">Show</span>
        {Object.keys(meta.grid_summary).map((k) => <button key={k} type="button" className="pill shrink-0 whitespace-nowrap" aria-pressed={k === v} onClick={() => choose(k)}>{NICE[k].short}</button>)}
      </div>

      <div className="flex flex-wrap items-start gap-8">
        <figure className="m-0 flex min-w-0 flex-[1_1_520px] flex-col items-center gap-3.5">
          <div className="w-full max-w-[min(640px,82vw)]">
            <Globe grid={grid} mode={mode} enso={enso} pick={pick}
              onPick={(p) => g && setPick(cellAt(g, meta.grid.lat, meta.grid.lon, p))}
              label={`Globe of ${NICE[v].short} trends: ${STEPS.find((x) => x.mode === mode)!.step}. ${n0(count(mode))} of ${n0(s.cells)} places marked. Click a square, or use "Jump to a place", for its numbers.`} />
          </div>
          <figcaption className="flex w-full flex-col items-center gap-2">
            <GlobeScale grid={g} units={NICE[v].units} mode={mode} enso={enso} />
            <span className="text-[13px] text-[var(--muted)]">Drag to spin · pinch or scroll to zoom · tap or click a square</span>
            <label className="flex items-center gap-2 text-sm text-[var(--soft)]">Jump to a place
              <select className="pill bg-[var(--panel)]" defaultValue="" onChange={(e) => jump(e.target.value)}>
                <option value="" disabled>Choose…</option>
                {meta.regions.filter((r: any) => r.id !== "global").map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          </figcaption>
        </figure>

        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5">
          <div className="flex flex-col gap-3.5" role="group" aria-label="Which test to show">
            {STEPS.map((st) => {
              const on = st.mode === mode, c = count(st.mode);
              return (
                <button key={st.mode} type="button" aria-pressed={on} aria-describedby={`desc-${st.mode}`} onClick={() => setMode(st.mode)}
                  className="flex cursor-pointer flex-col gap-2.5 rounded-[20px] border bg-white/[0.04] px-5 py-5 text-left text-[var(--text)] transition-colors hover:bg-white/[0.07]"
                  style={{ borderColor: on ? st.color : "var(--line)", borderWidth: on ? 2 : 1, background: on ? `${st.color}14` : undefined }}>
                  <span className="text-[13px]" style={{ color: on ? st.color : "var(--muted)" }}>{st.step}</span>
                  <span className="flex items-baseline gap-2.5">
                    <span className="font-display text-[32px] font-light" style={{ color: st.mode === "naive" ? undefined : st.color }}>{n0(c)}</span>
                    <span className="text-[15px] text-[var(--soft)]">{st.noun}</span>
                  </span>
                  <span className="block h-2 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
                    <motion.span className="block h-full" style={{ background: st.color }} animate={{ width: `${(100 * c) / s.cells}%` }} transition={{ duration: 0.5 }} />
                  </span>
                  <span id={`desc-${st.mode}`} className="text-sm leading-normal text-[var(--dim)]">{st.text}</span>
                </button>
              );
            })}
          </div>
          <label className="flex min-h-11 items-center gap-2.5 px-1 text-[15px] text-[var(--soft)]">
            <input type="checkbox" className="h-[18px] w-[18px] accent-[var(--accent)]" checked={enso} onChange={(e) => setEnso(e.target.checked)} />
            <span>Remove El Niño first <span className="text-[13px] text-[var(--muted)]">(a natural Pacific cycle; changes step 3)</span></span>
          </label>
          <CellInfo meta={meta} grid={g} v={v} pick={pick} mode={mode} enso={enso} onClose={() => setPick(null)} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.p key={v} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="rounded-[20px] border border-dashed border-[var(--line)] px-6 py-5 text-[15px] leading-relaxed text-[var(--soft)]">
          <b className="text-[var(--text)]">What this shows for {NICE[v].noun}: </b>
          {n0(s.naive_sig)} places pass the simple test, and {n0(s.real_sig)} survive the strict one
          ({Math.round((100 * s.real_sig) / Math.max(s.naive_sig, 1))}% of them). Meanwhile, shuffled data with no trend at all still fooled the simple test in {n0(s.noise_sig)} places.
          {meta.variables[v].caveat ? ` Caution: ${meta.variables[v].caveat}` : ""}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
