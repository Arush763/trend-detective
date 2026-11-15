"use client";
// Scroll-scrubbed landing scenes. Each scene is a tall section with a sticky full-screen stage;
// everything inside is driven by how far you've scrolled through it (scroll back and it rewinds).
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import Lenis from "lenis";
import { DEMOS, type Grid, type Meta, type Region } from "@/lib/data";
import { Globe, coast } from "./Globe";
import { Badge, Sparkline } from "./ui";
import { Aurora, Stars } from "./Fancy";

/** Smooth, inertial scrolling for the page this is mounted on (off for reduced motion). */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ autoRaf: true, anchors: { offset: -60 }, lerp: 0.09 });
    return () => lenis.destroy();
  }, []);
  return null;
}

/** A section `vh` tall with a sticky full-screen stage; children get the 0→1 scroll progress. */
function Pinned({ vh, id, className = "", children }: { vh: number; id?: string; className?: string; children: (p: MotionValue<number>) => ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  return (
    <section ref={ref} id={id} className={`bleed ${className.split(" ").filter((c) => c.startsWith("bg-")).join(" ")}`} style={{ height: `${vh}vh` }}>
      <div className={`sticky top-0 h-[100svh] overflow-hidden ${className}`}>{children(scrollYProgress)}</div>
    </section>
  );
}

const useFade = (p: MotionValue<number>, a: number, b: number, c: number, d: number) => useTransform(p, [a, b, c, d], [0, 1, 1, 0]);

/* ---------------------------------------------------------------- 1. Hero */
const COMET = "M-80,250 C220,90 430,330 720,250 S1150,60 1520,170";

export function HeroScene({ grid, cells }: { grid: Grid | null; cells?: number }) {
  return (
    <Pinned vh={300}>
      {(p) => <HeroStage p={p} grid={grid} cells={cells} />}
    </Pinned>
  );
}
function HeroStage({ p, grid, cells }: { p: MotionValue<number>; grid: Grid | null; cells?: number }) {
  const path = useRef<SVGPathElement>(null);
  const draw = useTransform(p, [0.02, 0.5], [0, 1]);
  const hx = useMotionValue(-80), hy = useMotionValue(250);
  useMotionValueEvent(draw, "change", (v) => {
    const el = path.current;
    if (!el) return;
    const pt = el.getPointAtLength(v * el.getTotalLength());
    hx.set(pt.x); hy.set(pt.y);
  });
  const headOpacity = useTransform(draw, [0, 0.03, 0.97, 1], [0, 1, 1, 0]);
  const h1 = useTransform(p, [0, 0.28, 0.4], [1, 1, 0]);
  const h1y = useTransform(p, [0, 0.4], [0, -80]);
  const h2 = useFade(p, 0.38, 0.48, 0.7, 0.8);
  const h2y = useTransform(p, [0.38, 0.8], [40, -40]);
  const globeY = useTransform(p, [0, 0.75], ["64%", "18%"]);
  const globeS = useTransform(p, [0, 0.75], [1, 0.82]);
  const hint = useTransform(p, [0, 0.06], [1, 0]);
  const curtain = useTransform(p, [0.84, 1], ["circle(0% at 50% 100%)", "circle(150% at 50% 100%)"]);

  return (
    <>
      <Stars />
      <svg aria-hidden="true" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="comet" x1="0" x2="1"><stop offset="0" stopColor="#2dd4bf" stopOpacity="0" /><stop offset="0.25" stopColor="#2dd4bf" /><stop offset="0.6" stopColor="#8b5cf6" /><stop offset="1" stopColor="#f472b6" /></linearGradient>
          <radialGradient id="chead"><stop offset="0" stopColor="#fff" stopOpacity="0.9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        </defs>
        {/* Glow faked with wide, faint strokes: an SVG blur filter here was recomputed on every scroll frame. */}
        <motion.path d={COMET} fill="none" stroke="url(#comet)" strokeWidth={90} strokeLinecap="round" opacity={0.08} style={{ pathLength: draw }} />
        <motion.path d={COMET} fill="none" stroke="url(#comet)" strokeWidth={56} strokeLinecap="round" opacity={0.14} style={{ pathLength: draw }} />
        <motion.path d={COMET} fill="none" stroke="url(#comet)" strokeWidth={36} strokeLinecap="round" opacity={0.25} style={{ pathLength: draw }} />
        <motion.path ref={path} d={COMET} fill="none" stroke="url(#comet)" strokeWidth={22} strokeLinecap="round" style={{ pathLength: draw }} />
        <motion.circle r={40} fill="url(#chead)" style={{ cx: hx, cy: hy, opacity: headOpacity }} />
        <motion.circle r={7} fill="#fff7d6" style={{ cx: hx, cy: hy, opacity: headOpacity }} />
      </svg>

      <motion.div style={{ opacity: h1, y: h1y }} className="absolute inset-x-0 top-[16vh] z-10 mx-auto flex max-w-[920px] flex-col items-center gap-6 px-4 text-center">
        <p className="text-[15px] italic text-[var(--soft)]">NASA Space Apps 2026 · 46 years of NASA climate data</p>
        <h1 className="text-balance font-display text-[clamp(44px,7vw,92px)] font-light leading-[1.02] tracking-tight [text-shadow:0_2px_30px_rgba(7,11,26,.8)]">Is Earth really changing, or is it just luck?</h1>
        <div className="flex flex-wrap justify-center gap-3">
          <a href="#cases" className="btn btn-primary">See the demo cases</a>
          <Link href="/explore" className="btn btn-ghost bg-[#070b1a]/60 backdrop-blur-md">Pick your own place</Link>
        </div>
      </motion.div>
      <motion.div style={{ opacity: h2, y: h2y }} className="absolute inset-x-0 top-[18vh] z-10 mx-auto max-w-[900px] px-4 text-center">
        <p className="text-balance font-display text-[clamp(34px,5vw,64px)] font-light leading-[1.1] tracking-tight [text-shadow:0_2px_24px_rgba(7,11,26,.9)]">
          We tested <span className="text-[var(--up)]">{cells ? cells.toLocaleString() : "12,960"} places</span> on Earth for a trend since 1980.
        </p>
      </motion.div>

      <motion.div style={{ y: globeY, scale: globeS }} className="pointer-events-none absolute bottom-0 left-1/2 w-[min(1100px,135vw)] -translate-x-1/2">
        <Globe grid={grid} mode="real" spin zoom={false} label="A slowly spinning globe of NASA data. Orange shows places where air temperature rose since 1980 and passed the strict test." />
      </motion.div>
      <motion.p style={{ opacity: hint }} className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#070b1a]/70 px-4 py-2 text-[12px] uppercase tracking-[0.16em] text-[var(--soft)] backdrop-blur-md">Scroll ↓</motion.p>
      <motion.div aria-hidden="true" style={{ clipPath: curtain }} className="absolute inset-0 z-20 bg-[#f4f3f8]" />
    </>
  );
}

/* ---------------------------------------------------------------- 2. Mission */
const MISSION = "Every year the weather wobbles: a hot summer, a dry spring, a wet winter. Test **12,960 places** on Earth for a trend and **about 1 in 20 will look like they're changing** by pure luck. Trend Detective puts **46 years of NASA data** through **four checks** that luck rarely passes, so anyone can tell the **signal** from the **noise.**";

function parseBold(text: string) {
  const out: { text: string; bold: boolean }[] = [];
  let inBold = false;
  for (const w of text.split(" ")) {
    const opens = w.startsWith("**"), closes = w.endsWith("**") && w.length > 2;
    out.push({ text: w.replaceAll("**", ""), bold: inBold || opens });
    inBold = (inBold || opens) && !closes;
  }
  return out;
}
function Word({ p, a, b, bold, children }: { p: MotionValue<number>; a: number; b: number; bold: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  const o = useTransform(p, [a, b], [reduce ? 1 : 0.25, 1]);
  return <motion.span style={{ opacity: o }} className={bold ? "font-semibold" : undefined}>{children} </motion.span>;
}

export function MissionScene({ meta }: { meta: Meta }) {
  const words = useMemo(() => parseBold(MISSION), []);
  return (
    <Pinned vh={320} className="light-scene bg-[#f4f3f8] text-[#16161d]">
      {(p) => <MissionStage p={p} meta={meta} words={words} />}
    </Pinned>
  );
}
function MissionStage({ p, meta, words }: { p: MotionValue<number>; meta: Meta; words: { text: string; bold: boolean }[] }) {
  const s = meta?.grid_summary.T2M;
  const textY = useTransform(p, [0.55, 0.75], [0, -60]);
  const out = useTransform(p, [0.8, 0.88], [1, 0]);
  const stats = useTransform(p, [0.6, 0.72], [0, 1]);
  const statsY = useTransform(p, [0.6, 0.72], [60, 0]);
  const ghostX = useTransform(p, [0, 1], ["4%", "-18%"]);
  const curtain = useTransform(p, [0.86, 1], ["circle(0% at 50% 100%)", "circle(150% at 50% 100%)"]);
  const N = words.length;
  return (
    <>
      <Stars className="opacity-50" />
      <Aurora />
      <motion.span aria-hidden="true" style={{ x: ghostX }} className="pointer-events-none absolute bottom-[4vh] left-0 select-none whitespace-nowrap font-display text-[clamp(90px,16vw,240px)] font-bold leading-none text-white opacity-60 blur-[6px]">Signal &amp; noise</motion.span>
      <motion.div style={{ opacity: out }} className="relative z-10 mx-auto flex h-full max-w-[1100px] flex-col justify-center gap-[8vh] px-6 pt-20 sm:px-10">
        <h2 className="sr-only">Why luck fools climate maps</h2>
        <motion.div style={{ y: textY }} className="flex gap-6">
          <span aria-hidden="true" className="mt-3 w-px shrink-0 bg-gradient-to-b from-[#8b5cf6] via-[#2dd4bf] to-transparent" />
          <p className="text-pretty font-display text-[clamp(22px,2.8vw,38px)] font-light leading-[1.25]">
            {words.map((w, i) => <Word key={i} p={p} a={0.04 + (i / N) * 0.5} b={0.04 + ((i + 1) / N) * 0.5} bold={w.bold}>{w.text}</Word>)}
          </p>
        </motion.div>
        <motion.div style={{ opacity: stats, y: statsY }} className="grid grid-cols-2 gap-4 border-t border-black/10 pt-6 sm:gap-6 sm:pt-8 lg:grid-cols-4">
          {[
            { n: s?.cells, c: "from-[#6d28d9] to-[#7c3aed]", t: "places tested" },
            { n: s?.noise_sig, c: "from-[#b45309] to-[#92400e]", t: "false alarms from luck" },
            { n: s?.real_sig, c: "from-[#c2410c] to-[#be123c]", t: "places with a real trend" },
            { n: meta?.years.length, c: "from-[#0f766e] to-[#115e59]", t: "years of NASA data" },
          ].map((k) => (
            <div key={k.t} className="flex flex-col gap-1 border-l border-black/10 pl-5">
              <p className={`bg-gradient-to-r bg-clip-text font-display text-[clamp(40px,4vw,56px)] font-light leading-none text-transparent ${k.c}`}>{k.n != null ? k.n.toLocaleString() : "…"}</p>
              <p className="font-medium">{k.t}</p>
            </div>
          ))}
        </motion.div>
      </motion.div>
      <motion.div aria-hidden="true" style={{ clipPath: curtain }} className="absolute inset-0 z-20 bg-[var(--bg)]" />
    </>
  );
}

/* ---------------------------------------------------------------- 3. The noise test (dot map) */
type RGB = [number, number, number];
const DIM: RGB = [44, 56, 88], UP: RGB = [249, 115, 22], DOWN: RGB = [59, 130, 246], LUCK: RGB = [251, 191, 36];
const STAGES = [
  { at: 0.0, word: "Every place", title: "Here is every place on Earth", text: "Each dot stands for four of our 12,960 map squares (each about 200 km wide). For each one we have 46 years of NASA air-temperature data.", key: "cells", noun: "places" },
  { at: 0.22, word: "Simple", title: "Step 1 · The simple test", text: "Check each place on its own, the way most maps are made. Orange: warming. Blue: cooling.", key: "naive_sig", noun: "look like they're changing" },
  { at: 0.46, word: "Luck", title: "Step 2 · The luck test", text: "Now shuffle each place's years into random order, which wipes out any real trend. The simple test still lights up about 1 place in 20. Those are false alarms.", key: "noise_sig", noun: "false alarms from pure luck" },
  { at: 0.7, word: "Signal", title: "Step 3 · The strict test", text: "Correct for years that resemble each other and for testing thousands of places at once. What survives is very unlikely to be luck.", key: "real_sig", noun: "places with a real signal" },
] as const;

export function NoiseScene({ meta, grid }: { meta: Meta; grid: Grid | null }) {
  return (
    <Pinned vh={480} className="bg-[var(--bg)]">
      {(p) => <NoiseStage p={p} meta={meta} grid={grid} />}
    </Pinned>
  );
}
function NoiseStage({ p, meta, grid }: { p: MotionValue<number>; meta: Meta; grid: Grid | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState(0);
  const [count, setCount] = useState(0);
  const s = meta?.grid_summary.T2M;

  // Every other grid square: a 45 × 72 dot map, with its colour at each stage.
  const [coastP, setCoastP] = useState<Path2D | null>(null);
  useEffect(() => { coast().then(setCoastP); }, []);
  // Each dot sits on the exact centre of its grid square: x from longitude, y from latitude (row 0 is the south).
  const dots = useMemo(() => {
    if (!grid || !meta) return [];
    const [ny, nx] = grid.shape, lat: number[] = meta.grid.lat, lon: number[] = meta.grid.lon, out: { x: number; y: number; c: RGB[] }[] = [];
    for (let r = 0; r < ny; r += 2) for (let x = 0; x < nx; x += 2) {
      const k = r * nx + x, sl = grid.slope_decade[k];
      if (sl == null) continue;
      const dir = sl > 0 ? UP : DOWN;
      out.push({ x: (lon[x] + 180) / 360, y: (90 - lat[r]) / 180, c: [DIM, grid.p_naive[k] < 0.05 ? dir : DIM, grid.p_noise[k] < 0.05 ? LUCK : DIM, grid.q[k] < 0.05 ? dir : DIM] });
    }
    return out;
  }, [grid, meta]);

  const draw = useCallback((v: number) => {
    const c = canvas.current;
    if (!c || !dots.length) return;
    const W = c.clientWidth, H = c.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Which two stages we're between, and how far (0.06 of scroll to cross-fade).
    let i = 0;
    while (i < STAGES.length - 1 && v >= STAGES[i + 1].at) i++;
    const next = Math.min(i + 1, STAGES.length - 1);
    const t = next === i ? 0 : Math.max(0, (v - (STAGES[next].at - 0.06)) / 0.06);
    const rad = Math.max(1.2, (W / 72) * 0.36);
    for (const d of dots) {
      const a = d.c[i], b = d.c[next];
      ctx.fillStyle = `rgb(${a[0] + (b[0] - a[0]) * t},${a[1] + (b[1] - a[1]) * t},${a[2] + (b[2] - a[2]) * t})`;
      ctx.beginPath();
      ctx.arc(d.x * W, d.y * H, rad, 0, 6.2832);
      ctx.fill();
    }
    if (coastP) { // continents on top, thin, so you can tell where each dot is
      ctx.save();
      ctx.scale(W / 360, H / 180);
      ctx.strokeStyle = "rgba(232,238,252,0.55)";
      ctx.lineWidth = 360 / W; // 1 CSS pixel
      ctx.stroke(coastP);
      ctx.restore();
    }
  }, [dots, coastP]);
  useMotionValueEvent(p, "change", (v) => {
    draw(v);
    let i = 0;
    while (i < STAGES.length - 1 && v >= STAGES[i + 1].at) i++;
    if (i !== stage) setStage(i);
  });
  // First paint once the data arrives, and again on every resize.
  useEffect(() => {
    draw(p.get());
    const r = () => draw(p.get());
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, [draw, p]);
  // The counter tweens from wherever it is now to the new stage's total.
  const cv = useMotionValue(0);
  useMotionValueEvent(cv, "change", (x) => setCount(Math.round(x)));
  useEffect(() => {
    const a = animate(cv, s ? s[STAGES[stage].key] : 0, { duration: 0.6, ease: "easeOut" });
    return () => a.stop();
  }, [stage, s, cv]);

  const st = STAGES[stage];
  const color = stage === 2 ? "#fbbf24" : stage === 0 ? "#c7d2fe" : stage === 3 ? "#5eead4" : "#f97316";
  return (
    <>
      <Stars className="opacity-60" />
      <motion.span key={st.word} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 0.12, x: 0 }} transition={{ duration: 0.6 }} aria-hidden="true"
        className="pointer-events-none absolute top-[12vh] right-6 select-none font-display text-[clamp(90px,15vw,220px)] font-bold leading-none text-[var(--text)] blur-[6px]">{st.word}</motion.span>
      <div className="relative z-10 mx-auto flex h-full max-w-[1300px] flex-col justify-center gap-4 px-4 pt-20 sm:gap-8 sm:px-8 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-4 lg:w-[34%]">
          <h2 className="font-display text-[clamp(32px,5vw,64px)] font-light leading-[0.95] tracking-tight">Spot the<br /><span className="text-[var(--accent)]">false alarms</span></h2>
          <p className="sr-only" aria-live="polite">{st.title}: {s ? s[st.key].toLocaleString() : ""} {st.noun}.</p>
          <motion.div key={stage} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="flex flex-col gap-3" aria-hidden="true">
            <p className="text-[13px] uppercase tracking-[0.14em]" style={{ color }}>{st.title}</p>
            <p className="font-display text-[clamp(44px,5vw,72px)] font-light leading-none" style={{ color }}>{count.toLocaleString()}</p>
            <p className="text-lg text-[var(--soft)]">{st.noun}</p>
            <p className="max-w-[420px] text-[15px] leading-relaxed text-[var(--dim)] max-lg:[@media(max-height:720px)]:hidden">{st.text}</p>
          </motion.div>
          <ol aria-hidden="true" className="m-0 mt-2 flex list-none gap-2 p-0">
            {STAGES.map((x, i) => <li key={x.word} className={`h-1.5 w-10 rounded-full transition-colors ${i <= stage ? "bg-[var(--accent)]" : "bg-white/15"}`} />)}
          </ol>
        </div>
        <figure className="m-0 flex flex-col gap-2 lg:w-[66%]">
          <canvas ref={canvas} className="aspect-[2/1] w-full" role="img"
            aria-label={`Dot map of the world, air temperature trends: ${st.title}. ${count.toLocaleString()} ${st.noun}.`} />
          <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[var(--dim)]">
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#f97316]" />warming</span>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#3b82f6]" />cooling</span>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />false alarm (shuffled data)</span>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#2c3858]" />no trend found</span>
            <Link href="/globe" className="sm:ml-auto">Explore it on the globe →</Link>
          </figcaption>
        </figure>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- 4. Cases, sideways */
export function CasesScene({ cases }: { cases: Record<string, Region> }) {
  return (
    <Pinned vh={320} id="cases" className="bg-[var(--bg)]">
      {(p) => <CasesStage p={p} cases={cases} />}
    </Pinned>
  );
}
function CasesStage({ p, cases }: { p: MotionValue<number>; cases: Record<string, Region> }) {
  const track = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  useEffect(() => {
    const m = () => track.current && setDist(Math.max(0, track.current.scrollWidth - window.innerWidth));
    m(); window.addEventListener("resize", m);
    return () => window.removeEventListener("resize", m);
  }, [cases]);
  const x = useTransform(p, [0.05, 0.88], [0, -dist]);
  const trail = useTransform(p, [0.05, 0.88], [0, 1]);
  const curtain = useTransform(p, [0.9, 1], ["circle(0% at 100% 50%)", "circle(150% at 100% 50%)"]);
  return (
    <>
      <Stars className="opacity-70" />
      <Aurora className="opacity-30" />
      <motion.div ref={track} style={{ x }} className="relative z-10 flex h-full items-center gap-[4vw] pl-[6vw] pr-[6vw] pt-16">
        <svg aria-hidden="true" viewBox="0 0 2000 200" preserveAspectRatio="none" className="pointer-events-none absolute bottom-[2vh] left-0 h-[10vh] w-full">
          <defs><linearGradient id="trail" x1="0" x2="1"><stop offset="0" stopColor="#2dd4bf" /><stop offset="0.5" stopColor="#8b5cf6" /><stop offset="1" stopColor="#f97316" /></linearGradient></defs>
          <motion.path d="M0,150 C300,40 500,190 800,110 S1400,20 2000,120" fill="none" stroke="url(#trail)" strokeWidth={10} strokeLinecap="round" style={{ pathLength: trail }} />
        </svg>
        <div className="flex w-[min(80vw,420px)] shrink-0 flex-col gap-5">
          <h2 className="font-display text-[clamp(48px,6vw,84px)] font-light leading-[0.95] tracking-tight">Open a<br /><span className="text-[var(--accent)]">case</span></h2>
          <p className="text-lg leading-relaxed text-[var(--soft)]">Three real places, three different stories. Keep scrolling, then open one to walk through the evidence.</p>
        </div>
        {DEMOS.map((c, i) => {
          const d = cases[c.id]?.variables[c.v];
          return (
            <Link key={c.id} href={`/explore?place=${c.place}&v=${c.v}&case=${c.id}`}
              className="group flex h-[min(calc(70svh-4rem),560px)] w-[min(82vw,520px)] shrink-0 flex-col gap-4 rounded-[28px] border border-white/10 bg-[#0f1730]/80 p-6 sm:gap-5 sm:p-8 text-[var(--text)] no-underline transition-colors hover:border-white/30 hover:bg-white/[0.08]">
              <div className="flex items-center justify-between">
                <span className="text-[12px] uppercase tracking-[0.16em] text-[var(--muted)]">Case 0{i + 1}</span>
                <Badge tone={c.tone}>{c.tag}</Badge>
              </div>
              <h3 className="font-display text-[clamp(28px,3vw,40px)] font-light leading-tight">{c.title}</h3>
              <div className="flex min-h-0 flex-1 flex-col justify-center gap-1">
                {d && <>
                  <Sparkline y={d.annual} className="h-32 w-full" trend={c.tone === "real" ? [d.intercept, d.intercept + (d.slope_decade / 10) * (d.annual.length - 1)] : undefined} label={`${c.title}: yearly values 1980 to 2025`} />
                  <div aria-hidden="true" className="flex justify-between text-[11px] text-[var(--muted)]"><span>1980</span><span>2025</span></div>
                </>}
              </div>
              <p className="text-base leading-relaxed text-[var(--soft)]">{c.text}</p>
              <span className="inline-flex items-center gap-2 font-semibold text-[var(--accent)]">Open the case <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span></span>
            </Link>
          );
        })}
        <div className="flex w-[min(80vw,380px)] shrink-0 flex-col gap-5">
          <p className="font-display text-[clamp(32px,3.4vw,48px)] font-light leading-tight">Or start your own.</p>
          <Link href="/explore" className="btn btn-primary self-start">Pick a place →</Link>
        </div>
      </motion.div>
      <motion.div aria-hidden="true" style={{ clipPath: curtain }} className="absolute inset-0 z-20 bg-[#f4f3f8]" />
    </>
  );
}

/* ---------------------------------------------------------------- 5. Four checks, stacking */
const CHECKS = [
  ["Is the change bigger than the normal wobble?", "A normal Arctic year sits about 0.4 °C off the trend. The 2 °C rise is nearly 5 times that."],
  ["Could shuffled years do this?", "Scramble the 46 years 2,000 times. Random order beat the real Arctic data less than 1 time in 1,000."],
  ["Does it survive checking many places at once?", "The strict one, and the one the verdict uses. Arctic false-alarm rate: far below 1 in 10,000."],
  ["Does it hold up over time?", "Found in 1980–2002 (+0.27 °C per decade), still there in 2003–2025 (+0.35 °C per decade)."],
];
export function ChecksScene() {
  return (
    <Pinned vh={360} className="light-scene bg-[#f4f3f8] text-[#16161d]">
      {(p) => <ChecksStage p={p} />}
    </Pinned>
  );
}
function ChecksStage({ p }: { p: MotionValue<number> }) {
  // End on the site's dark colour so the light scene hands off smoothly to the dark footer.
  const curtain = useTransform(p, [0.88, 1], ["circle(0% at 50% 100%)", "circle(150% at 50% 100%)"]);
  return (
    <>
      <motion.div aria-hidden="true" style={{ clipPath: curtain }} className="absolute inset-0 z-30 bg-[var(--bg)]" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-[3vh] left-6 select-none font-display text-[clamp(90px,15vw,220px)] font-bold leading-none text-[#c4b5fd] opacity-40 blur-[6px]">Method</span>
      <div className="relative z-10 mx-auto flex h-full max-w-[1200px] flex-col justify-center gap-6 px-4 pt-20 sm:gap-10 sm:px-8 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-5 lg:w-[40%]">
          <h2 className="font-display text-[clamp(36px,6vw,84px)] font-light leading-[0.95] tracking-tight">Four<br /><span className="text-[#7c3aed]">checks</span></h2>
          <p className="hidden max-w-[420px] text-[17px] leading-relaxed text-[#55556a] sm:block">We run four checks on every trend. The verdict comes from the strictest one, check 3. Here they are on the Arctic case, which passes all four.</p>
          <div className="hidden flex-wrap gap-3 sm:flex">
            <Link href="/how" className="btn bg-[#16161d] text-white hover:bg-black hover:text-white">How it works</Link>
            <Link href="/explore?place=arctic&v=T2M&case=arctic" className="btn border border-black/20 text-[#16161d] hover:bg-black/5 hover:text-[#16161d]">Open the Arctic case</Link>
          </div>
        </div>
        <div className="relative h-[min(52vh,360px)] lg:h-[52vh] lg:w-[60%]">
          {CHECKS.map(([q, d], i) => <CheckCard key={q} p={p} i={i} q={q} d={d} />)}
        </div>
      </div>
    </>
  );
}
function CheckCard({ p, i, q, d }: { p: MotionValue<number>; i: number; q: string; d: string }) {
  const a = 0.06 + i * 0.2;
  const y = useTransform(p, [a, a + 0.14], i === 0 ? ["0vh", "0vh"] : ["90vh", "0vh"]);
  // Shrink and dim as later cards land on top.
  const scale = useTransform(p, [a + 0.2, a + 0.2 * (CHECKS.length - i)], [1, 1 - 0.05 * (CHECKS.length - 1 - i)]);
  return (
    <motion.div style={{ y, scale, top: `${i * 18}px`, zIndex: i }}
      className="absolute inset-x-0 flex h-[min(40svh,340px)] origin-top flex-col justify-between rounded-[28px] bg-white p-5 sm:p-8 shadow-[0_30px_80px_-30px_rgba(76,29,149,0.45)]">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-[clamp(24px,2.4vw,34px)] font-light leading-tight">{q}</h3>
        <span className="font-display text-[clamp(32px,5vw,72px)] font-extralight leading-none text-[#7c3aed]">0{i + 1}</span>
      </div>
      <div className="flex items-end justify-between gap-4">
        <p className="max-w-[460px] text-[16px] leading-relaxed text-[#55556a]">{d}</p>
        <span className="whitespace-nowrap rounded-full bg-teal-100 px-3 py-1 text-[13px] font-semibold text-teal-800">Passed</span>
      </div>
    </motion.div>
  );
}
