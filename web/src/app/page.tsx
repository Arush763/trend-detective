"use client";
// shortcut: canvas map + hand-drawn SVG chart instead of MapLibre/Recharts; enough for a 2-day build.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Meta = any;
type Region = any;
type Grid = any;

const get = (path: string) => fetch(`/data/${path}`).then((r) => {
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
});
const fmt = (x: number | null | undefined, d = 3) => (x == null ? "n/a" : Number(x.toPrecision(d)).toString());
const rise = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.35 } };
const VERDICT_STYLE: Record<string, string> = {
  significant: "bg-emerald-400/20 text-emerald-200 border-emerald-300/40",
  possible: "bg-amber-400/20 text-amber-200 border-amber-300/40",
  none: "bg-white/10 text-slate-300 border-white/20",
};
const Verdict = ({ v }: { v: string }) => <span className={`rounded-full border px-2 py-0.5 text-xs ${VERDICT_STYLE[v]}`}>{v}</span>;

export default function Home() {
  const [meta, setMeta] = useState<Meta>(null);
  const [err, setErr] = useState("");
  const [regionId, setRegionId] = useState("");
  const [region, setRegion] = useState<Region>(null);
  const [v, setV] = useState("T2M");
  const [enso, setEnso] = useState(false);
  const [mode, setMode] = useState<Mode>("naive");
  const [type, setType] = useState("");
  const [story, setStory] = useState("");
  const pendingVar = useRef("");

  useEffect(() => { get("meta.json").then(setMeta).catch((e) => setErr(String(e))); }, []);
  useEffect(() => {
    if (!regionId) return;
    get(`regions/${regionId}.json`).then((r) => {
      setRegion(r);
      setV(pendingVar.current || r.screener[0]);
      pendingVar.current = "";
    }).catch((e) => setErr(String(e)));
  }, [regionId]);

  if (err) return <p className="p-6 text-red-300">Could not load data ({err}). Run pipeline/build.py, then npm run data.</p>;
  if (!meta) return <p className="p-6 muted">Loading NASA data…</p>;
  const info = region && region.id === regionId ? region : null;
  const types: string[] = [...new Set<string>(meta.regions.map((r: any) => r.type))];
  const pick = (id: string) => { setStory(""); setRegionId(id); };
  const demo = (c: (typeof DEMOS)[number]) => {
    if (c.region !== regionId) pendingVar.current = c.v; // the region load would otherwise reset v
    setRegionId(c.region); setV(c.v); setMode(c.mode); setEnso(false); setStory(c.story);
  };

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest muted">NASA Space Apps 2026 · Earth System Trend Detective</p>
        <h1 className="text-4xl font-bold">Signal or Noise?</h1>
        <p className="max-w-3xl muted">Test thousands of places for a trend and about 1 in 20 will look &quot;significant&quot; by pure luck.
          Trend Detective runs 46 years of NASA MERRA-2 data through the checks luck can&apos;t pass, and shows which trends are real.</p>
      </header>

      <section className="glass">
        <h2 className="font-semibold">Watch a demo case</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {DEMOS.map((c) => <button key={c.title} onClick={() => demo(c)} className={`chip ${story === c.story ? "chip-on" : ""}`}>{c.title}</button>)}
        </div>
        <AnimatePresence mode="wait">
          {story && <motion.p key={story} {...rise} className="mt-3 rounded-xl border border-teal-300/40 bg-teal-300/10 p-3 text-sm">{story}</motion.p>}
        </AnimatePresence>
      </section>

      <section className="glass">
        <h2 className="font-semibold">1. Open a case: what kind of place are you investigating?</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {types.map((t) => (
            <button key={t} onClick={() => setType(t === type ? "" : t)} className={`chip ${t === type ? "chip-on" : ""}`}>{t}</button>
          ))}
        </div>
        <p className="mt-3 text-sm muted">Then pick a region{type && ` (${type})`}:</p>
        <motion.div layout className="mt-1 flex flex-wrap gap-2">
          {meta.regions.filter((r: any) => !type || r.type === type).map((r: any) => (
            <motion.button layout key={r.id} onClick={() => pick(r.id)} className={`chip ${r.id === regionId ? "chip-on" : ""}`}>
              {r.name}
            </motion.button>
          ))}
        </motion.div>
      </section>

      <AnimatePresence mode="wait">
        {info && (
          <motion.div key={info.id} {...rise} className="space-y-5">
            <section className="glass">
              <p><b>{info.name}</b> <span className="muted">({info.type})</span>: {info.blurb}</p>
              <h2 className="mt-3 font-semibold">2. Earth Screener: variables ranked by signal-to-noise</h2>
              <div className="overflow-x-auto">
                <table className="mt-2 w-full text-left text-sm">
                  <thead><tr><th>Variable</th><th>Trend / decade</th><th>q (FDR)</th><th>Signal/noise</th><th>Verdict</th></tr></thead>
                  <tbody>
                    {info.screener.map((k: string) => {
                      const d = info.variables[k];
                      const sugg = meta.regions.find((r: any) => r.id === info.id).suggested.includes(k);
                      return (
                        <tr key={k} onClick={() => setV(k)}
                          className={`cursor-pointer border-t border-white/10 transition-colors hover:bg-white/5 ${k === v ? "bg-white/10" : ""}`}>
                          <td>{meta.variables[k].name}{sugg && <span className="text-teal-300"> ★</span>}<div className="text-xs muted">{meta.variables[k].definition}</div></td>
                          <td className="whitespace-nowrap">{fmt(d.slope_decade)} {meta.variables[k].units}</td>
                          <td>{fmt(d.q)}</td><td>{fmt(d.snr)}</td><td><Verdict v={d.verdict} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-xs muted"><span className="text-teal-300">★</span> = suggested for a {info.type} region. Click a row to open its case file.</p>
            </section>

            <CaseFile meta={meta} info={info} v={v} enso={enso} setEnso={setEnso} />
          </motion.div>
        )}
      </AnimatePresence>

      <MapPanel meta={meta} v={v} enso={enso} box={info?.box} mode={mode} setMode={setMode} />

      {meta.sanity && (
        <section className="glass text-sm">
          <h2 className="font-semibold">Sanity check: does our pipeline reproduce known science?</h2>
          <p className="mt-1 muted">
            MERRA-2 {meta.years[0]}–{meta.years.at(-1)}: global {meta.sanity.global_T2M_decade} °C/decade, Arctic {meta.sanity.arctic_T2M_decade} °C/decade,
            ratio {meta.sanity.ratio}.
            {meta.sanity.matched && <> Same years as the published study ({meta.sanity.matched.years.join("–")}): global {meta.sanity.matched.global_T2M_decade},
              Arctic {meta.sanity.matched.arctic_T2M_decade}, ratio {meta.sanity.matched.ratio}.</>}
            {" "}Reference: {meta.sanity.reference}. {meta.sanity.note}
          </p>
        </section>
      )}
      <footer className="text-xs muted">Data: {meta.sources.data}. ENSO: {meta.sources.enso}. Coastlines: Natural Earth.</footer>
    </main>
  );
}

function CaseFile({ meta, info, v, enso, setEnso }: any) {
  const d = info.variables[v];
  const u = meta.variables[v].units;
  const years: number[] = meta.years;
  // ENSO removed: subtract the fitted El Niño part, same as stats.remove_enso
  const series: number[] = d.annual.map((y: number, i: number) => (enso ? y - d.enso_coef * meta.enso_annual[i] : y));
  const slope = (enso ? d.slope_enso_decade : d.slope_decade) / 10;
  const p = enso ? d.p_enso_hr : d.p_hr;
  const wf = d.walk_forward;
  return (
    <motion.section key={v} {...rise} className="glass space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">3. Case file: {meta.variables[v].name} in {info.name}</h2>
        <Verdict v={d.verdict} />
      </div>
      {meta.variables[v].caveat && <p className="text-sm warn">Caution: {meta.variables[v].caveat}</p>}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-teal-300" checked={enso} onChange={(e) => setEnso(e.target.checked)} />
        Remove El Niño <span className="muted">(subtract the part of each year explained by the Pacific&apos;s El Niño / La Niña swings)</span>
      </label>
      <Chart years={years} y={series} slope={slope} intercept={d.intercept} enso={enso} units={u} />
      <ul className="space-y-1 text-sm">
        <li>Trend (Sen&apos;s slope): <b>{fmt(slope * 10)} {u}/decade</b>{!enso && <span className="muted"> (95% CI {fmt(d.ci_decade[0])} to {fmt(d.ci_decade[1])})</span>}</li>
        <li>Total change {years[0]}–{years.at(-1)}: {fmt(d.total_change)} {u}{d.pct_change != null && ` (${fmt(d.pct_change, 2)}%)`}</li>
        <li>Mann-Kendall p: naive {fmt(d.p_naive)}, autocorrelation-corrected {fmt(p)}, shuffle test {fmt(d.p_perm)}, FDR q {fmt(d.q)}</li>
        {d.verdict !== "significant" && d.years_more != null && (
          <li>Years until we&apos;d know: {d.years_more > 0
            ? <>about {d.years_more} more years of data (~{fmt(d.years_needed)} total)</>
            : <>a steady trend this size should already show up, so the data likely moves in long swings rather than a straight line; more years alone may not settle it</>}</li>
        )}
        <li>El Niño effect: {fmt(d.enso_coef)} {u} per °C of Niño 3.4 (p {fmt(d.enso_p)})</li>
        <li>Walk-forward: <b>{wf.label}</b>. <span className="muted">{wf.first.years.join("–")}: {fmt(wf.first.slope_decade)}/decade (p {fmt(wf.first.p)});
          {" "}{wf.second.years.join("–")}: {fmt(wf.second.slope_decade)}/decade (p {fmt(wf.second.p)})</span></li>
      </ul>
    </motion.section>
  );
}

function Chart({ years, y, slope, intercept, enso, units }: any) {
  const W = 800, H = 260, P = 44;
  const lo = Math.min(...y), hi = Math.max(...y), span = hi - lo || 1;
  const X = (i: number) => P + (i / (y.length - 1)) * (W - 2 * P);
  const Y = (val: number) => H - P - ((val - lo) / span) * (H - 2 * P);
  // with ENSO removed the original intercept no longer fits, so re-anchor the line on the median
  const b = enso ? median(y.map((val: number, i: number) => val - slope * i)) : intercept;
  const pts = y.map((val: number, i: number) => `${X(i)},${Y(val)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-black/20" role="img"
      aria-label={`Yearly values ${years[0]} to ${years.at(-1)} with trend line`}>
      <motion.polyline key={pts} fill="none" stroke="#c7d2fe" strokeWidth={1.5} points={pts}
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />
      {y.map((val: number, i: number) => <circle key={i} cx={X(i)} cy={Y(val)} r={2.2} fill="#c7d2fe" />)}
      <line x1={X(0)} y1={Y(b)} x2={X(y.length - 1)} y2={Y(b + slope * (y.length - 1))} stroke="#5eead4" strokeWidth={2.5} />
      <g fontSize={12} fill="#a9b6d3">
        <text x={P} y={H - 14}>{years[0]}</text>
        <text x={W - P - 30} y={H - 14}>{years.at(-1)}</text>
        <text x={4} y={P}>{fmt(hi)}</text>
        <text x={4} y={H - P}>{fmt(lo)}</text>
        <text x={W - P - 150} y={22} fill="#5eead4">— trend (Sen&apos;s slope)</text>
        <text x={P} y={22}>{units}, yearly mean</text>
      </g>
    </svg>
  );
}

const median = (a: number[]) => { const s = [...a].sort((x, z) => x - z); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const MODES = {
  naive: "Naive p<0.05",
  noise: "Noise test (shuffled data)",
  real: "Real signal (corrected + FDR)",
} as const;
type Mode = keyof typeof MODES;

const EXPLAIN: Record<Mode, string> = {
  naive: "Every grid cell tested on its own with a plain Mann-Kendall test. This is how many maps are made, but with ~13,000 tests some will pass by luck.",
  noise: "We shuffled each cell's years into random order, which destroys any real trend. Cells that still look 'significant' are pure luck: about 5% of them.",
  real: "Corrected for year-to-year memory in the data (Hamed-Rao) and for testing thousands of cells at once (Benjamini-Hochberg false discovery rate). What is left is very unlikely to be luck.",
};

// shortcut: hand-picked from the 2026-11-14 build; re-check the numbers in the story if build.py output changes.
const DEMOS: { title: string; region: string; v: string; mode: Mode; story: string }[] = [
  {
    title: "Case 1: Is the Arctic really warming?", region: "arctic", v: "T2M", mode: "real",
    story: "The Arctic warmed about 0.44 °C per decade (95% range 0.34 to 0.55), roughly 2 °C since 1980 and nearly 3 times the global rate. "
      + "It passes every check: the autocorrelation correction, the false discovery rate (q < 0.0001), and removing El Niño barely changes it. "
      + "On the map, switch between the three modes: thousands of warming cells survive the strictest test. This is a real signal.",
  },
  {
    title: "Case 2: Beijing's haze, a trend that fools the naive test", region: "beijing", v: "TOTEXTTAU", mode: "noise",
    story: "A naive test says Beijing's haze rose since 1980 (p = 0.002). But haze here climbed until the early 2010s and then fell, "
      + "so each year looks a lot like the one before. Correct for that memory and for the 184 tests in this app and it is only 'possible' (q = 0.11). "
      + "The walk-forward check shows what really happened: no clear trend 1980–2002, then a significant fall since 2003. "
      + "The map is on the noise test: shuffled data with no trend at all still lights up about 5% of cells.",
  },
];

function MapPanel({ meta, v, enso, box, mode, setMode }: { meta: Meta; v: string; enso: boolean; box?: number[]; mode: Mode; setMode: (m: Mode) => void }) {
  const [grid, setGrid] = useState<Grid>(null);
  const [coast, setCoast] = useState("");
  useEffect(() => { fetch("/coastline.txt").then((r) => r.text()).then(setCoast); }, []);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => { get(`grid/${v}.json`).then(setGrid); }, [v]);
  useEffect(() => {
    const c = ref.current;
    if (!c || !grid || grid.var !== v) return;
    const [ny, nx] = grid.shape;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(nx, ny);
    for (let r = 0; r < ny; r++) for (let x = 0; x < nx; x++) {
      const k = r * nx + x;
      const o = ((ny - 1 - r) * nx + x) * 4; // row 0 is the south pole: flip so north is up
      const s = enso && mode === "real" ? grid.slope_enso_decade[k] : grid.slope_decade[k];
      const sig = mode === "naive" ? grid.p_naive[k] < 0.05
        : mode === "noise" ? grid.p_noise[k] < 0.05
        : (enso ? grid.q_enso[k] : grid.q[k]) < 0.05;
      const rgb = s == null ? [12, 18, 36] : !sig ? [62, 72, 96] : s > 0 ? [239, 68, 68] : [59, 130, 246];
      img.data.set([...rgb, 255], o);
    }
    ctx.putImageData(img, 0, 0);
  }, [grid, mode, enso, v]);

  const s = meta.grid_summary[v];
  const count = { naive: s.naive_sig, noise: s.noise_sig, real: enso ? s.enso_real_sig : s.real_sig }[mode];
  return (
    <section className="glass space-y-3">
      <h2 className="font-semibold">4. Map: {meta.variables[v].name} trend, every grid cell</h2>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`chip ${m === mode ? "chip-on" : ""}`}>{MODES[m]}</button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={mode + v + enso} {...rise} className="space-y-1 text-sm">
          <p className="muted">{EXPLAIN[mode]}</p>
          <p><b className="text-2xl">{count.toLocaleString()}</b> of {s.cells.toLocaleString()} cells look &quot;significant&quot;
            <span className="muted"> ({fmt((100 * count) / s.cells, 2)}%)</span></p>
        </motion.div>
      </AnimatePresence>
      <div className="relative overflow-hidden rounded-xl border border-white/15" style={{ aspectRatio: "2 / 1" }}>
        <canvas ref={ref} width={meta.grid.lon.length} height={meta.grid.lat.length}
          className="absolute inset-0 h-full w-full" style={{ imageRendering: "pixelated" }}
          role="img" aria-label={`World map of ${meta.variables[v].name} trends, ${MODES[mode]}`} />
        {/* coastlines + region box drawn in lon/lat space: x = lon + 180, y = 90 - lat */}
        <svg viewBox="0 0 360 180" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path d={coast} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={0.4} />
          {box && <rect x={box[2] + 180} y={90 - box[1]} width={box[3] - box[2]} height={box[1] - box[0]}
            fill="none" stroke="#5eead4" strokeWidth={1} />}
        </svg>
      </div>
      <p className="flex flex-wrap gap-4 text-xs muted">
        <span><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" /> rising</span>
        <span><span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" /> falling</span>
        <span><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgb(62,72,96)" }} /> not significant</span>
        <span><span className="inline-block h-2.5 w-2.5 rounded-sm border border-white/30" style={{ background: "rgb(12,18,36)" }} /> no data (e.g. ocean for land-only variables)</span>
        <span><span className="inline-block h-2.5 w-2.5 rounded-sm border border-teal-300" /> selected region</span>
      </p>
    </section>
  );
}
