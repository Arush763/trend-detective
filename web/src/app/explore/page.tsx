"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DEMOS, NICE, TYPE_LABEL, VERDICT, cap, checks, fmt, get, parseQuestion, pfmt, headline, inPlace, placeName, signed, type Grid, type Meta, type Region } from "@/lib/data";
import { TrendChart } from "@/components/TrendChart";
import { Badge, Brackets, Button, Card, Hud, SectionLabel, VerdictStamp } from "@/components/ui";
import { Globe, GlobeScale, cellAt, trendToneCss, type Pick } from "@/components/Globe";
import { CellInfo } from "@/components/CellInfo";
import { ShareTools } from "@/components/ShareTools";

const STEPS = ["Kind of place", "Place", "What to look at", "The data", "Check 1", "Check 2", "Check 3", "Check 4", "Verdict"];
const DATA = 3, VERDICT_STEP = 8;
const page = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.3 } };
/** Water variables: wetter = navy, drier = ash. Everything else: rising = warming, falling = cooling. */
const trendTone = trendToneCss; // one source of truth, shared with /compare (see Globe.tsx)
/** Question headers report whether they are on screen, so the floating status pill can show only once the header has scrolled away. */
const HeaderSeen = createContext<(on: boolean) => void>(() => {});
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Snow "trends" in places that almost never have snow are just rounding noise, so we don't offer them. */
const TRACE_SNOW = 0.5; // kg/m², long-term mean

/** The case as written in the URL: ?type=&place=&v=&case=&step= */
function readUrl() {
  const q = new URLSearchParams(window.location.search), g = (k: string) => q.get(k) ?? "";
  const place = g("place"), v = g("v"), s = g("step"), n = Math.trunc(+s);
  const step = s !== "" && Number.isFinite(n) ? Math.min(VERDICT_STEP, Math.max(0, n)) : place && v ? DATA : 0;
  return { type: g("type"), place, v, caseId: g("case"), step };
}

export default function Explore() {
  const [meta, setMeta] = useState<Meta>(null);
  const [placeId, setPlaceId] = useState("");
  const [v, setV] = useState("");
  const [caseId, setCaseId] = useState("");
  const [step, setStep] = useState(0);
  const [type, setType] = useState("");
  const [ready, setReady] = useState(false); // true once the URL has been read
  const [region, setRegion] = useState<Region>(null);
  const [globalR, setGlobalR] = useState<Region>(null);
  const [err, setErr] = useState("");
  const lastStep = useRef(-1);
  const reduce = useReducedMotion();
  const [headerOn, setHeaderOn] = useState(true); // the question header is on screen
  const strip = useRef<HTMLOListElement>(null);

  // Keep the active step centred in the (horizontally scrolling) phone strip. scrollTo on the strip only, never the page.
  useEffect(() => {
    const c = strip.current, btn = c?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!c || !btn || c.scrollWidth <= c.clientWidth) return;
    c.scrollTo({ left: btn.offsetLeft - (c.clientWidth - btn.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  }, [step, ready, meta, reduce]);

  useEffect(() => {
    get("meta.json").then((m) => {
      setMeta(m);
      // A place in the URL that isn't in our data (e.g. a mistyped link): start over instead of failing.
      const place = new URLSearchParams(window.location.search).get("place");
      if (place && !m.regions.some((r: any) => r.id === place)) { setPlaceId(""); setV(""); setCaseId(""); setStep(0); }
    }).catch((e) => setErr(String(e)));
    get("regions/global.json").then(setGlobalR).catch(() => {});
  }, []);

  // Read the case from the URL after the first commit, not during render: on a client-side <Link> visit the
  // address bar still shows the previous page while we render. Also re-read it on Back/Forward, and when the
  // nav asks for a fresh case while we're already on this page.
  useEffect(() => {
    const apply = () => {
      const u = readUrl();
      setType(u.type); setPlaceId(u.place); setV(u.v); setCaseId(u.caseId); setStep(u.step);
      lastStep.current = u.step;
      setReady(true);
    };
    const reset = () => { setType(""); setPlaceId(""); setV(""); setCaseId(""); setStep(0); };
    apply();
    window.addEventListener("popstate", apply);
    window.addEventListener("explore:reset", reset);
    return () => { window.removeEventListener("popstate", apply); window.removeEventListener("explore:reset", reset); };
  }, []);

  // Load the chosen place, ignoring answers that arrive after the choice has changed.
  useEffect(() => {
    if (!meta || !placeId || !meta.regions.some((r: any) => r.id === placeId)) return;
    let live = true;
    get(`regions/${placeId}.json`).then((r) => live && setRegion(r)).catch((e) => live && setErr(String(e)));
    return () => { live = false; };
  }, [meta, placeId]);

  // Keep the URL in step: a new history entry per step (so Back goes back a step), replace for everything else.
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams();
    if (type) q.set("type", type);
    if (placeId) q.set("place", placeId);
    if (v) q.set("v", v);
    if (caseId) q.set("case", caseId);
    q.set("step", String(step));
    const url = `/explore?${q}`;
    if (url !== window.location.pathname + window.location.search) {
      if (step !== lastStep.current) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    }
    if (step !== lastStep.current) window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    lastStep.current = step;
  }, [ready, type, placeId, v, caseId, step]);

  const info = region?.id === placeId ? region : null;
  const raw = info && v ? info.variables[v] ?? null : null;
  // A variable this place doesn't have (from an edited link or a question), or snow where there's essentially none:
  // show the "what to look at" step instead of a case we can't make.
  const badVar = !!info && step >= DATA && (!raw || (v === "SNOMAS" && raw.mean < TRACE_SNOW));
  const d = badVar ? null : raw;

  if (err) return <p className="text-[var(--false-alarm)]">Could not load the data ({err}). Try reloading the page.</p>;
  if (!meta || !ready) return <Skeleton />;
  const statusText = info && v && d && step >= DATA
    ? [step === DATA ? "THE DATA" : step === VERDICT_STEP ? "VERDICT" : `CHECK ${step - DATA} OF 4`, info.name, NICE[v].short].join(" · ")
    : "";
  const demo = DEMOS.find((x) => x.id === caseId && x.place === placeId && x.v === v);
  const canReach = (i: number) => i <= 0 || (i === 1 && !!type) || (i === 1 && !!placeId) || (i === 2 && !!info) || (i >= DATA && !!d);
  const go = (i: number) => canReach(i) && setStep(i);
  const startDemo = (x: (typeof DEMOS)[number]) => { setCaseId(x.id); setType(""); setPlaceId(x.place); setV(x.v); setStep(DATA); };
  const ask = (place: string, k: string | null) => {
    setCaseId(""); setType(""); setPlaceId(place); setV(k ?? ""); setStep(k ? DATA : 2);
  };
  const newCase = () => { setCaseId(""); setType(""); setPlaceId(""); setV(""); setStep(0); };
  // e.detail > 1 is the second click of a double-click: ignore it so it can't skip a page.
  const once = (f: () => void) => ((e: React.MouseEvent) => { if (e.detail <= 1) f(); }) as unknown as () => void; // Button types onClick as () => void, but it passes the event through

  return (
    <div className="flex flex-col gap-7">
      {demo && (
        <div className="glass flex flex-wrap items-center justify-between gap-3 !rounded-2xl px-5 py-3.5">
          <span className="text-[15px] text-[var(--ink-dim)]"><Hud className="mr-3 rounded-full bg-accent px-2 py-0.5 text-accent-ink">DEMO CASE</Hud><span className="text-[var(--ink)]">{demo.title}</span></span>
          {(() => { const nx = DEMOS[(DEMOS.indexOf(demo) + 1) % DEMOS.length]; return <button type="button" className="pill !rounded-2xl py-2 text-left" onClick={() => startDemo(nx)}>Next demo: {nx.title}</button>; })()}
        </div>
      )}

      <nav aria-label="Case steps" className="flex flex-col gap-3">
        <div className="h-px bg-[var(--ink-faint)]">
          <motion.div className="h-px bg-[var(--signal)]" animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={reduce ? { duration: 0 } : undefined} />
        </div>
        <ol ref={strip} className="relative -mx-4 m-0 flex list-none flex-nowrap gap-1.5 overflow-x-auto px-5 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-1">
          {STEPS.map((s, i) => (
            <li key={s} className="shrink-0">
              <button type="button" onClick={() => go(i)} disabled={!canReach(i)} aria-current={i === step ? "step" : undefined}
                className={`hud relative min-h-11 whitespace-nowrap px-3.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${i === step ? "text-[var(--ink)]" : "text-[var(--ink-dim)] hover:text-[var(--ink)]"}`}>
                {i === step && <Brackets layoutId="case-steps" />}
                {s}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* Dynamic island: floats in only once the question header has scrolled out of view. The h1 carries the same info. */}
      <AnimatePresence>
        {statusText && !headerOn && (
          <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-[76px] z-30 flex justify-center px-4">
            <motion.div layout={!reduce} key="island" initial={reduce ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -12 }} transition={reduce ? { duration: 0 } : { duration: 0.3 }}
              className="glass-strong inline-flex max-w-[calc(100vw-32px)] items-center gap-2 !rounded-full px-4 py-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--signal)]" />
              <Hud className="truncate text-[var(--ink)]">{statusText}</Hud>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <HeaderSeen.Provider value={setHeaderOn}>
      <AnimatePresence mode="wait">
        <motion.div key={step} {...page}>
          {step === 0 && <KindStep meta={meta} type={type} pick={(t) => {
            setType(t); setCaseId("");
            if (placeId && meta.regions.find((r: any) => r.id === placeId)?.type !== t) { setPlaceId(""); setV(""); }
            setStep(1);
          }} startDemo={startDemo} ask={ask} />}
          {step === 1 && <PlaceStep meta={meta} type={type} placeId={placeId} pick={(id) => { setPlaceId(id); setV(""); setCaseId(""); setStep(2); }} />}
          {(step === 2 || badVar) && (info ? <WhatStep meta={meta} info={info} v={v} pick={(k) => { setV(k); setCaseId(""); setStep(DATA); }}
            note={badVar && v ? `We don't have a meaningful ${NICE[v]?.noun ?? "record"} record ${inPlace(info)}${v === "SNOMAS" ? " (it almost never snows there)" : ""}. Pick something else to look at.` : undefined} /> : <Loading />)}
          {step >= DATA && !badVar && (!info || !d ? <Loading /> : (
            step === DATA ? <DataStep meta={meta} info={info} v={v} d={d} />
              : step < VERDICT_STEP ? <CheckStep i={step - DATA - 1} meta={meta} info={info} v={v} d={d} />
                : <VerdictStep meta={meta} info={info} v={v} d={d} globalR={globalR} go={go} />
          ))}
        </motion.div>
      </AnimatePresence>
      </HeaderSeen.Provider>

      {step === VERDICT_STEP && d && <NextCase demo={demo} startDemo={startDemo} />}

      {step >= 1 && (
        <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--glass-stroke)] pt-5">
          <Button variant="glass" arrow="←" onClick={once(() => setStep((s) => Math.max(0, s - 1)))}>Back</Button>
          {step >= DATA && step < VERDICT_STEP && (
            <Button onClick={once(() => setStep((s) => Math.min(VERDICT_STEP, s + 1)))}>
              {step === DATA ? "Start the checks" : step === VERDICT_STEP - 1 ? "See the verdict" : `Next: check ${step - DATA + 1}`}
            </Button>
          )}
          {step === VERDICT_STEP && (
            <div className="flex flex-wrap gap-2">
              <Button variant="glass" arrow={false} onClick={once(() => { setCaseId(""); setV(""); setStep(2); })}>Look at something else here</Button>
              <Button onClick={once(newCase)}>Start a new case</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Lusion-style "keep scrolling" footer. Click or Enter only: it never navigates on scroll. */
function NextCase({ demo, startDemo }: { demo?: (typeof DEMOS)[number]; startDemo: (x: (typeof DEMOS)[number]) => void }) {
  const nx = DEMOS[demo ? (DEMOS.indexOf(demo) + 1) % DEMOS.length : 0];
  return (
    <button type="button" onClick={(e) => { if (e.detail <= 1) startDemo(nx); }}
      className="glass group relative flex w-full cursor-pointer flex-col items-start gap-3 !rounded-[var(--radius-sm)] px-6 py-8 text-left transition-colors hover:border-[var(--signal)]/50 sm:px-10 sm:py-12">
      <Hud className="text-[var(--ink-dim)]">KEEP SCROLLING · NEXT CASE →</Hud>
      <span className="font-display text-[clamp(32px,5.5vw,72px)] leading-[0.95] tracking-[-0.03em] text-[var(--ink)] transition-transform duration-300 group-hover:translate-x-2 motion-reduce:transition-none">{nx.title}</span>
    </button>
  );
}

const Loading = () => <p className="hud text-[var(--ink-dim)]" role="status">Loading…</p>;

function Skeleton() {
  const shim = "glass motion-safe:animate-pulse";
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading NASA data">
      <div className="h-px bg-[var(--ink-faint)]" />
      <div className={`h-10 w-2/3 !rounded-xl ${shim}`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={`h-[92px] ${shim}`} />)}
      </div>
    </div>
  );
}

function Question({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const report = useContext(HeaderSeen);
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => report(e.isIntersecting), { rootMargin: "-76px 0px 0px 0px" });
    io.observe(el);
    return () => { io.disconnect(); report(true); };
  }, [report]);
  // Move focus to the new question when the step changes (not on first load), so keyboard and
  // screen-reader users land on the new page instead of being dropped at the top of the document.
  useEffect(() => {
    if (first.current && !document.activeElement?.closest("main")) { first.current = false; return; }
    first.current = false;
    ref.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <header ref={box} className="mb-8 flex max-w-[860px] flex-col gap-3">
      <SectionLabel>{eyebrow}</SectionLabel>
      <h1 ref={ref} tabIndex={-1} className="text-balance font-display text-[clamp(36px,5vw,64px)] leading-[0.95] tracking-[-0.03em] outline-none">{title}</h1>
      {sub && <p className="max-w-[60ch] text-pretty text-lg leading-relaxed text-[var(--ink-dim)]">{sub}</p>}
    </header>
  );
}

const CHOICE = "glass relative flex cursor-pointer flex-col gap-1.5 !rounded-[var(--radius-sm)] p-5 text-left text-[var(--ink)] transition-colors hover:border-[var(--signal)]/50 aria-pressed:border-[var(--signal)]/60";

function AskBox({ meta, ask }: { meta: Meta; ask: (place: string, v: string | null) => void }) {
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const examples = ["Is New Jersey getting wetter?", "Is the Arctic warming?", "Is Beijing's air getting hazier?"];
  const submit = (text: string) => {
    const { place, v } = parseQuestion(text, meta.regions);
    if (place) { setMsg(""); ask(place, v); return; }
    const some = meta.regions.filter((r: any) => r.id !== "global").slice(0, 6).map((r: any) => r.name).join(", ");
    setMsg(v ? `We know you're asking about ${NICE[v].noun}, but not where. We have ${meta.regions.length} places, like ${some}, or "Earth" for the whole planet.`
      : `We couldn't match that to a place in our data. Try a place like ${some}, and a word like warmer, wetter, snow or haze.`);
  };
  return (
    <form className="glass mb-8 flex flex-col gap-3 !rounded-[var(--radius-sm)] p-5" onSubmit={(e) => { e.preventDefault(); submit(q); }}>
      <label htmlFor="ask"><SectionLabel>ASK A QUESTION</SectionLabel></label>
      <div className="flex flex-wrap gap-2">
        <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Is New Jersey getting wetter?" autoComplete="off"
          className="min-h-12 min-w-0 flex-[1_1_260px] rounded-full border border-white/20 bg-[var(--void)]/60 px-5 text-[16px] text-[var(--ink)] placeholder:text-[var(--ink-dim)]" />
        <Button type="submit">Investigate</Button>
      </div>
      <p className="text-[13px] text-[var(--ink-dim)]">Try:{" "}
        {examples.map((x, i) => <span key={x}>{i > 0 && " · "}<button type="button" className="inline-flex min-h-11 items-center text-ink underline decoration-[var(--ink-faint)] underline-offset-4" onClick={() => { setQ(x); submit(x); }}>{x}</button></span>)}
      </p>
      <p role="status" className="text-[14px] text-[var(--ink-dim)]">{msg}</p>
    </form>
  );
}

function KindStep({ meta, type, pick, startDemo, ask }: { meta: Meta; type: string; pick: (t: string) => void; startDemo: (x: (typeof DEMOS)[number]) => void; ask: (place: string, v: string | null) => void }) {
  const types = [...new Set<string>(meta.regions.map((r: any) => r.type))];
  return (
    <section>
      <AskBox meta={meta} ask={ask} />
      <Question eyebrow="Or step by step · Question 1" title="What kind of place do you want to investigate?" sub="Different places change in different ways. We'll suggest what to look at for each kind." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => {
          const rs = meta.regions.filter((r: any) => r.type === t);
          return (
            <button key={t} type="button" onClick={() => pick(t)} aria-pressed={t === type} className={`min-h-[92px] ${CHOICE}`}>
              {t === type && <Brackets layoutId="kind-pick" />}
              <Hud className="text-[var(--ink-dim)]">{rs.length} {rs.length === 1 ? "PLACE" : "PLACES"}</Hud>
              <span className="text-lg text-[var(--ink)]">{TYPE_LABEL[t] ?? t}</span>
              <span className="text-sm text-[var(--ink-dim)]">{rs.map((r: any) => r.name).join(" · ")}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-6 text-[15px] text-[var(--ink-dim)]">Not sure? Try a demo case:{" "}
        {DEMOS.map((x, i) => <span key={x.id}>{i > 0 && " · "}<button type="button" onClick={() => startDemo(x)} className="inline-flex min-h-11 cursor-pointer items-center text-ink underline decoration-[var(--ink-faint)] underline-offset-4">{x.title}</button></span>)}
        {" · "}<Link href="/compare" className="inline-flex min-h-11 items-center">Same cause, opposite effects: Amazon vs Himalaya</Link>
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
          <button key={r.id} type="button" onClick={() => pick(r.id)} aria-pressed={r.id === placeId} className={CHOICE}>
            {r.id === placeId && <Brackets layoutId="place-pick" />}
            <Hud className="text-[var(--ink-dim)]">{TYPE_LABEL[r.type] ?? r.type}</Hud>
            <span className="text-lg text-[var(--ink)]">{r.name}</span>
            <span className="text-[15px] leading-normal text-[var(--ink-dim)]">{r.blurb}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function WhatStep({ meta, info, v, pick, note }: { meta: Meta; info: Region; v: string; pick: (k: string) => void; note?: string }) {
  const suggested: string[] = meta.regions.find((r: any) => r.id === info.id).suggested;
  const order = [...info.screener]
    .filter((k: string) => !(k === "SNOMAS" && info.variables[k].mean < TRACE_SNOW))
    .sort((a: string, b: string) => +suggested.includes(b) - +suggested.includes(a));
  return (
    <section>
      <Question eyebrow={`Question 3 · ${info.name}`} title={`What do you want to look at ${inPlace(info)}?`}
        sub={`${info.blurb} The ones marked ★ matter most for a ${(TYPE_LABEL[info.type] ?? info.type).toLowerCase()} place.`} />
      {note && <p role="status" className="mb-4 !rounded-2xl glass px-5 py-3 text-[15px] text-[var(--ink)]">{note}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {order.map((k: string) => (
          <button key={k} type="button" onClick={() => pick(k)} aria-pressed={k === v} className={CHOICE}>
            {k === v && <Brackets layoutId="what-pick" />}
            <Hud className="text-[var(--ink-dim)]">{k} · {NICE[k].units}</Hud>
            <span className="text-lg text-[var(--ink)]">{NICE[k].short}{suggested.includes(k) && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 align-middle font-mono text-[10px] uppercase text-accent-ink">Suggested</span>}</span>
            <span className="text-[15px] leading-normal text-[var(--ink-dim)]">{meta.variables[k].definition}</span>
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
  const ensoOn = enso && view === "year";
  // Beijing haze: ground-station observations to check MERRA-2 against (see pipeline/aeronet.py).
  const [check, setCheck] = useState<any>(null);
  const showCheck = info.id === "beijing" && v === "TOTEXTTAU";
  useEffect(() => {
    if (!showCheck) return;
    let live = true;
    get("validation/beijing_aeronet.json").then((x) => live && setCheck(x)).catch(() => {});
    return () => { live = false; };
  }, [showCheck]);
  const overlays = showCheck && check && view === "year" && !enso
    ? check.sites.map((st: any, i: number) => ({ label: `NASA AERONET ground station "${st.site}"`, color: i ? "var(--cooling)" : "var(--ink)", points: st.years.map((y: number, j: number) => [y, st.aod550[j]]) }))
    : [];
  return (
    <section>
      <Question eyebrow={`The data · ${info.name} · ${n.short}`} title={headline(v, inPlace(info), d, meta.years).title}
        sub={`That's ${signed(d.slope_decade)} ${n.units} every 10 years. But is it a real trend, or just noise? The next four pages check.`} />
      {meta.variables[v].caveat && <p className="mb-4 text-sm text-[var(--ink-dim)]"><Hud className="mr-2 text-[var(--ink)]">Caution</Hud>{meta.variables[v].caveat}</p>}
      <Card className="flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-xl">{view === "year" ? `Average ${n.noun} each year` : `${n.short} each month, compared with a normal month`}</h2>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Chart view">
            <button type="button" className="pill" aria-pressed={view === "year"} onClick={() => setView("year")}>Yearly averages</button>
            <button type="button" className="pill" aria-pressed={view === "month"} onClick={() => setView("month")}>Month by month</button>
            <label className={`pill flex items-center gap-2 ${view === "month" ? "pointer-events-none opacity-40" : ""}`}>
              <input type="checkbox" className="h-[18px] w-[18px] accent-[var(--signal)]" checked={ensoOn} disabled={view === "month"} onChange={(e) => setEnso(e.target.checked)} />
              Remove El Niño
            </label>
          </div>
        </div>
        {view === "year"
          ? <TrendChart years={meta.years} y={yearly} perYear={1} slope={slope} intercept={enso ? undefined : d.intercept}
              ci={enso ? undefined : [d.ci_decade[0] / 10, d.ci_decade[1] / 10]} trendColor={trendTone(v, slope)} units={n.units} title={`${n.short} ${inPlace(info)}`} overlays={overlays} />
          : <TrendChart years={meta.years} y={d.monthly_anom} perYear={12} slope={d.slope_decade / 10} trendColor={trendTone(v, d.slope_decade)} units={n.units} title={`${n.short} ${inPlace(info)}, monthly`} />}
        <p className="text-sm text-[var(--ink-dim)]">
          {view === "year"
            ? "Each dot is one year's average, so summer and winter cancel out. The coloured line is the trend; the shaded wedge shows the range of slopes we're 95% sure of."
            : "Each point is one month minus a normal month for that time of year, so the seasons are removed but you can see every wiggle. El Niño removal works on yearly averages only."}
          {ensoOn && ` El Niño (a natural Pacific Ocean cycle) removed: the trend is ${signed(d.slope_enso_decade)} ${n.units} per decade instead of ${signed(d.slope_decade)} (corrected p ${pfmt(d.p_enso_hr)}).`}
        </p>
      </Card>
      {showCheck && check && <GroundCheck check={check} />}
    </section>
  );
}

function CheckStep({ i, meta, info, v, d }: { i: number; meta: Meta; info: Region; v: string; d: any }) {
  const c = checks(v, d)[i], n = NICE[v];
  return (
    <section>
      <Question eyebrow={`Check ${i + 1} of 4 · ${info.name} · ${n.short}`} title={c.q} />
      <Card className="flex flex-col gap-6 p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-4">
          <CheckStamp pass={c.pass} />
          {c.pass == null && <span className="font-display text-2xl text-[var(--ink-dim)]">Too weak in each half to tell</span>}
        </div>
        <CheckVisual i={i} meta={meta} v={v} d={d} />
        <p className="max-w-[60ch] text-lg leading-relaxed text-[var(--ink-dim)]">{c.text}</p>
        <p className="text-sm text-[var(--ink-dim)]">{c.note}</p>
      </Card>
    </section>
  );
}

/** The stamp lands after the visual has drawn. */
function CheckStamp({ pass }: { pass: boolean | null }) {
  const reduce = useReducedMotion();
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setOn(true), reduce ? 0 : 900);
    return () => window.clearTimeout(id);
  }, [reduce]);
  return (
    <div className="min-h-[38px]">
      {on && (pass == null ? <VerdictStamp verdict="not-proven" /> : pass ? <VerdictStamp verdict="passed" /> : <VerdictStamp verdict="failed">NOT PASSED</VerdictStamp>)}
    </div>
  );
}

function Bar({ label, value, max, color, text, line }: { label: string; value: number; max: number; color: string; text: string; line?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="w-64 shrink-0 text-[15px] text-[var(--ink-dim)]">{label}</span>
      <div className="h-7 min-w-[140px] flex-1 rounded-md bg-white/[0.06]" aria-hidden="true">
        <motion.div className="h-full rounded-md" style={line ? { border: "1px solid var(--signal)", background: "repeating-linear-gradient(135deg, color-mix(in srgb, var(--signal) 18%, transparent) 0 4px, transparent 4px 8px)" } : { background: color }}
          initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.min(100, (value / max) * 100)}%` }} transition={{ duration: reduce ? 0 : 0.7 }} />
      </div>
      <span className="hud w-44 shrink-0 !normal-case tabular-nums text-[var(--ink)]">{text}</span>
    </div>
  );
}

function CheckVisual({ i, meta, v, d }: { i: number; meta: Meta; v: string; d: any }) {
  const u = NICE[v].units;
  if (i === 0) {
    const tot = Math.abs(d.total_change), wob = d.noise_level, max = Math.max(tot, wob * 2);
    return (
      <div className="flex flex-col gap-3">
        <Bar label="Total change since 1980" value={tot} max={max} color={trendTone(v, d.slope_decade)} text={`${fmt(tot)} ${u}`} />
        <Bar label="Normal wobble (one year)" value={wob} max={max} color="var(--ink-dim)" text={`${fmt(wob)} ${u}`} />
        <Bar label="Pass line (2 × wobble)" value={wob * 2} max={max} color="var(--signal)" line text={`${fmt(wob * 2)} ${u}`} />
      </div>
    );
  }
  if (i === 1) {
    const beat = Math.max(0, Math.round(d.p_perm * 2001) - 1);
    return (
      <div className="flex flex-col gap-3">
        <Bar label="Shuffles that beat the real data" value={beat} max={2000} color="var(--false-alarm)" text={`${beat.toLocaleString("en-US")} of 2,000`} />
        <Bar label="Pass line (5 in 100)" value={100} max={2000} color="var(--signal)" line text="100 of 2,000" />
      </div>
    );
  }
  if (i === 2) {
    const pct = Math.min(100, d.q * 100);
    return (
      <div className="flex flex-col gap-3">
        <Bar label="False-alarm rate" value={Math.max(pct, 0.4)} max={50} color="var(--false-alarm)" text={d.q < 0.0001 ? "under 0.01%" : `${fmt(pct)}%`} />
        <Bar label="Pass line" value={5} max={50} color="var(--signal)" line text="5%" />
      </div>
    );
  }
  return <TrendChart years={meta.years} y={d.annual} perYear={1} slope={d.slope_decade / 10} intercept={d.intercept} split={meta.split_year} trendColor={trendTone(v, d.slope_decade)} units={u} title={`${NICE[v].short}, first and second half`} />;
}

function VerdictStep({ meta, info, v, d, globalR, go }: { meta: Meta; info: Region; v: string; d: any; globalR: Region; go: (i: number) => void }) {
  const [grid, setGrid] = useState<Grid>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  useEffect(() => {
    let live = true;
    get(`grid/${v}.json`).then((x) => live && setGrid(x)).catch(() => {});
    return () => { live = false; };
  }, [v]);
  const g = grid?.var === v ? grid : null;
  const n = NICE[v], vd = VERDICT[d.verdict], cs = checks(v, d), h = headline(v, inPlace(info), d, meta.years);
  const gl = globalR?.variables[v];
  // A "times as fast" ratio only means something when the whole-Earth trend is itself real and points the same way.
  const ratio = gl && gl.verdict === "significant" && Math.sign(gl.slope_decade) === Math.sign(d.slope_decade) ? d.slope_decade / gl.slope_decade : null;
  const focus = useMemo(() => {
    const [a, b, c, e] = info.box;
    return info.id === "global" ? { lat: 30, lng: -20, altitude: 2.2 }
      : info.id === "arctic" ? { lat: 85, lng: 0, altitude: 2 }
        : { lat: (a + b) / 2, lng: (c + e) / 2, altitude: Math.min(2.2, Math.max(1.5, Math.max(b - a, e - c) / 45 + 1.2)) }; // far enough out to still read as a globe
  }, [info]);
  const tone = vd.tone === "real" ? "var(--signal)" : vd.tone === "maybe" ? "var(--ink-dim)" : "var(--noise)";

  return (
    <section className="flex flex-col gap-6">
      <Question eyebrow={`Verdict · ${info.name} · ${n.short}`} title={h.title} />
      <div className="flex flex-wrap gap-6">
        <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-5">
          <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4 }}
            className="glass flex flex-col gap-3 !rounded-[20px] p-7" style={{ borderColor: tone }}>
            <SectionLabel>VERDICT</SectionLabel>
            <div><VerdictStamp verdict={vd.tone === "real" ? "passed" : "not-proven"} className={vd.tone === "none" ? "!border-noise !text-ink-dim" : ""}>{vd.label}</VerdictStamp></div>
            <span className="max-w-[60ch] text-lg leading-relaxed text-[var(--ink-dim)]">{h.sub}</span>
          </motion.div>
          <Card className="flex flex-col gap-1 p-4">
            {cs.map((c, i) => (
              <button key={c.q} type="button" onClick={() => go(DATA + 1 + i)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] text-[var(--ink)] hover:bg-white/[0.06]">
                <span>{i + 1}. {c.q}{i === 2 && <span className="text-[13px] text-[var(--ink-dim)]"> (decides the verdict)</span>}</span>
                <Badge tone={c.pass == null ? "na" : c.pass ? "pass" : "fail"}>{c.pass == null ? "n/a" : c.pass ? "Passed" : "Not passed"}</Badge>
              </button>
            ))}
          </Card>
          {d.verdict === "possible" && d.years_more != null && (
            <Card className="border-dashed text-[15px] leading-relaxed text-[var(--ink-dim)]">
              <b className="font-normal text-[var(--ink)]">How long until we&apos;d know? </b>
              {d.years_more > 50
                ? <>At this size, it would take many decades more data (over {Math.floor(d.years_more / 10) * 10} years) to be fairly sure. The trend is small next to the normal ups and downs.</>
                : d.years_more > 0
                  ? <>If this trend is real and keeps its current size, about {d.years_more} more years of data (around {meta.years.at(-1) + d.years_more}) would give a 90% chance of detecting it at this one place. The strict all-tests check may need a little longer.</>
                  : <>By this estimate the record is about long enough already. The strict test also corrects for 184 tests at once, so it may need a few more years.</>}
            </Card>
          )}
          {gl && info.id !== "global" && (
            <Card className="flex flex-col gap-4">
              <SectionLabel>COMPARED WITH THE WHOLE PLANET</SectionLabel><h2 className="sr-only">Compared with the whole planet</h2>
              {[[info.name, d.slope_decade, trendTone(v, d.slope_decade)], ["Whole Earth", gl.slope_decade, "var(--ink-dim)"]].map(([name, s, c]) => (
                <Bar key={name as string} label={name as string} value={Math.abs(s as number)} max={Math.max(Math.abs(d.slope_decade), Math.abs(gl.slope_decade)) || 1}
                  color={c as string} text={`${signed(s as number)} ${n.units} per decade`} />
              ))}
              <p className="text-[15px] leading-relaxed text-[var(--ink-dim)]">
                {ratio != null
                  ? <>{cap(placeName(info))} is changing <b className="font-normal text-[var(--ink)]">{fmt(ratio, 2)} times as fast</b> as Earth as a whole (its trend divided by the planet&apos;s).</>
                  : gl.verdict !== "significant"
                    ? <>Earth as a whole has no proven trend in {n.noun}, so there&apos;s no planet-wide speed to compare with.</>
                    : <>{cap(placeName(info))} is moving in the opposite direction from Earth as a whole.</>}
                {info.id === "arctic" && v === "T2M" && meta.sanity?.matched && (
                  <> Scientists call this <b className="font-normal text-[var(--ink)]">Arctic amplification</b>. One big reason: melting ice and snow uncover darker ground and water that soak up more sunlight.
                    A 2022 study using observations found about 3.8 times for 1979–2021; our NASA data gives {fmt(meta.sanity.matched.ratio, 2)} times for nearly the same years (1980–2021), within the range different data sets give.</>
                )}
              </p>
            </Card>
          )}
        </div>
        <figure className="m-0 flex min-w-0 flex-[1_1_400px] flex-col items-center gap-3">
          <figcaption className="self-start text-[15px] text-[var(--ink-dim)]"><b className="font-normal text-[var(--ink)]">{n.short} trends around {placeName(info)}</b> (outlined), strict test. Click any square for its numbers.</figcaption>
          <div className="w-full max-w-[min(520px,82vw)]">
            <Globe grid={g} mode="real" focus={focus} box={info.id === "global" ? undefined : info.box} pick={pick}
              onPick={(p) => g && setPick(cellAt(g, meta.grid.lat, meta.grid.lon, p))}
              label={`Globe zoomed to ${info.name}, showing ${n.short} trends that pass the strict test.`} />
          </div>
          <GlobeScale grid={g} units={n.units} mode="real" />
          <div className="w-full"><CellInfo meta={meta} grid={g} v={v} pick={pick} mode="real" enso={false} onClose={() => setPick(null)} /></div>
        </figure>
      </div>
      <details className="glass !rounded-[20px] px-7 py-5">
        <summary className="hud flex min-h-11 cursor-pointer items-center text-[var(--ink)]">The statistics, for the curious</summary>
        <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm leading-normal md:grid-cols-2">
          {[
            [`Sen's slope: ${signed(d.slope_decade)} ${n.units}/decade (95% range ${fmt(d.ci_decade[0])} to ${fmt(d.ci_decade[1])})`, "The median of the slopes between every pair of years (1,035 pairs). Unlike a regular best-fit line, one odd year can't drag it."],
            [`Mann-Kendall p: ${pfmt(d.p_naive)} simple, ${pfmt(d.p_hr)} corrected`, "How often pure noise would make an up-or-down pattern at least this consistent. The corrected value uses the Hamed-Rao method for years that resemble the year before."],
            [`Luck test (shuffled years) p: ${pfmt(d.p_perm)}`, "The share of 2,000 shuffled versions of the data that showed a trend at least this strong."],
            [`False-alarm rate q: ${pfmt(d.q)}`, "Benjamini-Hochberg across all 184 tests: if we called every trend this strong \"real\", this is the share we'd expect to be false alarms. Under 0.05 = real signal."],
            [`Normal wobble: ${fmt(d.noise_level)} ${n.units}, year-to-year memory ${fmt(d.autocorr)}`, "Wobble is the typical distance of a year from the trend line. Memory (lag-1 autocorrelation) is how much each year looks like the one before, from −1 to 1."],
            [`El Niño effect: ${signed(d.enso_coef)} ${n.units} per °C of Niño 3.4 (p ${pfmt(d.enso_p)})`, "How much this place's yearly average shifts for each 1 °C of El Niño warming in the central Pacific (the NOAA Niño 3.4 index), from a fit of trend plus that index."],
          ].map(([t, dd]) => (
            <div key={t}><dt className="text-[var(--ink)]">{t}</dt><dd className="ml-0 mt-0.5 text-[var(--ink-dim)]">{dd}</dd></div>
          ))}
        </dl>
      </details>
      <ShareTools title={`${n.short} ${inPlace(info)}, ${meta.years[0]}–${meta.years.at(-1)}: ${vd.label}`} filename={`trend-detective-${info.id}-${v}`}
        header={["year", `${v} (${n.units}, yearly mean)`, "trend line (Sen's slope)"]}
        rows={d.annual.map((x: number, i: number) => [meta.years[i], x, +(d.intercept + (d.slope_decade / 10) * i).toPrecision(5)])}
        notes={[`${n.short} ${inPlace(info)} (${info.name}; box ${info.box.join(", ")} as lat min, lat max, lon min, lon max)`,
          "Source: NASA GMAO MERRA-2 monthly reanalysis via NASA GES DISC; yearly means of the monthly values.",
          `Sen's slope ${d.slope_decade} ${n.units} per decade (95% range ${d.ci_decade[0]} to ${d.ci_decade[1]}); Mann-Kendall p ${d.p_naive}; Hamed-Rao p ${d.p_hr}; false-alarm rate q ${d.q}; verdict: ${vd.label}`]} />
      <p className="text-sm text-[var(--ink-dim)]">Want the whole planet? <Link href={`/globe?v=${v}`}>Open the globe for {n.noun}</Link>.</p>
    </section>
  );
}

/** Beijing haze: what NASA's AERONET ground stations saw, next to MERRA-2. */
function GroundCheck({ check }: { check: any }) {
  const [a, b] = check.sites;
  return (
    <Card className="mt-5 flex flex-col gap-3">
      <SectionLabel>CHECKED AGAINST THE GROUND</SectionLabel>
      <h2 className="sr-only">Checked against the ground</h2>
      <p className="text-[15px] leading-relaxed text-[var(--ink-dim)]">
        MERRA-2&apos;s haze trend could partly come from changes in which satellites were fed into the model. So we compared it with
        NASA&apos;s AERONET sun photometers in Beijing: two ground instruments, each one consistent over its whole record (the diamonds on the chart).
        They tell the same story: haze highest around {a.peak_year} and falling since the mid-2010s. Year by year they move with MERRA-2
        (correlation {a.correlation} for &quot;{a.site}&quot;, {a.years[0]}–{a.years.at(-1)}, and {b.correlation} for &quot;{b.site}&quot;, {b.years[0]}–{b.years.at(-1)}),
        and the two stations agree where they overlap.
      </p>
      <p className="text-[13px] leading-relaxed text-[var(--ink-dim)]">
        The stations read higher than MERRA-2 (about {a.mean_ratio_to_merra2}× and {b.mean_ratio_to_merra2}×) because they sit in the city, while MERRA-2 averages a region about 300 km across.
        MERRA-2 also takes in AERONET and satellite data, so this checks consistency rather than being fully independent. Years with fewer than 9 measured months are left out.
      </p>
    </Card>
  );
}
