"use client";
// shortcut: plain test UI (no glass styling, Motion, Skiper or MapLibre yet), restyle once data checks out.
import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Meta = any;
type Region = any;
type Grid = any;

const get = (path: string) => fetch(`/data/${path}`).then((r) => {
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
});
const fmt = (x: number | null | undefined, d = 3) => (x == null ? "n/a" : Number(x.toPrecision(d)).toString());

export default function Home() {
  const [meta, setMeta] = useState<Meta>(null);
  const [err, setErr] = useState("");
  const [regionId, setRegionId] = useState("");
  const [region, setRegion] = useState<Region>(null);
  const [v, setV] = useState("T2M");
  const [enso, setEnso] = useState(false);

  useEffect(() => { get("meta.json").then(setMeta).catch((e) => setErr(String(e))); }, []);
  useEffect(() => {
    if (!regionId) return;
    get(`regions/${regionId}.json`).then((r) => { setRegion(r); setV(r.screener[0]); }).catch((e) => setErr(String(e)));
  }, [regionId]);

  if (err) return <p className="p-6 text-red-600">Could not load data ({err}). Run pipeline/build.py, then npm run data.</p>;
  if (!meta) return <p className="p-6">Loading…</p>;
  const info = region && region.id === regionId ? region : null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4">
      <h1 className="text-2xl font-bold">Trend Detective: Signal or Noise?</h1>

      <section>
        <h2 className="font-semibold">1. Open a case: pick a region</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {meta.regions.map((r: any) => (
            <button key={r.id} onClick={() => setRegionId(r.id)}
              className={`rounded border px-2 py-1 text-sm ${r.id === regionId ? "bg-black text-white" : ""}`}>
              {r.name}
            </button>
          ))}
        </div>
      </section>

      {info && (
        <>
          <section>
            <p><b>{info.name}</b> ({info.type}): {info.blurb}</p>
            <h2 className="mt-3 font-semibold">2. Earth Screener: variables ranked by signal-to-noise</h2>
            <table className="mt-2 w-full text-left text-sm">
              <thead><tr><th>Variable</th><th>Trend / decade</th><th>q (FDR)</th><th>Signal/noise</th><th>Verdict</th></tr></thead>
              <tbody>
                {info.screener.map((k: string) => {
                  const d = info.variables[k];
                  const sugg = meta.regions.find((r: any) => r.id === info.id).suggested.includes(k);
                  return (
                    <tr key={k} onClick={() => setV(k)} className={`cursor-pointer border-t ${k === v ? "bg-yellow-100 dark:bg-yellow-900" : ""}`}>
                      <td>{meta.variables[k].name}{sugg && " ★"}<div className="text-xs opacity-70">{meta.variables[k].definition}</div></td>
                      <td>{fmt(d.slope_decade)} {meta.variables[k].units}</td>
                      <td>{fmt(d.q)}</td><td>{fmt(d.snr)}</td><td>{d.verdict}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs opacity-70">★ = suggested for a {info.type} region</p>
          </section>

          <CaseFile meta={meta} info={info} v={v} enso={enso} setEnso={setEnso} />
        </>
      )}

      <MapPanel meta={meta} v={v} enso={enso} box={info?.box} />

      {meta.sanity && (
        <section className="text-sm">
          <h2 className="font-semibold">Sanity check</h2>
          Global warming {meta.sanity.global_T2M_decade} °C/decade, Arctic {meta.sanity.arctic_T2M_decade} °C/decade,
          ratio {meta.sanity.ratio}. Reference: {meta.sanity.reference}.
        </section>
      )}
      <footer className="text-xs opacity-70">Data: {meta.sources.data}. ENSO: {meta.sources.enso}.</footer>
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
    <section className="space-y-2">
      <h2 className="font-semibold">3. Case file: {meta.variables[v].name} in {info.name}</h2>
      <label className="text-sm"><input type="checkbox" checked={enso} onChange={(e) => setEnso(e.target.checked)} /> Remove El Niño</label>
      <Chart years={years} y={series} slope={slope} intercept={d.intercept} enso={enso} />
      <ul className="text-sm">
        <li>Trend (Sen&apos;s slope): <b>{fmt(slope * 10)} {u}/decade</b>{!enso && <> (95% CI {fmt(d.ci_decade[0])} to {fmt(d.ci_decade[1])})</>}</li>
        <li>Total change {years[0]}–{years.at(-1)}: {fmt(d.total_change)} {u}{d.pct_change != null && ` (${fmt(d.pct_change, 2)}%)`}</li>
        <li>Mann-Kendall p: naive {fmt(d.p_naive)}, autocorrelation-corrected {fmt(p)}, shuffle test {fmt(d.p_perm)}, FDR q {fmt(d.q)}</li>
        <li>Verdict: <b>{d.verdict}</b></li>
        {d.verdict !== "significant" && d.years_more != null && (
          <li>Years until we&apos;d know: about {d.years_more} more years of data (~{fmt(d.years_needed)} total)</li>
        )}
        <li>El Niño effect: {fmt(d.enso_coef)} {u} per °C of Niño 3.4 (p {fmt(d.enso_p)})</li>
        <li>Walk-forward: <b>{wf.label}</b>. {wf.first.years.join("–")}: {fmt(wf.first.slope_decade)}/decade (p {fmt(wf.first.p)});
          {" "}{wf.second.years.join("–")}: {fmt(wf.second.slope_decade)}/decade (p {fmt(wf.second.p)})</li>
      </ul>
    </section>
  );
}

function Chart({ years, y, slope, intercept, enso }: any) {
  const W = 800, H = 240, P = 30;
  const lo = Math.min(...y), hi = Math.max(...y), span = hi - lo || 1;
  const X = (i: number) => P + (i / (y.length - 1)) * (W - 2 * P);
  const Y = (val: number) => H - P - ((val - lo) / span) * (H - 2 * P);
  // with ENSO removed the original intercept no longer fits, so re-anchor the line on the median
  const b = enso ? median(y.map((val: number, i: number) => val - slope * i)) : intercept;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full border">
      <polyline fill="none" stroke="currentColor" points={y.map((val: number, i: number) => `${X(i)},${Y(val)}`).join(" ")} />
      <line x1={X(0)} y1={Y(b)} x2={X(y.length - 1)} y2={Y(b + slope * (y.length - 1))} stroke="red" strokeWidth={2} />
      <text x={P} y={H - 8} fontSize={12} fill="currentColor">{years[0]}</text>
      <text x={W - P - 30} y={H - 8} fontSize={12} fill="currentColor">{years.at(-1)}</text>
      <text x={2} y={P} fontSize={12} fill="currentColor">{fmt(hi)}</text>
      <text x={2} y={H - P} fontSize={12} fill="currentColor">{fmt(lo)}</text>
    </svg>
  );
}

const median = (a: number[]) => { const s = [...a].sort((x, z) => x - z); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const MODES = {
  naive: "Naive p<0.05",
  noise: "Noise test (shuffled data)",
  real: "Real signal (corrected + FDR)",
} as const;

function MapPanel({ meta, v, enso, box }: any) {
  const [mode, setMode] = useState<keyof typeof MODES>("naive");
  const [grid, setGrid] = useState<Grid>(null);
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
      const rgb = s == null ? [255, 255, 255] : !sig ? [200, 200, 200] : s > 0 ? [220, 40, 40] : [40, 80, 220];
      img.data.set([...rgb, 255], o);
    }
    ctx.putImageData(img, 0, 0);
    if (box) { // region outline; box = [lat_min, lat_max, lon_min, lon_max]
      ctx.strokeStyle = "black";
      ctx.strokeRect((box[2] + 180) / 360 * nx, (90 - box[1]) / 180 * ny, (box[3] - box[2]) / 360 * nx, (box[1] - box[0]) / 180 * ny);
    }
  }, [grid, mode, enso, box, v]);

  const s = meta.grid_summary[v];
  const count = { naive: s.naive_sig, noise: s.noise_sig, real: enso ? s.enso_real_sig : s.real_sig }[mode];
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">4. Map: {meta.variables[v].name} trend, every grid cell</h2>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(MODES) as (keyof typeof MODES)[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded border px-2 py-1 text-sm ${m === mode ? "bg-black text-white" : ""}`}>{MODES[m]}</button>
        ))}
      </div>
      <p className="text-sm"><b>{count}</b> of {s.cells} cells look &quot;significant&quot;. Red = rising, blue = falling, grey = not significant, white = no data.</p>
      <canvas ref={ref} width={meta.grid.lon.length} height={meta.grid.lat.length}
        className="w-full border" style={{ imageRendering: "pixelated", aspectRatio: "2 / 1" }} />
    </section>
  );
}
