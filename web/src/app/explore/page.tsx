"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DEMOS, NICE, TYPE_LABEL, VERDICT, cap, checks, fmt, get, headline, inPlace, placeName, signed, type Meta, type Region } from "@/lib/data";
import { TrendChart } from "@/components/TrendChart";
import { Badge, Card } from "@/components/ui";

const rise = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.35 } };
const param = (k: string) => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get(k) ?? "");

export default function Explore() {
  const [meta, setMeta] = useState<Meta>(null);
  // ?place=&v=&case= keep case links shareable; read directly (not useSearchParams) so the page stays static.
  // Safe for hydration: nothing that depends on them renders until meta has loaded on the client.
  const [placeId, setPlaceId] = useState(() => param("place") || "arctic");
  const [region, setRegion] = useState<Region>(null);
  const [globalR, setGlobalR] = useState<Region>(null);
  const [v, setV] = useState(() => param("v"));
  const [type, setType] = useState("");
  const [caseId, setCaseId] = useState(() => param("case"));
  const [err, setErr] = useState("");

  useEffect(() => {
    get("meta.json").then(setMeta).catch((e) => setErr(String(e)));
    get("regions/global.json").then(setGlobalR);
  }, []);
  useEffect(() => {
    if (!placeId) return;
    get(`regions/${placeId}.json`).then((r) => {
      setRegion(r);
      setV((cur) => (cur && r.variables[cur] ? cur : r.screener[0]));
    }).catch((e) => setErr(String(e)));
  }, [placeId]);
  useEffect(() => {
    if (placeId && v) window.history.replaceState(null, "", `/explore?place=${placeId}&v=${v}${caseId ? `&case=${caseId}` : ""}`);
  }, [placeId, v, caseId]);

  if (err) return <p className="text-red-300">Could not load the data ({err}).</p>;
  if (!meta) return <p className="text-[var(--muted)]">Loading NASA data…</p>;
  const info = region?.id === placeId ? region : null;
  const types = [...new Set<string>(meta.regions.map((r: any) => r.type))]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const places = meta.regions.filter((r: any) => !type || r.type === type); // eslint-disable-line @typescript-eslint/no-explicit-any
  const demo = DEMOS.find((d) => d.id === caseId && d.place === placeId && d.v === v);
  const pick = (id: string) => { setCaseId(""); setPlaceId(id); setV(""); };

  return (
    <div className="flex flex-col gap-8">
      <AnimatePresence>
        {demo && (
          <motion.div {...rise} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-6 py-4">
            <p className="text-[15px] text-[var(--soft)]"><b className="text-[var(--text)]">Demo case: {demo.title}</b> Read the verdict, then scroll down to see how each check decides it.</p>
            {(() => {
              const nx = DEMOS[(DEMOS.indexOf(demo) + 1) % DEMOS.length];
              return <button type="button" className="pill" onClick={() => { setCaseId(nx.id); setV(nx.v); setPlaceId(nx.place); window.scrollTo({ top: 0 }); }}>Next case: {nx.title}</button>;
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      <section aria-label="Choose a place" className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label="Kind of place">
          <span className="mr-1.5 text-sm text-[var(--muted)]">Kind of place</span>
          <button type="button" className="pill" aria-pressed={!type} onClick={() => setType("")}>All</button>
          {types.map((t) => <button key={t} type="button" className="pill" aria-pressed={t === type} onClick={() => setType(t === type ? "" : t)}>{TYPE_LABEL[t] ?? t}</button>)}
        </div>
        <motion.div layout className="flex flex-wrap items-center gap-2.5" role="group" aria-label="Place">
          <span className="mr-1.5 text-sm text-[var(--muted)]">Place</span>
          {places.map((r: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
            <motion.button layout key={r.id} type="button" className="pill" aria-pressed={r.id === placeId} onClick={() => pick(r.id)}>{r.name}</motion.button>
          ))}
        </motion.div>
      </section>

      <AnimatePresence mode="wait">
        {info && v && info.variables[v] && (
          <motion.div key={info.id} {...rise} className="flex flex-col gap-8">
            <Screener meta={meta} info={info} v={v} setV={setV} />
            <CaseFile key={v} meta={meta} info={info} v={v} globalR={globalR} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Screener({ meta, info, v, setV }: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const suggested: string[] = meta.regions.find((r: any) => r.id === info.id).suggested; // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    <Card className="flex flex-col gap-4 p-7">
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow">{TYPE_LABEL[info.type] ?? info.type}</p>
        <h2 className="text-[28px] font-bold">What changed {inPlace(info)}?</h2>
        <p className="text-[15px] text-[#a9b6d3]">{info.blurb} Strongest trends first. ★ = worth checking for this kind of place. Pick one to open its case file.</p>
      </div>
      <ul className="m-0 grid list-none gap-2 p-0">
        {info.screener.map((k: string) => {
          const d = info.variables[k], n = NICE[k], vd = VERDICT[d.verdict];
          const change = k === "T2M" ? `${signed(d.total_change)} °C` : d.pct_change != null ? `${signed(d.pct_change)}%` : `${signed(d.total_change)} ${n.units}`;
          return (
            <li key={k}>
              <button type="button" onClick={() => setV(k)} aria-pressed={k === v}
                className={`grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-2xl border px-5 py-3.5 text-left text-[var(--text)] transition-colors sm:grid-cols-[1.4fr_0.8fr_auto] ${k === v ? "border-[var(--accent)]/60 bg-[var(--accent)]/10" : "border-transparent bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                <span className="flex flex-col">
                  <span className="font-semibold">{n.short}{suggested.includes(k) && <span className="text-[var(--accent)]" aria-label="suggested"> ★</span>}</span>
                  <span className="text-[13px] text-[var(--muted)]">{meta.variables[k].definition}</span>
                </span>
                <span className="hidden text-[15px] sm:block">{change} <span className="text-[13px] text-[var(--muted)]">since 1980</span></span>
                <Badge tone={vd.tone}>{vd.label}</Badge>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function CaseFile({ meta, info, v, globalR }: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const [view, setView] = useState<"year" | "month">("year");
  const [enso, setEnso] = useState(false);
  const d = info.variables[v], n = NICE[v], vd = VERDICT[d.verdict];
  const years: number[] = meta.years;
  const h = headline(v, inPlace(info), d, years);
  const cs = checks(v, d);
  const passed = cs.filter((c) => c.pass).length;
  const yearly: number[] = d.annual.map((y: number, i: number) => (enso ? y - d.enso_coef * meta.enso_annual[i] : y));
  const slope = (enso ? d.slope_enso_decade : d.slope_decade) / 10;
  const g = globalR?.variables[v];
  // A "times as fast" ratio only means something when the whole-Earth trend is itself real and points the same way.
  const ratio = g && g.verdict === "significant" && Math.sign(g.slope_decade) === Math.sign(d.slope_decade) ? d.slope_decade / g.slope_decade : null;

  return (
    <section aria-label="Case file" className="flex flex-col gap-6">
      <Card className="flex flex-wrap items-start justify-between gap-7 p-8">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-3">
          <p className="eyebrow">Case file · {info.name} · {n.short}</p>
          <h2 className="text-[30px] font-bold leading-tight sm:text-[40px]">{h.title}</h2>
          <p className="text-lg leading-relaxed text-[var(--soft)]">
            That&apos;s {signed(d.slope_decade)} {n.units} every 10 years. {h.sub}
          </p>
          {meta.variables[v].caveat && <p className="text-sm text-[#fdba74]">Caution: {meta.variables[v].caveat}</p>}
        </div>
        <div className={`flex flex-[0_1_250px] flex-col gap-1.5 rounded-[18px] border p-5 ${vd.tone === "real" ? "border-[var(--accent)]/50 bg-[var(--accent)]/10" : vd.tone === "maybe" ? "border-[var(--maybe)]/50 bg-[var(--maybe)]/10" : "border-slate-300/30 bg-white/[0.04]"}`}>
          <span className="text-[13px] text-[var(--soft)]">Verdict</span>
          <span className={`font-display text-[28px] font-bold ${vd.tone === "real" ? "text-[var(--accent)]" : vd.tone === "maybe" ? "text-[var(--maybe)]" : "text-slate-200"}`}>{vd.label}</span>
          <span className="text-sm text-[var(--soft)]">Passed {passed} of 4 checks. {vd.blurb}</span>
        </div>
      </Card>

      <Card className="flex flex-col gap-5 p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="font-sans text-xl font-semibold">{view === "year" ? `Average ${n.noun} each year` : `${n.short}, month by month, compared with a normal month`}</h3>
            <p className="text-sm text-[var(--muted)]">{info.name} · {meta.variables[v].definition}</p>
          </div>
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
          ? <TrendChart years={years} y={yearly} perYear={1} slope={slope} intercept={enso ? undefined : d.intercept}
              ci={enso ? undefined : [d.ci_decade[0] / 10, d.ci_decade[1] / 10]} split={meta.split_year} units={n.units} title={`${n.short} in ${info.name}`} />
          : <TrendChart years={years} y={d.monthly_anom} perYear={12} slope={d.slope_decade / 10} units={n.units} title={`${n.short} in ${info.name}, monthly`} />}
        {enso && <p className="text-sm text-[var(--soft)]">El Niño is a natural Pacific Ocean cycle that makes some years warmer or wetter around the world. With it removed, the trend is {signed(d.slope_enso_decade)} {n.units} per decade (it was {signed(d.slope_decade)}).</p>}
      </Card>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[28px] font-bold">The four checks</h3>
          <p className="text-[15px] text-[#a9b6d3]">The verdict comes from check 3, the strictest. The others show why it came out that way.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {cs.map((c, i) => (
            <Card key={c.q} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-sans text-lg font-semibold">{i + 1}. {c.q}</h4>
                <Badge tone={c.pass == null ? "na" : c.pass ? "pass" : "fail"}>{c.pass == null ? "No trend to test" : c.pass ? "Passed" : "Not passed"}</Badge>
              </div>
              <p className="text-base leading-relaxed text-[var(--soft)]">{c.text}</p>
              <p className="text-[13px] text-[var(--muted)]">{c.note}</p>
            </Card>
          ))}
        </div>
        {d.verdict !== "significant" && d.years_more != null && (
          <Card className="border-dashed text-[15px] leading-relaxed text-[var(--soft)]">
            <b className="text-[var(--text)]">How long until we&apos;d know? </b>
            {d.years_more > 0
              ? <>If this trend is real and keeps its current size, about {d.years_more} more years of data (around {fmt(d.years_needed, 2)} years in total) should be enough to prove it. That&apos;s around {years[0] + Math.ceil(d.years_needed)}.</>
              : <>A steady trend this size should already show up in 46 years of data. It doesn&apos;t, so the data probably moves in long swings rather than a straight line. More years alone may not settle it.</>}
          </Card>
        )}
      </div>

      {g && info.id !== "global" && (
        <Card className="flex flex-col gap-5 p-7">
          <h3 className="font-sans text-xl font-semibold">Compared with the whole planet</h3>
          {[[info.name, d.slope_decade, "var(--up)"], ["Whole Earth", g.slope_decade, "#94a3b8"]].map(([name, s, c]) => {
            const max = Math.max(Math.abs(d.slope_decade), Math.abs(g.slope_decade)) || 1;
            return (
              <div key={name as string} className="flex flex-wrap items-center gap-4">
                <span className="w-36 text-[15px] text-[var(--soft)]">{name}</span>
                <div className="h-6 min-w-[120px] flex-1 rounded-lg bg-white/[0.06]"><div className="h-full rounded-lg" style={{ width: `${(Math.abs(s as number) / max) * 100}%`, background: c as string }} /></div>
                <span className="w-44 text-[15px]">{signed(s as number)} {n.units} per decade</span>
              </div>
            );
          })}
          <p className="text-[15px] leading-relaxed text-[var(--soft)]">
            {ratio != null
              ? <>{cap(placeName(info))} is changing <b className="text-[var(--text)]">{fmt(ratio, 2)} times as fast</b> as Earth as a whole (that&apos;s the ratio of the two trends above).</>
              : g.verdict !== "significant"
                ? <>Earth as a whole has no proven trend in {n.noun}, so there&apos;s no planet-wide speed to compare with.</>
                : <>{cap(placeName(info))} is moving in the opposite direction from Earth as a whole, so the two can&apos;t be compared as a speed.</>}
            {info.id === "arctic" && v === "T2M" && meta.sanity?.matched && (
              <> Scientists call this <b className="text-[var(--text)]">Arctic amplification</b>. One big reason: melting ice and snow uncover darker ground and water, which soak up more sunlight.
                A 2022 study using observations found about 3.8 times for 1979–2021. Our NASA data gives {meta.sanity.matched.ratio} times for the same years.
                Different data sets disagree on the Arctic, so this is in the expected range, and it&apos;s a good check that our method works.</>
            )}
          </p>
        </Card>
      )}

      <details className="rounded-[20px] border border-[var(--line)] bg-white/[0.02] px-7 py-5">
        <summary className="min-h-8 cursor-pointer font-semibold">The statistics, for the curious</summary>
        <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm leading-normal md:grid-cols-2">
          {[
            [`Sen's slope: ${signed(d.slope_decade)} ${n.units}/decade (95% range ${fmt(d.ci_decade[0])} to ${fmt(d.ci_decade[1])})`, "The middle of every year-to-year slope. Unlike a regular best-fit line, one odd year can't drag it."],
            [`Mann-Kendall p: ${fmt(d.p_naive)} simple, ${fmt(d.p_hr)} corrected`, "How often pure noise would make an up-or-down pattern at least this consistent. The corrected value uses the Hamed-Rao method for years that resemble the year before."],
            [`Shuffle test p: ${fmt(d.p_perm)}`, "The share of 2,000 shuffled versions of the data that showed a trend at least this strong."],
            [`False-discovery rate q: ${fmt(d.q)}`, "Benjamini-Hochberg: if we called every trend this strong \"real\", this is the share we'd expect to be false alarms. Under 0.05 = real signal."],
            [`Normal wobble: ${fmt(d.noise_level)} ${n.units}, year-to-year memory ${fmt(d.autocorr)}`, "Wobble is the typical distance of a year from the trend line. Memory (lag-1 autocorrelation) is how much each year looks like the one before, from −1 to 1."],
            [`El Niño effect: ${signed(d.enso_coef)} ${n.units} per °C of Niño 3.4 (p ${fmt(d.enso_p)})`, "How much this place changes in a strong El Niño year, from a fit of trend plus the NOAA Niño 3.4 index."],
          ].map(([t, dd]) => (
            <div key={t}><dt className="font-semibold">{t}</dt><dd className="ml-0 mt-0.5 text-[#a9b6d3]">{dd}</dd></div>
          ))}
        </dl>
      </details>
    </section>
  );
}
