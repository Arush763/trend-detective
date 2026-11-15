"use client";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { NICE, VERDICT, WF, fmt, pfmt, signed, type Grid, type Meta } from "@/lib/data";
import { trendColor, type Mode, type Pick } from "./Globe";

const latLon = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(0)}°${lon >= 0 ? "E" : "W"}`;

/** Everything we know about one clicked map square, in the site's plain words. */
export function CellInfo({ meta, grid, v, pick, mode, enso, onClose }: {
  meta: Meta; grid: Grid | null; v: string; pick: Pick | null; mode: Mode; enso: boolean; onClose: () => void;
}) {
  const n = NICE[v];
  const k = pick?.k ?? -1;
  const ok = !!grid && grid.var === v && pick != null && grid.slope_decade[k] != null;
  // El Niño removal only changes the strict test, so only use it when that's what the map shows.
  const useEnso = enso && mode === "real";
  const slope = ok ? (useEnso ? grid.slope_enso_decade[k] : grid.slope_decade[k]) : 0;
  const q = ok ? (useEnso ? grid.q_enso[k] : grid.q[k]) : 1;
  const verdict = ok ? (q < 0.05 ? "significant" : grid.p_hr[k] < 0.2 ? "possible" : "none") : "none";
  const vd = VERDICT[verdict];
  const span = meta.years.at(-1) - meta.years[0];
  const inside = pick ? meta.regions.filter((r: { id: string; box: number[] }) => r.id !== "global" &&
    pick.lat >= r.box[0] - 1 && pick.lat <= r.box[1] + 1 && pick.lon >= r.box[2] - 1.25 && pick.lon <= r.box[3] + 1.25) : [];
  const why = v === "SNOMAS" ? "there's almost never snow here, or it never changes from year to year"
    : meta.grid_summary[v].cells < 10000 ? "this is ocean or an ice sheet, and this measurement only covers land" : "this square has too little data";

  // On phones the panel opens below the globe, often off-screen: bring it into view.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pick && window.innerWidth < 1024) box.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  }, [pick]);

  return (
    <div ref={box} aria-live="polite" aria-atomic="true">
      <AnimatePresence mode="wait">
        {pick && (
          <motion.div key={`${k}-${v}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            role="region" aria-label="Details for the square you picked"
            className="flex flex-col gap-3 rounded-[20px] border border-[var(--line)] bg-[#0f1730]/90 p-5 backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">The square you picked · about 250 km across</p>
                <p className="mt-1 font-display text-xl font-normal">{latLon(pick.lat, pick.lon)}</p>
                {inside.length > 0 && <p className="text-sm text-[var(--soft)]">Inside: {inside.map((r: { name: string }) => r.name).join(", ")}</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="Close square details" className="pill !min-h-10 !px-3.5">✕</button>
            </div>
            {!ok ? (
              <p className="text-[15px] text-[var(--soft)]">No {n.noun} data here: {why}.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-3xl font-light" style={{ color: trendColor(v, Math.sign(slope)) }}>{signed(slope)} {n.units}</span>
                  <span className="text-[15px] text-[var(--soft)]">per decade{useEnso ? " with El Niño removed" : ""}, about {signed(slope * span / 10)} {n.units} since {meta.years[0]}</span>
                </div>
                <p className="text-sm text-[var(--muted)]">Typical value here: {fmt(grid.mean[k], 3)} {n.units}</p>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px]">
                  <li className="flex justify-between gap-3"><span className="text-[var(--soft)]">Simple test</span><span>{grid.p_naive[k] < 0.05 ? "looks like a trend" : "no trend"} <span className="text-[var(--muted)]">(p {pfmt(grid.p_naive[k])})</span></span></li>
                  <li className="flex justify-between gap-3"><span className="text-[var(--soft)]">Strict test (false-alarm rate)</span><span>{q < 0.0001 ? "under 0.01%" : `${fmt(q * 100, 2)}%`}</span></li>
                  {grid.wf[k] != null && <li className="flex justify-between gap-3"><span className="text-[var(--soft)]">Holding up over time</span><span className="text-right">{WF[grid.wf[k]].label}</span></li>}
                </ul>
                <p className="text-[15px]">Verdict for this square: <b style={{ color: vd.tone === "real" ? "var(--accent)" : vd.tone === "maybe" ? "var(--maybe)" : "var(--soft)" }}>{vd.label}</b>
                  {mode !== "real" && <span className="text-[13px] text-[var(--muted)]"> (from the strict test, whatever step the map shows)</span>}</p>
                {mode === "noise" && (
                  <p className="text-[13px] text-[var(--muted)]">
                    On the luck-test map, this square&apos;s shuffled copy {grid.p_noise[k] < 0.05 ? "fooled the simple test (a false alarm)" : "did not fool the simple test"}. That copy is a demonstration; it says nothing about this square&apos;s real trend.
                  </p>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
