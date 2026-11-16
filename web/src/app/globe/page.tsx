"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DEMOS, NICE, VERDICT, fmt, get, pfmt, signed, type Grid, type Meta } from "@/lib/data";
import { GlobeScale, cellAt, coast, flatMap, type Mode, type Pick } from "@/components/Globe";
import { ColumnGlobe, type Target, type YearView } from "@/components/ColumnGlobe";
import { CellInfo, hudLines } from "@/components/CellInfo";
import { Brackets, SectionLabel } from "@/components/ui";
import { reducedMotion } from "@/components/globeFx";

const STEPS: { mode: Mode; step: string; short: string; noun: string; text: string; color: string }[] = [ // color = the CSS variable that carries the step's meaning
  { mode: "naive", step: "Step 1 · The simple test", short: "Simple test", noun: "places look like they have a trend", color: "var(--ink)",
    text: "Each place checked on its own. That's how most maps are made, but it lets luck in." },
  { mode: "noise", step: "Step 2 · The luck test", short: "Luck test", noun: "false alarms from shuffled data", color: "var(--false-alarm)",
    text: "We scrambled every place's years so no real trend is left. The simple test still \"finds\" a trend in about 1 place in 20. That's pure luck." },
  { mode: "real", step: "Step 3 · The strict test", short: "Strict test", noun: "places with a real signal", color: "var(--signal)",
    text: "Corrected for years that resemble each other and for testing every place at once. Of the squares that survive, at most about 1 in 20 should be a false alarm." },
];
const n0 = (x: number) => x.toLocaleString("en-US");
const ll = (lat: number, lon: number) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
const easeIO = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/** Rolls up from 0 in step with the columns (1.2 s, ease-in-out) when `run` turns on, and always lands on the exact value. */
function RollCount({ value, run }: { value: number; run: boolean }) {
  const [rolling, setRolling] = useState<number | null>(null);
  useEffect(() => {
    if (!run || reducedMotion()) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1200);
      setRolling(p < 1 ? Math.round(value * easeIO(p)) : null);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, run]);
  return <>{n0(run && rolling != null ? rolling : value)}</>;
}

// WebGL and reduced motion are only known in the browser; the server renders the 3D version's shell.
let flatCache: boolean | null = null;
const wantFlat = () => (flatCache ??= (() => { const cv = document.createElement("canvas"); return !(cv.getContext("webgl2") || cv.getContext("webgl")) || reducedMotion(); })());
const noSubscribe = () => () => {};
// Whether the page was opened to play the tour (?tour=1): known before any data arrives.
const tourInAddress = () => new URLSearchParams(window.location.search).has("tour");

/** Colour key for the year scrubber. */
function YearKey({ year }: { year: number }) {
  return (
    <div className="flex w-full flex-col gap-2 text-[13px] text-ink-dim">
      <div className="hud flex items-center gap-3">
        <span className="w-16 text-right">cooler</span>
        <div className="h-3 flex-1 rounded-full" aria-hidden="true" style={{ background: "linear-gradient(90deg, #6b7280, #3a3a3c, #242425, #3a3a3a, #f5f5f2)" }} />
        <span className="w-16">warmer</span>
      </div>
      <p className="text-center text-[12px]"><span className="num">{year}</span> air temperature compared with each square&apos;s own 1980–2025 average. Taller = further from normal (3 °C or more is full height). Real yearly NASA values, nothing smoothed.</p>
    </div>
  );
}

type Anom = { a: Int8Array; years: number[]; step: number; nodata: number; nCells: number };

/** Readable 2D map of the same step, for devices without WebGL or visitors who ask for reduced motion. Click a square for its numbers. */
function FlatFallback({ grid, mode, enso, onPick, loading }: { grid: Grid | null; mode: Mode; enso: boolean; onPick: (p: { lat: number; lng: number }) => void; loading: string }) {
  const [c, setC] = useState<Path2D | null | undefined>(undefined);
  useEffect(() => { coast().then(setC); }, []);
  const src = useMemo(() => (grid && c !== undefined ? flatMap(grid, mode, enso, c) : null), [grid, mode, enso, c]);
  return (
    // Sits in the space the overlays leave free: under the chips, beside (desktop) or above (phone) the step cards.
    <div className="absolute inset-x-4 bottom-[150px] top-[240px] flex items-center justify-center sm:bottom-6 sm:left-[408px] sm:right-6 sm:top-[220px]">
      {!src && <div role="status"><p className="hud nav-glass flex items-center gap-2 rounded-full px-4 py-2 !text-[var(--ink)]"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--ink)] motion-safe:animate-pulse" />{loading}</p></div>}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Flat world map of the trends at this step" className="max-h-full w-auto max-w-full cursor-crosshair rounded-[var(--radius-md)] border border-hairline object-contain"
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onPick({ lat: 90 - ((e.clientY - r.top) / r.height) * 180, lng: ((e.clientX - r.left) / r.width) * 360 - 180 }); }} />
      )}
    </div>
  );
}

export default function GlobePage() {
  const [meta, setMeta] = useState<Meta>(null);
  const [v, setV] = useState("T2M");
  const [grid, setGrid] = useState<Grid>(null);
  const [mode, setMode] = useState<Mode>("naive");
  const [enso, setEnso] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const [place, setPlace] = useState<Target | null>(null);
  const flat = useSyncExternalStore(noSubscribe, wantFlat, () => false);
  const tourAsked = useSyncExternalStore(noSubscribe, tourInAddress, () => false);
  const [err, setErr] = useState("");
  const [anom, setAnom] = useState<Anom | null>(null);
  const [yearIdx, setYearIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  // Shareable links: ?v=&region=&enso=1&year= . The address is read once, when the page opens.
  const initial = useRef<URLSearchParams | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    initial.current = new URLSearchParams(window.location.search);
    get("meta.json").then((m) => {
      setMeta(m);
      // ?v= picks the variable (e.g. from a case's verdict). Read after commit, not during render: see explore/page.tsx.
      const q = initial.current!.get("v");
      if (q && m.grid_summary[q]) setV(q);
      if (initial.current!.get("enso") === "1") setEnso(true);
    }).catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => {
    let live = true;
    get(`grid/${v}.json`).then((x) => live && setGrid(x)).catch((e) => live && setErr(String(e)));
    return () => { live = false; };
  }, [v]);

  const g = grid?.var === v ? grid : null; // the numbers wait for the new variable; the globe keeps the old picture meanwhile
  // Year scrubber (air temperature only): one year of real anomalies at a time.
  const yearOn = v === "T2M" && yearIdx != null && !!anom;
  const year: YearView | null = useMemo(() => (yearOn && anom ? { a: anom.a, idx: yearIdx!, step: anom.step, nodata: anom.nodata, nCells: anom.nCells } : null), [yearOn, anom, yearIdx]);
  useEffect(() => {
    if (!playing || !anom) return;
    const id = window.setInterval(() => setYearIdx((i) => {
      const nx = (i ?? -1) + 1;
      if (nx >= anom.years.length - 1) setPlaying(false);
      return Math.min(nx, anom.years.length - 1);
    }), 450);
    return () => window.clearInterval(id);
  }, [playing, anom]);
  const loadAnom = async () => {
    if (anom) return anom;
    try {
      const [info, buf] = await Promise.all([get("grid/T2M_anom.json"), fetch("/data/grid/T2M_anom.bin").then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })]);
      const A: Anom = { a: new Int8Array(buf), years: info.years, step: info.step, nodata: info.nodata, nCells: info.shape[0] * info.shape[1] };
      setAnom(A);
      return A;
    } catch (e) { setErr(`the yearly data (${e})`); return null; }
  };
  const startYears = async () => { if (await loadAnom()) { setYearIdx(0); setPlaying(true); } };
  const showYear = async (y: number) => { const A = await loadAnom(); const i = A ? A.years.indexOf(y) : -1; if (i >= 0) { setPlaying(false); setYearIdx(i); } };
  const stopYears = () => { setPlaying(false); setYearIdx(null); };
  // A clicked square's own numbers, or a region / demo case picked from the menu.
  const target: Target | null = useMemo(() => {
    if (pick) {
      const lines = hudLines(g, v, pick, mode, enso);
      return lines ? { key: `cell-${pick.k}`, lat: pick.lat, lng: pick.lon, lines, href: `/explore?place=${encodeURIComponent(`pt:${pick.lat},${pick.lon}`)}&v=${v}&step=data`, linkLabel: "Open a case here" } : null;
    }
    return place;
  }, [pick, place, g, v, mode, enso]);

  const choose = (k: string) => { if (k !== "T2M") stopYears(); setV(k); };
  const pickCell = (p: { lat: number; lng: number }) => { if (g && meta) { setPlace(null); setPick(cellAt(g, meta.grid.lat, meta.grid.lon, p)); } };

  // A region or demo case from the menu: fly there and label it with that place's own trend and q.
  const jump = async (val: string) => {
    const demo = DEMOS.find((x) => `demo:${x.id}` === val);
    const id = demo ? demo.place : val, k = demo ? demo.v : v;
    const r = meta?.regions.find((x: any) => x.id === id);
    if (!r) return;
    if (k !== v) choose(k);
    const d = (await get(`regions/${id}.json`)).variables[k];
    const [a, b, c, e] = r.box, wrapAll = e - c >= 359;
    setPick(null);
    setPlace({
      key: `place-${val}`, lat: wrapAll ? 75 : (a + b) / 2, lng: wrapAll ? 0 : (c + e) / 2,
      lines: [`${r.name.toUpperCase()} · ${ll(wrapAll ? 75 : (a + b) / 2, wrapAll ? 0 : (c + e) / 2)}`,
        d ? `${k} ${signed(d.slope_decade)} ${NICE[k].units}/DEC` : `${k} · NO DATA HERE`,
        d ? `${d.q < 0.0001 ? "q < 0.0001" : `q = ${fmt(d.q, 2)}`} ▸ ${VERDICT[d.verdict].label}` : ""].filter(Boolean),
      href: `/explore?place=${id}&v=${k}${demo ? `&case=${demo.id}` : ""}&step=data`,
    });
  };


  // Guided tour, "Watch the investigation": about 30 s that drives the features above on a timer (no new visuals).
  // It waits for the globe's columns (up to 20 s), then runs. Esc or any click stops it; ending or stopping puts back the
  // page as it was before (variable, step, El Niño, place, year, and the exact address). Under reduced motion the flat
  // map is shown, so steps cut instead of flying.
  type Caption = { n: number; eyebrow: string; text: string; final?: [string, string][] };
  type Snapshot = { v: string; mode: Mode; enso: boolean; pick: Pick | null; place: Target | null; yearIdx: number | null; url: string };
  const [tour, setTour] = useState<Caption | null>(null);
  const [pending, setPending] = useState(false);
  const [built, setBuilt] = useState(false);
  const timers = useRef<number[]>([]);
  const autoTried = useRef(false);
  const snap = useRef<Snapshot | null>(null);
  const running = useRef(false);
  const restoreUrl = useRef<string | null>(null);
  const endTour = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [];
    running.current = false;
    setTour(null); setPending(false);
    const s0 = snap.current;
    snap.current = null;
    if (!s0) return;
    setV(s0.v); setMode(s0.mode); setEnso(s0.enso); setPick(s0.pick); setPlace(s0.place); setPlaying(false); setYearIdx(s0.yearIdx);
    restoreUrl.current = s0.url;
  }, []);
  const requestTour = () => {
    if (!meta || tour || pending) return;
    // The address to put back afterwards: as it was, minus ?tour=1, so a reload doesn't replay the tour.
    const q = new URLSearchParams(window.location.search);
    q.delete("tour");
    snap.current = { v, mode, enso, pick, place, yearIdx, url: window.location.pathname + (q.size ? `?${q}` : "") };
    setPending(true);
  };
  const runTour = async () => {
    if (!meta || running.current) return;
    running.current = true;
    timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [];
    stopYears(); setPick(null); setPlace(null); setEnso(false); setMode("naive");
    if (v !== "T2M") choose("T2M");
    const S = meta.grid_summary.T2M, r = (await get("regions/arctic.json")).variables.T2M;
    const steps: [number, string, string, () => void, [string, string][]?][] = [
      [0, "NASA MERRA-2 · 1980–2025", `${n0(S.cells)} places on Earth, each tested for a trend.`, () => {}],
      [3500, "The Arctic", "Is the Arctic really warming?", () => { jump("demo:arctic"); }],
      [8000, "Air temperature · the Arctic", `${signed(r.slope_decade)} °C per decade: about ${fmt(r.total_change, 2)} °C warmer since 1980.`, () => {}],
      [12500, "Step 2 · The luck test", `Shuffle every place's years and the simple test still finds ${n0(S.noise_sig)} trends. All of them fake.`, () => setMode("noise")],
      [17500, "Step 3 · The strict test", `The fake trends dissolve. ${n0(S.real_sig)} real ones stay, the Arctic among them.`, () => setMode("real")],
      [22500, "Remove El Niño", `Take out El Niño and the Arctic trend survives: ${signed(r.slope_enso_decade)} °C per decade.`, () => {
        setEnso(true);
        setPlace((pl) => (pl && pl.key === "place-demo:arctic" ? { ...pl, lines: [pl.lines[0], `T2M ${signed(r.slope_enso_decade)} °C/DEC · EL NIÑO REMOVED`, `CORRECTED p ${pfmt(r.p_enso_hr)}`] } : pl));
      }],
      [27500, "Verdict", "Real signal, not noise", () => {}, [
        [n0(S.naive_sig), "looked like trends"], [n0(S.noise_sig), "were luck"], [n0(S.enso_real_sig), "passed the strict test, El Niño removed"]]],
    ];
    // "Waiting" ends in the same update as the first caption, so there is never a moment that looks like no tour.
    steps.forEach(([at, eyebrow, text, run, final], n) => timers.current.push(window.setTimeout(() => { run(); setTour({ n, eyebrow, text, final }); if (n === 0) setPending(false); }, at)));
    timers.current.push(window.setTimeout(endTour, 27500 + 7000)); // the verdict card stays 7 s, then the page is put back
  };
  // Start once the globe is on screen: its first frame with columns (the flat map needs only the data). 20 s at most.
  const globeReady = flat ? !!g : built;
  useEffect(() => {
    if (!pending) return;
    const id = window.setTimeout(() => { runTour(); }, globeReady ? 400 : 20000);
    return () => window.clearTimeout(id);
    // runTour is recreated every render; what matters is pending and readiness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, globeReady]);
  const touring = !!tour || pending;
  useEffect(() => {
    if (!touring) return;
    const stop = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      endTour();
    };
    window.addEventListener("keydown", stop);
    window.addEventListener("pointerdown", stop, true);
    return () => { window.removeEventListener("keydown", stop); window.removeEventListener("pointerdown", stop, true); };
  }, [touring, endTour]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  // /globe?tour=1 (the home page button) asks for the tour as soon as the data is in; it then waits for the globe.
  const haveGrid = !!g;
  useEffect(() => {
    if (autoTried.current || !meta || !initial.current?.has("tour")) return;
    autoTried.current = true;
    const id = window.setTimeout(() => { requestTour(); }, 0);
    return () => window.clearTimeout(id);
    // requestTour is recreated every render; this runs once, when the data first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  // Keep the address in step with what's on screen (replace, not push: Back isn't flooded), and restore it on load.
  // Nothing is written until the restore has run, so a shared link's region and year aren't dropped on the way in.
  const placeVal = place?.key.startsWith("place-") ? place.key.slice(6) : "";
  const yearVal = yearIdx != null && anom ? anom.years[yearIdx] : null;
  const [restoring, setRestoring] = useState(true);
  useEffect(() => {
    if (!meta || restoring || touring) return;
    if (restoreUrl.current) { window.history.replaceState(window.history.state, "", restoreUrl.current); restoreUrl.current = null; return; }
    const q = new URLSearchParams({ v });
    if (placeVal) q.set("region", placeVal);
    if (enso) q.set("enso", "1");
    if (yearVal != null && v === "T2M") q.set("year", String(yearVal));
    const url = `/globe?${q}`;
    // history.replaceState (Next keeps its router in sync with it): replaces like router.replace, but synchronously, so two
    // quick updates (restoring a region, then a year) can't race and leave the older address behind.
    if (url !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, "", url);
  }, [meta, restoring, touring, v, placeVal, enso, yearVal]);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !meta || !haveGrid) return;
    restored.current = true;
    const q = initial.current, region = q?.get("region"), year = Number(q?.get("year"));
    const id = window.setTimeout(async () => {
      if (q && !q.has("tour")) await Promise.all([region ? jump(region) : null, year && (q.get("v") ?? "T2M") === "T2M" ? showYear(year) : null]);
      setRestoring(false);
    }, 300);
    return () => window.clearTimeout(id);
    // jump and showYear are recreated every render; this runs once, when the data first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, haveGrid]);
  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  };

  if (err) return <p className="text-false-alarm">Could not load the data ({err}). Try reloading the page.</p>;
  // Same full-screen frame from the first paint, so a slow connection shows a loading globe page, not an empty one.
  // 12,960 = the 90 x 144 map grid (its size, not a result).
  if (!meta) return (
    <div className="-mt-24">
      <section className="bleed relative flex h-[100svh] min-h-[560px] flex-col items-center justify-center gap-2" aria-label="The globe">
        <p role="status" className="hud nav-glass flex items-center gap-2 rounded-full px-4 py-2 !text-[var(--ink)]"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--ink)] motion-safe:animate-pulse" />Loading 12,960 places…</p>
        {tourAsked && <p className="hud !text-[11px]">Starting the investigation…</p>}
      </section>
    </div>
  );
  const s = meta.grid_summary[v];
  const count = (m: Mode) => ({ naive: s.naive_sig, noise: s.noise_sig, real: enso ? s.enso_real_sig : s.real_sig }[m]);
  const active = STEPS.find((x) => x.mode === mode)!;
  return (
    <div className="-mt-24 flex flex-col gap-8">
      {/* overflow-clip, not hidden: hidden would make the section a scroll container and break the sticky title. */}
      <section className="bleed relative h-[100svh] min-h-[560px] overflow-clip" aria-label="The globe">
        {flat
          ? <FlatFallback grid={g} mode={mode} enso={enso} onPick={pickCell} loading={`Loading ${n0(s.cells)} places…`} />
          : <ColumnGlobe grid={g} lat={meta.grid.lat} lon={meta.grid.lon} mode={mode} enso={enso} year={year} target={target} onPick={pickCell} loading={`Loading ${n0(s.cells)} places…`}
              loadingNote={pending ? "Starting the investigation…" : undefined} onBuilt={() => setBuilt(true)}
              label={`Globe of ${NICE[v].short} trends as columns: ${active.step}. ${n0(count(mode))} of ${n0(s.cells)} places marked. Click a square, or use "Fly to", for its numbers.`} />}

        {/* Top: what to map, and where to fly. Sticky, so it stays clear of the header even if the page scrolls. */}
        <div className="pointer-events-none sticky top-[76px] z-10 flex flex-col gap-3 px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <SectionLabel>The globe</SectionLabel>
              <h1 className="font-display text-[clamp(26px,3.4vw,44px)] leading-[1] tracking-[-0.02em] text-ink">Signal or noise?</h1>
            </div>
            <div className="pointer-events-auto flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <button type="button" onClick={requestTour} className="pill nav-glass shrink-0 !text-[var(--ink)]">▶ Watch the investigation</button>
            <button type="button" onClick={copyLink} className="pill nav-glass shrink-0" aria-live="polite">{copied ? "Copied" : "Copy link"}</button>
            <label className="flex min-w-0 max-w-full items-center gap-2"><span className="hud hidden sm:inline">Fly to</span>
              <select className="nav-glass hud h-11 w-56 max-w-full cursor-pointer rounded-full px-4 text-ink" defaultValue=""
                onChange={(e) => { jump(e.target.value); e.target.value = ""; }} aria-label="Fly to a place">
                <option value="" disabled>Fly to…</option>
                <optgroup label="Demo cases">{DEMOS.map((d) => <option key={d.id} value={`demo:${d.id}`}>{d.title}</option>)}</optgroup>
                <optgroup label="Regions">{meta.regions.filter((r: any) => r.id !== "global").map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>
              </select>
            </label>
            </div>
          </div>
          <div className="pointer-events-auto -mx-4 flex flex-nowrap items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="What to map">
            {Object.keys(meta.grid_summary).map((k) => (
              <button key={k} type="button" className="pill nav-glass relative shrink-0 whitespace-nowrap" aria-pressed={k === v} onClick={() => choose(k)}>
                {k === v && <Brackets layoutId="globe-vars" />}
                <span className="relative">{NICE[k].short}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom left: the three steps */}
        <div className="absolute inset-x-4 bottom-4 z-10 flex flex-col gap-2 sm:inset-x-auto sm:left-6 sm:bottom-6 sm:w-[360px]" role="group" aria-label="Which test to show">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-1">
            {STEPS.map((st) => {
              const on = st.mode === mode;
              return (
                <button key={st.mode} type="button" aria-pressed={on && !yearOn} aria-describedby={`desc-${st.mode}`} onClick={() => { stopYears(); setMode(st.mode); }}
                  className="nav-glass relative flex cursor-pointer flex-col gap-1 rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-ink transition-colors sm:gap-1.5 sm:px-4 sm:py-3"
                  style={{ borderColor: on && !yearOn ? st.color : undefined }}>
                  {on && !yearOn && <Brackets layoutId="globe-steps" className="!-inset-0.5" />}
                  <span className="hud !text-[10px] sm:!text-[12px]" style={{ color: on && !yearOn ? st.color : "var(--ink-dim)" }}><span className="sm:hidden">{st.short}</span><span className="hidden sm:inline">{st.step}</span></span>
                  <span className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                    <span className="num font-mono text-[20px] leading-none sm:text-[28px]" style={{ color: st.color }}><RollCount value={count(st.mode)} run={on} /></span>
                    <span className="hidden text-[13px] text-ink-dim sm:inline">{st.noun}</span>
                  </span>
                  <span id={`desc-${st.mode}`} className="sr-only">{st.noun}. {st.text}</span>
                </button>
              );
            })}
          </div>
          <p className="nav-glass hidden rounded-[var(--radius-sm)] px-4 py-3 text-[13px] leading-snug text-ink-dim sm:block">{active.text}</p>
          <label className="nav-glass flex min-h-11 items-center gap-2.5 self-start rounded-full px-4 text-[13px] text-ink-dim">
            <input type="checkbox" className="h-[18px] w-[18px] accent-signal" checked={enso} onChange={(e) => setEnso(e.target.checked)} />
            Remove El Niño first <span className="hidden sm:inline">(changes step 3)</span>
          </label>
        </div>

        {/* Bottom centre (above the steps on phones): play the record year by year. Air temperature only. */}
        {!flat && v === "T2M" && !tour && (
          <div className="nav-glass absolute inset-x-4 bottom-[132px] z-10 flex items-center gap-3 rounded-full px-3 py-1.5 sm:bottom-6 sm:left-[408px] sm:right-auto sm:w-[min(440px,calc(100vw-440px))] lg:right-[460px] lg:w-auto">
            {yearIdx == null || !anom ? (
              <button type="button" onClick={startYears} className="hud flex min-h-11 w-full items-center justify-center gap-2 !text-ink">▶ Play the years 1980–2025</button>
            ) : (
              <>
                <button type="button" onClick={() => { if (yearIdx >= anom.years.length - 1) setYearIdx(0); setPlaying((p) => !p); }} aria-label={playing ? "Pause" : "Play"}
                  className="hud flex h-11 w-11 shrink-0 items-center justify-center rounded-full !text-ink">{playing ? "❚❚" : "▶"}</button>
                <input type="range" min={0} max={anom.years.length - 1} value={yearIdx} aria-label="Year" aria-valuetext={String(anom.years[yearIdx])}
                  onChange={(e) => { setPlaying(false); setYearIdx(+e.target.value); }} className="min-w-0 flex-1 accent-[var(--ink)]" />
                <span className="num w-12 shrink-0 text-[16px] text-ink">{anom.years[yearIdx]}</span>
                <button type="button" onClick={stopYears} aria-label="Back to the trends" className="hud flex h-11 shrink-0 items-center px-2 !text-ink-dim hover:!text-ink">✕</button>
              </>
            )}
          </div>
        )}

        {/* Bottom right: the colour key (below the globe on phones) */}
        {!flat && (
          <div className="nav-glass absolute bottom-6 right-6 z-10 hidden w-[420px] rounded-[var(--radius-sm)] p-4 lg:block">
            {yearOn ? <YearKey year={anom!.years[yearIdx!]} /> : <GlobeScale grid={g} units={NICE[v].units} mode={mode} enso={enso} />}
          </div>
        )}
        {/* Tour captions: bottom, glass, design-system easing; the last one is a centred verdict card. */}
        <AnimatePresence mode="wait">
          {tour && !tour.final && (
            <motion.div key={tour.n} role="status" aria-live="polite" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
              transition={{ duration: 0.4, ease: [0.35, 0, 0, 1] }}
              className="absolute inset-x-4 bottom-4 z-30 flex flex-col gap-1 rounded-[var(--radius-sm)] border border-hairline bg-[color-mix(in_srgb,var(--ground)_97%,transparent)] px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] min-[1100px]:bottom-6 min-[1100px]:left-[408px] min-[1100px]:right-[460px] min-[1100px]:z-20 min-[1100px]:border-[var(--hairline)] min-[1100px]:shadow-none">
              <span className="hud">The investigation · {tour.n + 1} / 7 · {tour.eyebrow}</span>
              <span className="font-display text-[20px] leading-[26px] text-ink sm:text-[24px] sm:leading-[30px]">{tour.text}</span>
              <span className="hud !text-[10px] !text-ink-faint">Esc or click to stop</span>
            </motion.div>
          )}
          {tour?.final && (
            <motion.div key="final" role="status" aria-live="polite" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.35, 0, 0, 1] }}
              className="glass absolute left-1/2 top-1/2 z-20 flex w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.5)] sm:p-8">
              <SectionLabel>{tour.eyebrow} · Air temperature · 1980–2025</SectionLabel>
              <h2 className="font-display text-[clamp(32px,5vw,48px)] leading-[1.05] tracking-[-0.02em]">{tour.text}</h2>
              <div className="grid grid-cols-3 gap-3 border-t border-hairline pt-4">
                {tour.final.map(([num, what], i) => (
                  <div key={what} className="flex flex-col gap-1">
                    <span className="num text-[clamp(22px,3vw,32px)] leading-none" style={{ color: ["var(--ink)", "var(--false-alarm)", "var(--warming)"][i] }}>{num}</span>
                    <span className="text-[13px] leading-snug text-ink-dim">{what}</span>
                  </div>
                ))}
              </div>
              <span className="hud !text-ink-faint">Esc or click to explore</span>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="flex flex-col gap-6">
        <div className={flat ? "" : "lg:hidden"}>{yearOn ? <YearKey year={anom!.years[yearIdx!]} /> : <GlobeScale grid={g} units={NICE[v].units} mode={mode} enso={enso} />}</div>
        <p className="hud text-ink-dim">Drag to spin · pinch or scroll to zoom · tap or click a square · each column is one square, its height the size of the trend</p>
        <CellInfo meta={meta} grid={g} v={v} pick={pick} mode={mode} enso={enso} onClose={() => setPick(null)} />
        <AnimatePresence mode="wait">
          <motion.div key={v} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="glass flex flex-col gap-2 px-6 py-5 text-[15px] leading-relaxed text-ink-dim">
            <SectionLabel>WHAT THIS SHOWS · {NICE[v].noun}</SectionLabel>
            <span className="max-w-[75ch]">
            {n0(s.naive_sig)} places pass the simple test, and {n0(s.real_sig)} survive the strict one
            ({Math.round((100 * s.real_sig) / Math.max(s.naive_sig, 1))}% of them). Meanwhile, shuffled data with no trend at all still fooled the simple test in {n0(s.noise_sig)} places.
            {meta.variables[v].caveat ? ` Caution: ${meta.variables[v].caveat}` : ""}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
