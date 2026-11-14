"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DEMOS, NICE, TYPE_LABEL, VERDICT, cap, checks, fmt, get, pfmt, headline, inPlace, placeName, signed, type Grid, type Meta, type Region } from "@/lib/data";
import { TrendChart } from "@/components/TrendChart";
import { Badge, Card } from "@/components/ui";
import { Globe, GlobeScale, cellAt, type Pick } from "@/components/Globe";
import { CellInfo } from "@/components/CellInfo";

const STEPS = ["Kind of place", "Place", "What to look at", "The data", "Check 1", "Check 2", "Check 3", "Check 4", "Verdict"];
const DATA = 3, VERDICT_STEP = 8;
const param = (k: string) => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get(k) ?? "");
const page = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.3 } };

export default function Explore() {
  const [meta, setMeta] = useState<Meta>(null);
  // ?place=&v=&case=&step= keep a case shareable; read directly (not useSearchParams) so the page stays static.
  // Safe for hydration: nothing that depends on them renders until meta has loaded on the client.
  const [placeId, setPlaceId] = useState(() => param("place"));
  const [v, setV] = useState(() => param("v"));
  const [caseId, setCaseId] = useState(() => param("case"));
  const [step, setStep] = useState(() => { const s = +param("step"); return s ? s : param("place") && param("v") ? DATA : 0; });
  const [type, setType] = useState("");
  const [region, setRegion] = useState<Region>(null);
  const [globalR, setGlobalR] = useState<Region>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    get("meta.json").then(setMeta).catch((e) => setErr(String(e)));
    get("regions/global.json").then(setGlobalR);
  }, []);
  useEffect(() => { if (placeId) get(`regions/${placeId}.json`).then(setRegion).catch((e) => setErr(String(e))); }, [placeId]);
  useEffect(() => {
    const q = new URLSearchParams();
    if (placeId) q.set("place", placeId);
    if (v) q.set("v", v);
    if (caseId) q.set("case", caseId);
    q.set("step", String(step));
    window.history.replaceState(null, "", `/explore?${q}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [placeId, v, caseId, step]);

  if (err) return <p className="text-red-300">Could not load the data ({err}).</p>;
  if (!meta) return <p className="text-[var(--muted)]">Loading NASA data…</p>;
  const info = region?.id === placeId ? region : null;
  const d = info && v ? info.variables[v] : null;
  const demo = DEMOS.find((x) => x.id === caseId && x.place === placeId && x.v === v);
  const canReach = (i: number) => i <= 0 || (i === 1 && !!type) || (i === 1 && !!placeId) || (i === 2 && !!info) || (i >= DATA && !!d);
  const go = (i: number) => canReach(i) && setStep(i);
  const startDemo = (x: (typeof DEMOS)[number]) => { setCaseId(x.id); setPlaceId(x.place); setV(x.v); setStep(DATA); };

  return (
    <div className="flex flex-col gap-7">
      {demo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-5 py-3.5 text-[15px] text-[var(--soft)]">
          <span><b className="text-[var(--text)]">Demo case:</b> {demo.title}</span>
          {(() => { const nx = DEMOS[(DEMOS.indexOf(demo) + 1) % DEMOS.length]; return <button type="button" className="pill" onClick={() => startDemo(nx)}>Next demo: {nx.title}</button>; })()}
        </div>
      )}

      <nav aria-label="Case steps" className="flex flex-col gap-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div className="h-full bg-[var(--accent)]" animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" onClick={() => go(i)} disabled={!canReach(i)} aria-current={i === step ? "step" : undefined}
                className={`rounded-full px-3 py-1.5 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${i === step ? "bg-[var(--accent)] font-semibold text-[#04211d]" : "text-[var(--soft)] hover:bg-white/[0.07]"}`}>
                {s}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <AnimatePresence mode="wait">
        <motion.div key={step} {...page}>
          {step === 0 && <KindStep meta={meta} type={type} pick={(t) => { setType(t); setCaseId(""); setStep(1); }} startDemo={startDemo} />}
          {step === 1 && <PlaceStep meta={meta} type={type} placeId={placeId} pick={(id) => { setPlaceId(id); setV(""); setCaseId(""); setStep(2); }} />}
          {step === 2 && (info ? <WhatStep meta={meta} info={info} v={v} pick={(k) => { setV(k); setCaseId(""); setStep(DATA); }} /> : <Loading />)}
          {step >= DATA && (!info || !d ? <Loading /> : (
            step === DATA ? <DataStep meta={meta} info={info} v={v} d={d} />
              : step < VERDICT_STEP ? <CheckStep i={step - DATA - 1} meta={meta} info={info} v={v} d={d} />
                : <VerdictStep meta={meta} info={info} v={v} d={d} globalR={globalR} go={go} />
          ))}
        </motion.div>
      </AnimatePresence>

      {step >= 1 && (
        <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--line)] pt-5">
          <button type="button" className="pill" onClick={() => setStep(step - 1)}>← Back</button>
          {step >= DATA && step < VERDICT_STEP && (
            <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
              {step === DATA ? "Start the checks →" : step === VERDICT_STEP - 1 ? "See the verdict →" : `Next: check ${step - DATA + 1} →`}
            </button>
          )}
          {step === VERDICT_STEP && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="pill" onClick={() => { setCaseId(""); setStep(2); }}>Look at something else here</button>
              <button type="button" className="btn btn-primary" onClick={() => { setCaseId(""); setType(""); setStep(0); }}>Start a new case</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const Loading = () => <p className="text-[var(--muted)]">Loading…</p>;

function Question({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <header className="mb-6 flex max-w-[820px] flex-col gap-2">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="text-[32px] font-bold leading-tight sm:text-[40px]">{title}</h1>
      {sub && <p className="text-lg leading-relaxed text-[var(--soft)]">{sub}</p>}
    </header>
  );
}

function KindStep({ meta, type, pick, startDemo }: { meta: Meta; type: string; pick: (t: string) => void; startDemo: (x: (typeof DEMOS)[number]) => void }) {
  const types = [...new Set<string>(meta.regions.map((r: any) => r.type))];
  return (
    <section>
      <Question eyebrow="Question 1" title="What kind of place do you want to investigate?" sub="Different places change in different ways. We'll suggest what to look at for each kind." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => {
          const rs = meta.regions.filter((r: any) => r.type === t);
          return (
            <button key={t} type="button" onClick={() => pick(t)} aria-pressed={t === type}
              className="flex min-h-[92px] cursor-pointer flex-col gap-1.5 rounded-2xl border border-[var(--line)] bg-white/[0.04] p-5 text-left text-[var(--text)] transition-colors hover:border-[var(--accent)]/50 hover:bg-white/[0.07] aria-pressed:border-[var(--accent)]">
              <span className="text-lg font-semibold">{TYPE_LABEL[t] ?? t}</span>
              <span className="text-sm text-[var(--muted)]">{rs.map((r: any) => r.name).join(" · ")}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-6 text-[15px] text-[var(--soft)]">Not sure? Try a demo case:{" "}
        {DEMOS.map((x, i) => <span key={x.id}>{i > 0 && " · "}<button type="button" onClick={() => startDemo(x)} className="cursor-pointer font-semibold text-[var(--accent)] underline-offset-4 hover:underline">{x.title}</button></span>)}
      </p>
    </section>
  );
}

function PlaceStep({ meta, type, placeId, pick }: { meta: Meta; type: string; placeId: string; pick: (id: string) => void }) {
  const rs = meta.regions.filter((r: any) => !type || r.type === type);
  return (
    <section>
      <Question eyebrow="Question 2" title="Which place?" sub={type ? `${TYPE_LABEL[type] ?? type} places in our data.` : "Every place in our data."} />
      <div className="grid gap-3 sm:grid-cols-2">
        {rs.map((r: any) => (
          <button key={r.id} type="button" onClick={() => pick(r.id)} aria-pressed={r.id === placeId}
            className="flex cursor-pointer flex-col gap-1.5 rounded-2xl border border-[var(--line)] bg-white/[0.04] p-5 text-left text-[var(--text)] transition-colors hover:border-[var(--accent)]/50 hover:bg-white/[0.07] aria-pressed:border-[var(--accent)]">
            <span className="text-lg font-semibold">{r.name}</span>
            <span className="text-[15px] leading-normal text-[#a9b6d3]">{r.blurb}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function WhatStep({ meta, info, v, pick }: { meta: Meta; info: Region; v: string; pick: (k: string) => void }) {
  const suggested: string[] = meta.regions.find((r: any) => r.id === info.id).suggested;
  const order = [...info.screener].sort((a: string, b: string) => +suggested.includes(b) - +suggested.includes(a));
  return (
    <section>
      <Question eyebrow={`Question 3 · ${info.name}`} title={`What do you want to look at ${inPlace(info)}?`}
        sub={`${info.blurb} The ones marked ★ matter most for a ${(TYPE_LABEL[info.type] ?? info.type).toLowerCase()} place.`} />
      <div className="grid gap-3 sm:grid-cols-2">
        {order.map((k: string) => (
          <button key={k} type="button" onClick={() => pick(k)} aria-pressed={k === v}
            className="flex cursor-pointer flex-col gap-1.5 rounded-2xl border border-[var(--line)] bg-white/[0.04] p-5 text-left text-[var(--text)] transition-colors hover:border-[var(--accent)]/50 hover:bg-white/[0.07] aria-pressed:border-[var(--accent)]">
            <span className="text-lg font-semibold">{NICE[k].short}{suggested.includes(k) && <span className="text-[var(--accent)]"> ★ suggested</span>}</span>
            <span className="text-[15px] leading-normal text-[#a9b6d3]">{meta.variables[k].definition}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function DataStep({ meta, info, v, d }: { meta: Meta; info: Region; v: string; d: any }) {
  const [view, setView] = useState<"year" | "month">("year");
  const [enso, setEnso] = useState(false);
  const n = NICE[v];
  const yearly: number[] = d.annual.map((y: number, i: number) => (enso ? y - d.enso_coef * meta.enso_annual[i] : y));
  const slope = (enso ? d.slope_enso_decade : d.slope_decade) / 10;
  return (
    <section>
      <Question eyebrow={`The data · ${info.name} · ${n.short}`} title={headline(v, inPlace(info), d, meta.years).title}
        sub={`That's ${signed(d.slope_decade)} ${n.units} every 10 years. But is it a real trend, or just noise? The next four pages check.`} />
      {meta.variables[v].caveat && <p className="mb-4 text-sm text-[#fdba74]">Caution: {meta.variables[v].caveat}</p>}
      <Card className="flex flex-col gap-5 p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-sans text-xl font-semibold">{view === "year" ? `Average ${n.noun} each year` : `${n.short} each month, compared with a normal month`}</h2>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chart view">
            <button type="button" className="pill" aria-pressed={view === "year"} onClick={() => setView("year")}>Yearly averages</button>
            <button type="button" className="pill" aria-pressed={view === "month"} onClick={() => setView("month")}>Month by month</button>
            {view === "year" && (
              <label className="pill flex items-center gap-2">
                <input type="checkbox" className="h-[18px] w-[18px] accent-[var(--accent)]" checked={enso} onChange={(e) => setEnso(e.target.checked)} />
                Remove El Niño
              </label>
            )}
          </div>
        </div>
        {view === "year"
          ? <TrendChart years={meta.years} y={yearly} perYear={1} slope={slope} intercept={enso ? undefined : d.intercept}
              ci={enso ? undefined : [d.ci_decade[0] / 10, d.ci_decade[1] / 10]} units={n.units} title={`${n.short} ${inPlace(info)}`} />
          : <TrendChart years={meta.years} y={d.monthly_anom} perYear={12} slope={d.slope_decade / 10} units={n.units} title={`${n.short} ${inPlace(info)}, monthly`} />}
        <p className="text-sm text-[var(--soft)]">
          {view === "year"
            ? "Each dot is one year's average, so summer and winter cancel out. The orange line is the trend; the shaded band shows where it could really be (95% sure)."
            : "Each point is one month minus a normal month for that time of year, so the seasons are removed but you can see every wiggle."}
          {enso && ` El Niño (a natural Pacific Ocean cycle) removed: the trend is ${signed(d.slope_enso_decade)} ${n.units} per decade instead of ${signed(d.slope_decade)}.`}
        </p>
      </Card>
    </section>
  );
}

function CheckStep({ i, meta, info, v, d }: { i: number; meta: Meta; info: Region; v: string; d: any }) {
  const c = checks(v, d)[i], n = NICE[v];
  return (
    <section>
      <Question eyebrow={`Check ${i + 1} of 4 · ${info.name} · ${n.short}`} title={c.q} />
      <Card className="flex flex-col gap-6 p-8">
        <span className={`font-display text-4xl font-bold ${c.pass == null ? "text-slate-300" : c.pass ? "text-[var(--accent)]" : "text-[var(--maybe)]"}`}>
          {c.pass == null ? "No trend to test" : c.pass ? "Passed" : "Not passed"}
        </span>
        <CheckVisual i={i} meta={meta} v={v} d={d} />
        <p className="text-lg leading-relaxed text-[var(--soft)]">{c.text}</p>
        <p className="text-sm text-[var(--muted)]">{c.note}</p>
      </Card>
    </section>
  );
}

function Bar({ label, value, max, color, text }: { label: string; value: number; max: number; color: string; text: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="w-52 text-[15px] text-[var(--soft)]">{label}</span>
      <div className="h-7 min-w-[140px] flex-1 rounded-lg bg-white/[0.06]">
        <motion.div className="h-full rounded-lg" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (value / max) * 100)}%` }} transition={{ duration: 0.7 }} />
      </div>
      <span className="w-36 text-[15px]">{text}</span>
    </div>
  );
}

function CheckVisual({ i, meta, v, d }: { i: number; meta: Meta; v: string; d: any }) {
  const u = NICE[v].units;
  if (i === 0) {
    const tot = Math.abs(d.total_change), wob = d.noise_level, max = Math.max(tot, wob * 2);
    return (
      <div className="flex flex-col gap-3">
        <Bar label="Total change since 1980" value={tot} max={max} color="var(--up)" text={`${fmt(tot)} ${u}`} />
        <Bar label="Normal wobble (one year)" value={wob} max={max} color="#c7d2fe" text={`${fmt(wob)} ${u}`} />
        <Bar label="Pass line (2 × wobble)" value={wob * 2} max={max} color="rgba(94,234,212,0.35)" text={`${fmt(wob * 2)} ${u}`} />
      </div>
    );
  }
  if (i === 1) {
    const beat = Math.max(0, Math.round(d.p_perm * 2001) - 1);
    return (
      <div className="flex flex-col gap-3">
        <Bar label="Shuffles that beat the real data" value={beat} max={2000} color="var(--maybe)" text={`${beat.toLocaleString()} of 2,000`} />
        <Bar label="Pass line (5 in 100)" value={100} max={2000} color="rgba(94,234,212,0.35)" text="100 of 2,000" />
      </div>
    );
  }
  if (i === 2) {
    const pct = Math.min(100, d.q * 100);
    return (
      <div className="flex flex-col gap-3">
        <Bar label="False-alarm chance" value={Math.max(pct, 0.4)} max={50} color="var(--maybe)" text={d.q < 0.0001 ? "under 0.01%" : `${fmt(pct)}%`} />
        <Bar label="Pass line" value={5} max={50} color="rgba(94,234,212,0.35)" text="5%" />
      </div>
    );
  }
  return <TrendChart years={meta.years} y={d.annual} perYear={1} slope={d.slope_decade / 10} intercept={d.intercept} split={meta.split_year} units={u} title={`${NICE[v].short}, first and second half`} />;
}

function VerdictStep({ meta, info, v, d, globalR, go }: { meta: Meta; info: Region; v: string; d: any; globalR: Region; go: (i: number) => void }) {
  const [grid, setGrid] = useState<Grid>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  useEffect(() => { get(`grid/${v}.json`).then(setGrid); }, [v]);
  const n = NICE[v], vd = VERDICT[d.verdict], cs = checks(v, d), h = headline(v, inPlace(info), d, meta.years);
  const g = globalR?.variables[v];
  // A "times as fast" ratio only means something when the whole-Earth trend is itself real and points the same way.
  const ratio = g && g.verdict === "significant" && Math.sign(g.slope_decade) === Math.sign(d.slope_decade) ? d.slope_decade / g.slope_decade : null;
  const focus = useMemo(() => {
    const [a, b, c, e] = info.box;
    return info.id === "global" ? { lat: 30, lng: -20, altitude: 2.2 }
      : { lat: (a + b) / 2, lng: (c + e) / 2, altitude: Math.min(2.2, Math.max(1.5, Math.max(b - a, e - c) / 45 + 1.2)) }; // far enough out to still read as a globe
  }, [info]);
  const tone = vd.tone === "real" ? "var(--accent)" : vd.tone === "maybe" ? "var(--maybe)" : "#cbd5e1";

  return (
    <section className="flex flex-col gap-6">
      <Question eyebrow={`Verdict · ${info.name} · ${n.short}`} title={h.title} />
      <div className="flex flex-wrap gap-6">
        <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-5">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4 }}
            className="flex flex-col gap-2 rounded-[22px] border-2 p-7" style={{ borderColor: tone, background: `color-mix(in srgb, ${tone} 10%, transparent)` }}>
            <span className="text-sm text-[var(--soft)]">Verdict</span>
            <span className="font-display text-[44px] font-bold leading-none" style={{ color: tone }}>{vd.label}</span>
            <span className="text-lg leading-relaxed text-[var(--soft)]">{h.sub}</span>
          </motion.div>
          <Card className="flex flex-col gap-1 p-4">
            {cs.map((c, i) => (
              <button key={c.q} type="button" onClick={() => go(DATA + 1 + i)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] text-[var(--text)] hover:bg-white/[0.06]">
                <span>{i + 1}. {c.q}{i === 2 && <span className="text-[13px] text-[var(--muted)]"> (decides the verdict)</span>}</span>
                <Badge tone={c.pass == null ? "na" : c.pass ? "pass" : "fail"}>{c.pass == null ? "n/a" : c.pass ? "Passed" : "Not passed"}</Badge>
              </button>
            ))}
          </Card>
          {d.verdict !== "significant" && d.years_more != null && (
            <Card className="border-dashed text-[15px] leading-relaxed text-[var(--soft)]">
              <b className="text-[var(--text)]">How long until we&apos;d know? </b>
              {d.years_more > 0
                ? <>If this trend is real and keeps its current size, about {d.years_more} more years of data (around {meta.years[0] + Math.ceil(d.years_needed)}) should be enough to prove it.</>
                : <>A steady trend this size should already show up in 46 years. It doesn&apos;t, so the data probably moves in long swings. More years alone may not settle it.</>}
            </Card>
          )}
          {g && info.id !== "global" && (
            <Card className="flex flex-col gap-4">
              <h2 className="font-sans text-lg font-semibold">Compared with the whole planet</h2>
              {[[info.name, d.slope_decade, d.slope_decade < 0 ? "var(--down)" : "var(--up)"], ["Whole Earth", g.slope_decade, "#94a3b8"]].map(([name, s, c]) => (
                <Bar key={name as string} label={name as string} value={Math.abs(s as number)} max={Math.max(Math.abs(d.slope_decade), Math.abs(g.slope_decade)) || 1}
                  color={c as string} text={`${signed(s as number)} per decade`} />
              ))}
              <p className="text-[15px] leading-relaxed text-[var(--soft)]">
                {ratio != null
                  ? <>{cap(placeName(info))} is changing <b className="text-[var(--text)]">{fmt(ratio, 2)} times as fast</b> as Earth as a whole (its trend divided by the planet&apos;s).</>
                  : g.verdict !== "significant"
                    ? <>Earth as a whole has no proven trend in {n.noun}, so there&apos;s no planet-wide speed to compare with.</>
                    : <>{cap(placeName(info))} is moving in the opposite direction from Earth as a whole.</>}
                {info.id === "arctic" && v === "T2M" && meta.sanity?.matched && (
                  <> Scientists call this <b className="text-[var(--text)]">Arctic amplification</b>: melting ice and snow uncover darker ground and water that soak up more sunlight.
                    A 2022 study using observations found about 3.8 times for 1979–2021; our NASA data gives {meta.sanity.matched.ratio} times for the same years, within the range different data sets give.</>
                )}
              </p>
            </Card>
          )}
        </div>
        <figure className="m-0 flex min-w-0 flex-[1_1_400px] flex-col items-center gap-3">
          <figcaption className="self-start text-[15px] text-[var(--soft)]"><b className="text-[var(--text)]">{n.short} trends around {placeName(info)}</b> (outlined), strict test. Click any spot for its numbers.</figcaption>
          <div className="w-full max-w-[520px]">
            <Globe grid={grid} mode="real" focus={focus} box={info.id === "global" ? undefined : info.box} pick={pick}
              onPick={(p) => grid && setPick(cellAt(grid, meta.grid.lat, meta.grid.lon, p))}
              label={`Globe zoomed to ${info.name}, showing ${n.short} trends that pass the strict test.`} />
          </div>
          <GlobeScale grid={grid} units={n.units} mode="real" />
          <div className="w-full"><CellInfo meta={meta} grid={grid} v={v} pick={pick} mode="real" enso={false} onClose={() => setPick(null)} /></div>
        </figure>
      </div>
      <details className="rounded-[20px] border border-[var(--line)] bg-white/[0.02] px-7 py-5">
        <summary className="min-h-8 cursor-pointer font-semibold">The statistics, for the curious</summary>
        <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm leading-normal md:grid-cols-2">
          {[
            [`Sen's slope: ${signed(d.slope_decade)} ${n.units}/decade (95% range ${fmt(d.ci_decade[0])} to ${fmt(d.ci_decade[1])})`, "The middle of every year-to-year slope. Unlike a regular best-fit line, one odd year can't drag it."],
            [`Mann-Kendall p: ${pfmt(d.p_naive)} simple, ${pfmt(d.p_hr)} corrected`, "How often pure noise would make an up-or-down pattern at least this consistent. The corrected value uses the Hamed-Rao method for years that resemble the year before."],
            [`Shuffle test p: ${pfmt(d.p_perm)}`, "The share of 2,000 shuffled versions of the data that showed a trend at least this strong."],
            [`False-discovery rate q: ${pfmt(d.q)}`, "Benjamini-Hochberg across all 184 tests: if we called every trend this strong \"real\", this is the share we'd expect to be false alarms. Under 0.05 = real signal."],
            [`Normal wobble: ${fmt(d.noise_level)} ${n.units}, year-to-year memory ${fmt(d.autocorr)}`, "Wobble is the typical distance of a year from the trend line. Memory (lag-1 autocorrelation) is how much each year looks like the one before, from −1 to 1."],
            [`El Niño effect: ${signed(d.enso_coef)} ${n.units} per °C of Niño 3.4 (p ${pfmt(d.enso_p)})`, "How much this place changes in a strong El Niño year, from a fit of trend plus the NOAA Niño 3.4 index."],
          ].map(([t, dd]) => (
            <div key={t}><dt className="font-semibold">{t}</dt><dd className="ml-0 mt-0.5 text-[#a9b6d3]">{dd}</dd></div>
          ))}
        </dl>
      </details>
      <p className="text-sm text-[var(--muted)]">Want the whole planet? <Link href="/globe">Open the globe</Link>.</p>
    </section>
  );
}
