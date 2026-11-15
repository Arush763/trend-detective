"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useEffect, useState } from "react";
import { NICE, VERDICT, WF, get, headline, inPlace, signed, type Meta, type Region } from "@/lib/data";
import { TrendChart } from "@/components/TrendChart";
import { Badge, Card, Hud } from "@/components/ui";
import { trendToneCss } from "@/components/Globe";
import { ShareTools } from "@/components/ShareTools";

// Case 04: the challenge's "a variable can trend one way in one region and the opposite way in another,
// even when the same process drives both". Default pair picked from our data: both warmer and moister,
// rain trends in opposite directions, all passing the strict test.
const DEFAULT = { a: "amazon", b: "himalaya", v: "PRECTOTCORR" };
const WATER = ["PRECTOTCORR", "GWETROOT", "RUNOFF", "EVAP"];

export default function Compare() {
  const [meta, setMeta] = useState<Meta>(null);
  const [sel, setSel] = useState(DEFAULT);
  const [regions, setRegions] = useState<Record<string, Region>>({});
  const [err, setErr] = useState("");

  useEffect(() => {
    get("meta.json").then((m) => {
      setMeta(m);
      // ?a=&b=&v= (read after commit: on a client-side visit the address bar updates after render)
      const q = new URLSearchParams(window.location.search), ids = m.regions.map((r: any) => r.id);
      const a = q.get("a"), b = q.get("b"), v = q.get("v");
      setSel({ a: a && ids.includes(a) ? a : DEFAULT.a, b: b && ids.includes(b) ? b : DEFAULT.b, v: v && NICE[v] ? v : DEFAULT.v });
    }).catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => {
    let live = true;
    for (const id of [sel.a, sel.b]) get(`regions/${id}.json`).then((r) => live && setRegions((x) => ({ ...x, [id]: r }))).catch((e) => live && setErr(String(e)));
    if (meta) window.history.replaceState(null, "", `/compare?a=${sel.a}&b=${sel.b}&v=${sel.v}`);
    return () => { live = false; };
  }, [sel, meta]);

  if (err) return <p className="text-[var(--false-alarm)]">Could not load the data ({err}). Try reloading the page.</p>;
  const A = regions[sel.a], B = regions[sel.b];
  if (!meta || !A || !B) return <p className="hud text-[var(--ink-dim)]" role="status">Loading NASA data…</p>;
  const common = Object.keys(NICE).filter((k) => A.variables[k] && B.variables[k]);
  const v = common.includes(sel.v) ? sel.v : common[0];
  const n = NICE[v], da = A.variables[v], db = B.variables[v];
  const opposite = Math.sign(da.slope_decade) !== Math.sign(db.slope_decade);
  const bothReal = da.verdict === "significant" && db.verdict === "significant";
  const isDefault = sel.a === DEFAULT.a && sel.b === DEFAULT.b && v === DEFAULT.v;
  const moist = ["T2M", "TQV"].every((k) => [A, B].every((r) => r.variables[k]?.verdict === "significant" && r.variables[k].slope_decade > 0));

  const title = isDefault ? "Same cause, opposite effects" : `${A.name} vs ${B.name}: ${n.short.toLowerCase()}`;
  const sub = opposite && bothReal
    ? `${n.short} went opposite ways in these two places, and both trends pass the strict test.${moist ? " Yet both places got warmer, and both have more water vapor in the air." : ""}`
    : opposite ? `${n.short} went opposite ways here, but not both trends pass the strict test yet.`
      : `${n.short} moved the same way in both places.`;
  const set = (k: "a" | "b" | "v", val: string) => setSel((s) => ({ ...s, [k]: val }));

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex max-w-[960px] flex-col gap-2.5">
        <Hud className="text-[var(--ink-dim)]"><span className="text-[var(--ink-faint)]">{"//////"}</span> {isDefault ? "Case 04 · Compare two places" : "Compare two places"}</Hud>
        <Hud className="text-[var(--signal)]">{`CASE_04 · ${A.name} ↔ ${B.name}`}</Hud>
        <h1 className="text-balance font-display text-[clamp(40px,6vw,84px)] leading-[0.95] tracking-[-0.03em]">{title}</h1>
        <p className="max-w-[60ch] text-pretty text-lg leading-relaxed text-[var(--ink-dim)]">{sub}</p>
      </header>

      <div className="glass flex flex-wrap items-end gap-4 p-4" role="group" aria-label="What to compare">
        {(["a", "b"] as const).map((k, i) => (
          <label key={k} className="hud flex flex-col gap-1.5 text-[var(--ink-dim)]">Place {i + 1}
            <select className="pill bg-[var(--night)]" value={sel[k]} onChange={(e) => set(k, e.target.value)}>
              {meta.regions.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        ))}
        <label className="hud flex flex-col gap-1.5 text-[var(--ink-dim)]">Measurement
          <select className="pill bg-[var(--night)]" value={v} onChange={(e) => set("v", e.target.value)}>
            {common.map((k) => <option key={k} value={k}>{NICE[k].short}</option>)}
          </select>
        </label>
        {!isDefault && <button type="button" className="pill" onClick={() => setSel(DEFAULT)}>Back to Case 04</button>}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[A, B].map((r) => {
          const d = r.variables[v], vd = VERDICT[d.verdict];
          return (
            <Card key={r.id} className="flex min-w-0 flex-col gap-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--glass-stroke)] pb-3">
                <div className="flex flex-col gap-1">
                  <Hud className="text-[var(--ink-dim)]">{`CASE_04 · ${r.name} · ${n.short}`}</Hud>
                  <h2 className="font-display text-3xl tracking-[-0.02em]">{r.name}</h2>
                </div>
                <Badge tone={vd.tone}>{vd.label}</Badge>
              </div>
              <p className="text-[15px] text-[var(--ink-dim)]">{headline(v, inPlace(r), d, meta.years).title} That&apos;s {signed(d.slope_decade)} {n.units} per decade.</p>
              <TrendChart years={meta.years} y={d.annual} perYear={1} slope={d.slope_decade / 10} intercept={d.intercept}
                ci={[d.ci_decade[0] / 10, d.ci_decade[1] / 10]} units={n.units} title={`${n.short} ${inPlace(r)}`} trendColor={trendToneCss(v, d.slope_decade)} />
              <p className="text-[13px] text-[var(--ink-dim)]">Holding up over time: {WF[d.walk_forward.code].label}. <Link href={`/explore?place=${r.id}&v=${v}&step=8`}>Open the full case →</Link></p>
            </Card>
          );
        })}
      </div>

      <Card className="flex min-w-0 flex-col gap-4">
        <Hud className="text-[var(--ink-dim)]">SHARED_CAUSE</Hud>
        <h2 className="font-display text-2xl tracking-[-0.02em]">The shared cause: warmer, moister air</h2>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[440px] border-collapse text-left text-[15px]">
            <thead><tr className="hud text-[var(--ink-dim)]"><th className="py-2 pr-4 font-normal">Per decade since 1980</th>{[A, B].map((r) => <th key={r.id} className="py-2 pr-4 font-normal">{r.name}</th>)}</tr></thead>
            <tbody>
              {["T2M", "TQV", v].filter((k, i, xs) => xs.indexOf(k) === i).map((k) => (
                <tr key={k} className="border-t border-[var(--glass-stroke)]">
                  <td className="py-2.5 pr-4 text-[var(--ink-dim)]">{NICE[k].short}</td>
                  {[A, B].map((r) => {
                    const d = r.variables[k];
                    return <td key={r.id} className="py-2.5 pr-4">{d ? <span className="flex flex-wrap items-center gap-2">{signed(d.slope_decade)} {NICE[k].units} <Badge tone={VERDICT[d.verdict].tone}>{VERDICT[d.verdict].label}</Badge></span> : "n/a"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {WATER.includes(v) && (
          <p className="text-[15px] leading-relaxed text-[var(--ink-dim)]">
            <b className="font-normal text-[var(--ink)]">Why can the same warming push rain opposite ways? </b>
            Warmer air can hold about 7% more water vapor for every 1 °C{moist ? ", and both places show more water vapor" : ""}.
            But that water doesn&apos;t have to fall where it rose: winds carry it, and shifts in where air rises and sinks decide which places get more rain and which get less.
            {[A.id, B.id].includes("amazon") && " Over the Amazon, scientists also point to longer dry seasons and forest loss."}
          </p>
        )}
        <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
          These are trends in NASA&apos;s MERRA-2 record, not proof of a cause. Trends found only after 2002 (see &quot;holding up over time&quot; above) are newer and less settled.
        </p>
      </Card>

      <ShareTools title={`${n.short}: ${A.name} vs ${B.name}, ${meta.years[0]}–${meta.years.at(-1)}`} filename={`trend-detective-compare-${A.id}-${B.id}-${v}`}
        header={["year", `${A.id} ${v} (${n.units})`, `${B.id} ${v} (${n.units})`]}
        rows={meta.years.map((y: number, i: number) => [y, da.annual[i], db.annual[i]])}
        notes={["Source: NASA GMAO MERRA-2 monthly reanalysis via NASA GES DISC; yearly means of the monthly values, averaged over each region's box.",
          `${A.name}: ${da.slope_decade} ${n.units} per decade, q ${da.q}, ${VERDICT[da.verdict].label}. ${B.name}: ${db.slope_decade} ${n.units} per decade, q ${db.q}, ${VERDICT[db.verdict].label}.`]} />
    </div>
  );
}
