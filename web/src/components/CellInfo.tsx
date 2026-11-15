"use client";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { NICE, VERDICT, WF, fmt, pfmt, signed, type Grid, type Meta } from "@/lib/data";
import { Badge } from "@/components/ui";
import { trendColor, type Mode, type Pick } from "./Globe";

const latLon = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(0)}°${lon >= 0 ? "E" : "W"}`;
const latLon1 = (lat: number, lon: number, sep: string) =>
  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}${sep}${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;

/** The numbers for one picked square (shared by the panel and the globe's HUD annotation). */
function cellStats(grid: Grid | null, v: string, pick: Pick | null, mode: Mode, enso: boolean) {
  const k = pick?.k ?? -1;
  const ok = !!grid && grid.var === v && pick != null && grid.slope_decade[k] != null;
  // El Niño removal only changes the strict test, so only use it when that's what the map shows.
  const useEnso = enso && mode === "real";
  const slope = ok ? (useEnso ? grid.slope_enso_decade[k] : grid.slope_decade[k]) : 0;
  const q = ok ? (useEnso ? grid.q_enso[k] : grid.q[k]) : 1;
  const verdict = ok ? (q < 0.05 ? "significant" : grid.p_hr[k] < 0.2 ? "possible" : "none") : "none";
  return { k, ok, useEnso, slope, q, verdict };
}

/** Mono HUD label lines for the picked square, e.g. `66.5°N · 12.5°E` / `T2M +0.47 °C/DEC` / `q < 0.0001 ▸ REAL SIGNAL`. Empty when there is no data. */
export function hudLines(grid: Grid | null, v: string, pick: Pick | null, mode: Mode, enso: boolean): string[] | undefined {
  if (!pick) return undefined;
  const { ok, slope, q, verdict } = cellStats(grid, v, pick, mode, enso);
  const head = latLon1(pick.lat, pick.lon, " · ");
  if (!ok) return [head, `${v} · NO DATA HERE`];
  return [head, `${v} ${signed(slope)} ${NICE[v].units}/DEC`, `${q < 0.0001 ? "q < 0.0001" : `q = ${fmt(q, 2)}`} ▸ ${VERDICT[verdict].label}`];
}

const TONE = { real: "real", maybe: "maybe", none: "none" } as const;

/** Everything we know about one clicked map square, in the site's plain words. */
export function CellInfo({ meta, grid, v, pick, mode, enso, onClose }: {
  meta: Meta; grid: Grid | null; v: string; pick: Pick | null; mode: Mode; enso: boolean; onClose: () => void;
}) {
  const n = NICE[v];
  const { k, ok, useEnso, slope, q, verdict } = cellStats(grid, v, pick, mode, enso);
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
            className="glass-strong flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="hud text-ink-dim">Square · <span className="num">{latLon1(pick.lat, pick.lon, " ")}</span></p>
                <p className="mt-1 font-display text-xl text-ink">{latLon(pick.lat, pick.lon)}</p>
                <p className="hud mt-0.5 text-ink-faint">about 250 km across</p>
                {inside.length > 0 && <p className="mt-1 text-sm text-ink-dim">Inside: {inside.map((r: { name: string }) => r.name).join(", ")}</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="Close square details"
                className="glass hud inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center !rounded-full text-ink hover:border-signal/50">✕</button>
            </div>
            {!ok ? (
              <p className="text-[15px] text-ink-dim">No {n.noun} data here: {why}.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="num font-display text-3xl" style={{ color: trendColor(v, Math.sign(slope)) }}>{signed(slope)} {n.units}</span>
                  <span className="text-[15px] text-ink-dim">per decade{useEnso ? " with El Niño removed" : ""}, about <span className="num">{signed(slope * span / 10)} {n.units}</span> since {meta.years[0]}</span>
                </div>
                <p className="text-sm text-ink-dim">Typical value here: <span className="num">{fmt(grid.mean[k], 3)} {n.units}</span></p>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px] text-ink">
                  <li className="flex justify-between gap-3"><span className="text-ink-dim">Simple test</span><span>{grid.p_naive[k] < 0.05 ? "looks like a trend" : "no trend"} <span className="num text-ink-dim">(p {pfmt(grid.p_naive[k])})</span></span></li>
                  <li className="flex justify-between gap-3"><span className="text-ink-dim">Strict test (false-alarm rate)</span><span className="num">{q < 0.0001 ? "under 0.01%" : `${fmt(q * 100, 2)}%`}</span></li>
                  {grid.wf[k] != null && <li className="flex justify-between gap-3"><span className="text-ink-dim">Holding up over time</span><span className="text-right">{WF[grid.wf[k]].label}</span></li>}
                </ul>
                <p className="flex flex-wrap items-center gap-2 text-[15px] text-ink">Verdict for this square: <Badge tone={TONE[vd.tone]}>{vd.label}</Badge>
                  {mode !== "real" && <span className="text-[13px] text-ink-dim"> (from the strict test, whatever step the map shows)</span>}</p>
                {mode === "noise" && (
                  <p className="text-[13px] text-ink-dim">
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
