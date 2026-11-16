"use client";
// Scroll-scrubbed landing scenes. Each scene is a tall section with a sticky full-screen stage;
// everything inside is driven by how far you've scrolled through it (scroll back and it rewinds).
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import Lenis from "lenis";
import { DEMOS, NICE, signed, type Grid, type Meta, type Region } from "@/lib/data";
import { Globe, coast } from "./Globe";
import { Badge, Button, HudCallout, RegMarks, SectionLabel, Sparkline, VerdictStamp, WaveTitle, useReducedMotion } from "./ui";
import { Dust } from "./Fancy";

/** Smooth, inertial scrolling for the page this is mounted on (off for reduced motion). */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ autoRaf: true, anchors: { offset: -60 }, lerp: 0.09 });
    return () => lenis.destroy();
  }, []);
  return null;
}

/** A section `vh` tall with a sticky full-screen stage; children get the 0→1 scroll progress. `tone` is the chapter colour:
 * "void" is see-through (black, with the story globe behind), "paper" a slightly see-through dark grey. `chapter` tells the story globe where it is. */
function Pinned({ vh, id, tone, chapter, children }: { vh: number; id?: string; tone: "void" | "paper"; chapter: string; children: (p: MotionValue<number>) => ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const bg = tone === "paper" ? "paper" : "";
  return (
    <section ref={ref} id={id} data-chapter={chapter} className={`bleed ${bg}`} style={{ height: `${vh}vh` }}>
      <div className={`sticky top-0 h-[100svh] overflow-hidden ${bg}`}>{children(scrollYProgress)}</div>
    </section>
  );
}

const useFade = (p: MotionValue<number>, a: number, b: number, c: number, d: number) => useTransform(p, [a, b, c, d], [0, 1, 1, 0]);

/* ---------------------------------------------------------------- 1. Hero */
export function HeroScene({ cells }: { cells?: number }) {
  return (
    <Pinned vh={300} tone="void" chapter="hero">
      {(p) => <HeroStage p={p} cells={cells} />}
    </Pinned>
  );
}
function HeroStage({ p, cells }: { p: MotionValue<number>; cells?: number }) {
  const h1 = useTransform(p, [0, 0.28, 0.4], [1, 1, 0]);
  const h1y = useTransform(p, [0, 0.4], [0, -80]);
  const h2 = useFade(p, 0.38, 0.48, 0.7, 0.8);
  const h2y = useTransform(p, [0.38, 0.8], [40, -40]);
  // Fade on absolute page scroll: the pinned section's progress can read slightly above 0 at the very top.
  const { scrollY } = useScroll();
  const hint = useTransform(scrollY, [0, 120], [1, 0]);
  const curtain = useTransform(p, [0.84, 1], ["circle(0% at 50% 100%)", "circle(150% at 50% 100%)"]);

  return (
    <>
      {/* The inset card: 16–24px margin on the sides and bottom, and clear of the floating nav on top. */}
      <div className="absolute inset-x-4 bottom-5 top-[72px] sm:inset-x-6">
        <div className="absolute inset-0 overflow-hidden rounded-[var(--radius-sm)] border border-hairline">
          <Dust count={60} />
          <motion.div style={{ opacity: h1, y: h1y }} className="absolute inset-x-0 top-[6vh] z-10 mx-auto flex max-w-[1200px] flex-col items-start gap-5 px-6 sm:px-12">
            <p className="hud">NASA Space Apps 2026 · MERRA-2 · 1980–2025</p>
            <h1 className="font-display text-[clamp(40px,6.6vw,96px)] leading-[0.95] tracking-[-0.03em]">
              <span className="block">Is Earth really changing,</span>
              <span className="block pl-[0.6em]">or is it just luck?</span>
            </h1>
            <div className="flex flex-wrap gap-3">
              <Button href="#cases">See the demo cases</Button>
              <Button href="/explore" variant="glass">Pick your own place</Button>
            </div>
          </motion.div>
          <motion.div style={{ opacity: h2, y: h2y }} className="pointer-events-none absolute inset-x-0 top-[12vh] z-10 mx-auto flex max-w-[900px] flex-col items-center gap-4 px-6 text-center">
            <p className="hud [text-shadow:0_2px_24px_rgba(5,7,11,.9),0_0_2px_rgba(5,7,11,.8)]">Scale of the test · air temperature</p>
            <p className="text-balance font-display text-[clamp(32px,4.6vw,60px)] leading-[1.05] tracking-[-0.03em] [text-shadow:0_2px_24px_rgba(5,7,11,.9),0_0_2px_rgba(5,7,11,.8)]">
              We tested <span className="num tabular-nums text-warming">{cells ? cells.toLocaleString() : "12,960"}</span> places on Earth for a trend since 1980.
            </p>
          </motion.div>

        </div>
        <RegMarks />
        <motion.p style={{ opacity: hint }} className="glass-strong hud absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2 whitespace-nowrap rounded-full px-5 py-2 !text-ink">Scroll to explore</motion.p>
      </div>
      <motion.div aria-hidden="true" style={{ clipPath: curtain }} className="absolute inset-0 z-20 bg-paper" />
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
  // Outfit has one weight, so emphasis is colour: full ink for the key words, dim ink for the rest.
  return <motion.span style={{ opacity: o }} className={bold ? "text-ink-paper" : "text-ink-paper-dim"}>{children} </motion.span>;
}

export function MissionScene({ meta }: { meta: Meta }) {
  const words = useMemo(() => parseBold(MISSION), []);
  return (
    <Pinned vh={320} tone="paper" chapter="mission">
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
  const N = words.length;
  return (
    <>
      <motion.div style={{ opacity: out }} className="relative z-10 mx-auto flex h-full max-w-[1100px] flex-col justify-center gap-[7vh] px-6 pt-20 sm:px-10">
        <h2 className="sr-only">Why luck fools climate maps</h2>
        <SectionLabel>The problem</SectionLabel>
        <motion.div style={{ y: textY }} className="flex gap-6">
          <span aria-hidden="true" className="mt-3 w-px shrink-0 bg-ink-paper/20" />
          <p className="text-pretty font-display text-[clamp(22px,2.8vw,38px)] leading-[1.25]">
            {words.map((w, i) => <Word key={i} p={p} a={0.04 + (i / N) * 0.5} b={0.04 + ((i + 1) / N) * 0.5} bold={w.bold}>{w.text}</Word>)}
          </p>
        </motion.div>
        <motion.div style={{ opacity: stats, y: statsY }} className="grid grid-cols-2 gap-4 border-t border-ink-paper/15 pt-6 sm:gap-6 sm:pt-8 lg:grid-cols-4">
          {[
            { n: s?.cells, c: "text-ink-paper", t: "places tested" },
            { n: s?.noise_sig, c: "text-false-alarm", t: "false alarms from luck" },
            { n: s?.real_sig, c: "text-signal-ink", t: "places with a real trend" },
            { n: meta?.years.length, c: "text-ink-paper", t: "years of NASA data" },
          ].map((k) => (
            <div key={k.t} className="flex flex-col gap-2 border-l border-ink-paper/15 pl-5">
              <p className={`num text-[clamp(32px,3.6vw,52px)] leading-none tabular-nums ${k.c}`}>{k.n != null ? k.n.toLocaleString() : "…"}</p>
              <p className="hud">{k.t}</p>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </>
  );
}

/* ---------------------------------------------------------------- 3. The noise test (dot map) */
type RGB = [number, number, number];
// Same hues as the tokens: --warming, --cooling, --false-alarm, and a dark neutral for "no trend found".
const DIM: RGB = [44, 44, 42], UP: RGB = [255, 138, 61], DOWN: RGB = [91, 147, 255], LUCK: RGB = [197, 138, 214];
const STAGES = [
  { at: 0.0, word: "Every place", title: "Here is every place on Earth", text: "Each dot stands for four of our 12,960 map squares (each about 200 km wide). For each one we have 46 years of NASA air-temperature data.", key: "cells", noun: "places" },
  { at: 0.22, word: "Simple", title: "Step 1 · The simple test", text: "Check each place on its own, the way most maps are made. Orange: warming. Blue: cooling.", key: "naive_sig", noun: "look like they're changing" },
  { at: 0.46, word: "Luck", title: "Step 2 · The luck test", text: "Now shuffle each place's years into random order, which wipes out any real trend. The simple test still lights up about 1 place in 20. Those are false alarms.", key: "noise_sig", noun: "false alarms from pure luck" },
  { at: 0.7, word: "Signal", title: "Step 3 · The strict test", text: "Correct for years that resemble each other and for testing thousands of places at once. What survives is very unlikely to be luck.", key: "real_sig", noun: "places with a real signal" },
] as const;
const STAGE_COLOR = ["var(--ink)", "var(--warming)", "var(--false-alarm)", "var(--signal)"];

// Seeded hash → [0,1). The dissolve is a pure function of (dot, particle, progress), so there is no state to rewind.
const hash = (n: number) => { let t = (n + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
type Dissolve = { delay: number; parts: { ang: number; dist: number; size: number }[] };
type Dot = { x: number; y: number; c: RGB[]; dis?: Dissolve };

export function NoiseScene({ meta, grid }: { meta: Meta; grid: Grid | null }) {
  return (
    <Pinned vh={480} tone="void" chapter="noise">
      {(p) => <NoiseStage p={p} meta={meta} grid={grid} />}
    </Pinned>
  );
}
function NoiseStage({ p, meta, grid }: { p: MotionValue<number>; meta: Meta; grid: Grid | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState(0);
  const [count, setCount] = useState(0);
  const reduce = useReducedMotion();
  const s = meta?.grid_summary.T2M;

  // Every other grid square: a 45 × 72 dot map, with its colour at each stage.
  const [coastP, setCoastP] = useState<Path2D | null>(null);
  useEffect(() => { coast().then(setCoastP); }, []);
  // Each dot sits on the exact centre of its grid square: x from longitude, y from latitude (row 0 is the south).
  const dots = useMemo(() => {
    if (!grid || !meta) return [];
    const [ny, nx] = grid.shape, lat: number[] = meta.grid.lat, lon: number[] = meta.grid.lon, out: Dot[] = [];
    for (let r = 0; r < ny; r += 2) for (let x = 0; x < nx; x += 2) {
      const k = r * nx + x, sl = grid.slope_decade[k];
      if (sl == null) continue;
      const dir = sl > 0 ? UP : DOWN, idx = out.length;
      const d: Dot = { x: (lon[x] + 180) / 360, y: (90 - lat[r]) / 180, c: [DIM, grid.p_naive[k] < 0.05 ? dir : DIM, grid.p_noise[k] < 0.05 ? LUCK : DIM, grid.q[k] < 0.05 ? dir : DIM] };
      // A false alarm that does NOT survive the strict test dissolves into 3–6 particles that drift out and up.
      if (grid.p_noise[k] < 0.05 && !(grid.q[k] < 0.05)) {
        const n = 3 + Math.floor(hash(idx * 11 + 1) * 4);
        d.dis = {
          delay: hash(idx * 11 + 2) * 0.5,
          parts: Array.from({ length: n }, (_, j) => ({
            ang: -Math.PI / 2 + (hash(idx * 11 + 3 + j * 7) - 0.5) * 2.6, // mostly upward
            dist: 0.5 + hash(idx * 11 + 4 + j * 7),
            size: 0.45 + hash(idx * 11 + 5 + j * 7) * 0.4,
          })),
        };
      }
      out.push(d);
    }
    return out;
  }, [grid, meta]);

  const draw = useCallback((v: number) => {
    const c = canvas.current;
    if (!c || !dots.length) return;
    const W = c.clientWidth, H = c.clientHeight, dpr = Math.min(1.5, window.devicePixelRatio || 1);
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Which two stages we're between, and how far (a short scroll window to cross-fade; longer for the dissolve).
    let i = 0;
    while (i < STAGES.length - 1 && v >= STAGES[i + 1].at) i++;
    const next = Math.min(i + 1, STAGES.length - 1);
    const win = next === 3 ? 0.12 : 0.06;
    const t = next === i ? 0 : Math.max(0, (v - (STAGES[next].at - win)) / win);
    const dissolving = !reduce && i === 2 && next === 3 && t > 0;
    const rad = Math.max(1.2, (W / 72) * 0.36);
    const reach = W / 36;
    for (const d of dots) {
      const a = d.c[i], b = d.c[next];
      let tt = 0;
      if (dissolving && d.dis) tt = Math.min(1, Math.max(0, (t - d.dis.delay * 0.6) / (1 - d.dis.delay * 0.6)));
      const cx = d.x * W, cy = d.y * H;
      if (dissolving && d.dis) {
        // Stays magenta: a DIM dot fades in underneath while the magenta one shrinks and fades out (no RGB blend through orange).
        ctx.fillStyle = `rgb(${DIM[0]},${DIM[1]},${DIM[2]})`;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.2832); ctx.fill();
        if (tt < 1) {
          ctx.fillStyle = "#c58ad6";
          ctx.globalAlpha = 1 - tt;
          ctx.beginPath(); ctx.arc(cx, cy, rad * (1 - 0.5 * tt), 0, 6.2832); ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else {
        ctx.fillStyle = `rgb(${a[0] + (b[0] - a[0]) * t},${a[1] + (b[1] - a[1]) * t},${a[2] + (b[2] - a[2]) * t})`;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.2832); ctx.fill();
      }
      if (tt > 0 && tt < 1 && d.dis) {
        ctx.fillStyle = "#c58ad6";
        ctx.globalAlpha = tt < 0.4 ? 1 : (1 - tt) / 0.6; // full strength, fading over the last 60%
        for (const q of d.dis.parts) {
          const dist = q.dist * reach * tt; // 1-3x the dot spacing, mostly upward
          ctx.beginPath();
          ctx.arc(cx + Math.cos(q.ang) * dist, cy + Math.sin(q.ang) * dist - tt * reach * 0.4, (1.2 + (q.size - 0.45) * 3) * Math.max(0.7, rad / 3), 0, 6.2832);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    if (coastP) { // continents on top, thin, so you can tell where each dot is
      ctx.save();
      ctx.scale(W / 360, H / 180);
      ctx.strokeStyle = "rgba(232,238,252,0.55)";
      ctx.lineWidth = 360 / W; // 1 CSS pixel
      ctx.stroke(coastP);
      ctx.restore();
    }
  }, [dots, coastP, reduce]);
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
    const a = animate(cv, s ? s[STAGES[stage].key] : 0, { duration: reduce ? 0 : 0.6, ease: "easeOut" });
    return () => a.stop();
  }, [stage, s, cv, reduce]);

  const st = STAGES[stage];
  const color = STAGE_COLOR[stage];
  return (
    <>
      <Dust count={40} />
      <div className="relative z-10 mx-auto flex h-full max-w-[1300px] flex-col justify-center gap-4 px-4 pt-20 sm:gap-8 sm:px-8 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-4 lg:w-[34%]">
          <SectionLabel>The noise test</SectionLabel>
          <h2 className="font-display text-[clamp(32px,5vw,64px)] leading-[0.95] tracking-[-0.03em]">
            <span className="block">Spot the</span>
            <span className="block pl-[0.6em] text-false-alarm">false alarms</span>
          </h2>
          <p className="sr-only" aria-live="polite">{st.title}: {s ? s[st.key].toLocaleString() : ""} {st.noun}.</p>
          <motion.div key={stage} initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="flex flex-col gap-3" aria-hidden="true">
            <p className="hud" style={{ color }}>{st.title}</p>
            <p className="num text-[clamp(40px,4.6vw,68px)] leading-none tabular-nums" style={{ color }}>{count.toLocaleString()}</p>
            <p className="text-lg text-ink-dim">{st.noun}</p>
            <p className="max-w-[420px] text-[15px] leading-relaxed text-ink-dim max-lg:[@media(max-height:720px)]:hidden">{st.text}</p>
          </motion.div>
          <ol aria-hidden="true" className="m-0 mt-2 flex list-none gap-2 p-0">
            {STAGES.map((x, i) => <li key={x.word} className={`h-1.5 w-10 rounded-full transition-colors ${i <= stage ? "bg-signal" : "bg-white/15"}`} />)}
          </ol>
        </div>
        <figure className="m-0 flex flex-col gap-2 lg:w-[66%]">
          <div className="relative">
            <canvas ref={canvas} className="block aspect-[2/1] w-full" role="img"
              aria-label={`Dot map of the world, air temperature trends: ${st.title}. ${count.toLocaleString()} ${st.noun}.`} />
            {/* HUD annotation over the map. Hidden on small screens, where its text would be too small to read. */}
            <svg aria-hidden="true" viewBox="0 0 720 360" className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible md:block">
              <HudCallout from={[560, 40]} to={[706, -52]} align="right" lines={["Arctic · 66.5°N+", "Passes all four checks"]} show={stage === 3} />
            </svg>
          </div>
          <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-dim">
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-warming" />warming</span>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-cooling" />cooling</span>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-false-alarm" />false alarm (shuffled data)</span>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#2c2c2a] ring-1 ring-white/20" />no trend found</span>
            <Link href="/globe" className="hud ulink text-ink sm:ml-auto">Explore it on the globe →</Link>
          </figcaption>
        </figure>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- 4. Cases, sideways */
export function CasesScene({ cases }: { cases: Record<string, Region> }) {
  return (
    <Pinned vh={320} id="cases" tone="void" chapter="cases">
      {(p) => <CasesStage p={p} cases={cases} />}
    </Pinned>
  );
}
const CASE_TONE = { arctic: "real", beijing: "alarm", murray: "maybe" } as const;
const CARD = "group glass flex h-[min(calc(70svh-4rem),560px)] w-[min(82vw,520px)] shrink-0 flex-col gap-4 p-6 text-ink no-underline transition-colors duration-200 hover:border-ink-faint sm:gap-5 sm:p-8";
// CaseCard media: rounded 15px, scales 1.04 over 800ms on hover.
const MEDIA = "flex min-h-0 flex-1 flex-col justify-center gap-1 overflow-hidden rounded-[var(--radius-md)] bg-ground-sunken p-4";
const ZOOM = "flex flex-col gap-1 transition-transform duration-[800ms] ease-lusion group-hover:scale-[1.04] group-focus-visible:scale-[1.04]";

function CasesStage({ p, cases }: { p: MotionValue<number>; cases: Record<string, Region> }) {
  const track = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  useEffect(() => {
    const m = () => track.current && setDist(Math.max(0, track.current.scrollWidth - window.innerWidth));
    m(); window.addEventListener("resize", m);
    return () => window.removeEventListener("resize", m);
  }, [cases]);
  const x = useTransform(p, [0.05, 0.88], [0, -dist]);
  const curtain = useTransform(p, [0.9, 1], ["circle(0% at 100% 50%)", "circle(150% at 100% 50%)"]);
  return (
    <>
      <motion.div ref={track} style={{ x }} className="relative z-10 flex h-full items-center gap-[4vw] pl-[6vw] pr-[6vw] pt-16">
        <div aria-hidden="true" className="pointer-events-none absolute bottom-[4vh] left-0 h-px w-full bg-ink-faint" />
        <div className="flex w-[min(80vw,420px)] shrink-0 flex-col gap-5">
          <SectionLabel>The cases</SectionLabel>
          <h2 className="font-display text-[clamp(48px,6vw,84px)] leading-[0.95] tracking-[-0.03em]">
            <span className="block">Open a</span>
            <span className="block pl-[0.6em]">case</span>
          </h2>
          <p className="text-lg leading-relaxed text-ink-dim">Four real cases, four different stories. Keep scrolling, then open one to walk through the evidence.</p>
        </div>
        {DEMOS.map((c, i) => {
          const d = cases[c.id]?.variables[c.v];
          const nice = NICE[c.v];
          const water = ["TQV", "PRECTOTCORR", "EVAP", "GWETROOT", "SNOMAS", "RUNOFF"].includes(c.v);
          const rising = (d?.slope_decade ?? 0) > 0;
          const trendCol = water ? (rising ? "var(--cooling)" : "var(--warming)") : (rising ? "var(--warming)" : "var(--cooling)");
          const sig = c.tone === "real";
          const lineCol = sig ? trendCol : "var(--no-trend)"; // not proven: dashed grey
          return (
            <Link key={c.id} href={`/explore?place=${c.place}&v=${c.v}&case=${c.id}`} className={CARD}>
              <div className="hud flex items-center justify-between gap-3 border-b border-glass-stroke pb-3">
                <span className="truncate">Case_0{i + 1} · {c.place.replace("-", " ")} · {nice?.short ?? c.v}</span>
              </div>
              <WaveTitle text={c.title} className="font-display text-[26px] leading-[30px]" />
              <div><Badge tone={CASE_TONE[c.id as keyof typeof CASE_TONE] ?? c.tone}>{c.tag}</Badge></div>
              <div className={MEDIA}>
                {d && <div className={ZOOM}>
                  <Sparkline y={d.annual} className="h-28 w-full" color={lineCol} dashed={!sig} trend={[d.intercept, d.intercept + (d.slope_decade / 10) * (d.annual.length - 1)]} label={`${c.title}: yearly values 1980 to 2025, with the straight-line trend${sig ? "" : " (not proven)"}`} />
                  <div aria-hidden="true" className="hud num flex justify-between gap-2 tabular-nums">
                    <span>1980–2025</span>
                    <span>Trend <span style={{ color: sig ? trendCol : "var(--ink-muted)" }}>{signed(d.slope_decade)} {nice?.units}</span>/decade</span>
                  </div>
                </div>}
              </div>
              <p className="text-base leading-relaxed text-ink-dim">{c.text}</p>
              <span className="hud text-ink">Open the case</span>
            </Link>
          );
        })}
        <Link href="/compare" className={CARD}>
          <div className="hud flex items-center justify-between gap-3 border-b border-glass-stroke pb-3">
            <span className="truncate">Case_0{DEMOS.length + 1} · Amazon / Himalaya · Rain</span>
          </div>
          <WaveTitle text="Same warming, opposite rain?" className="font-display text-[26px] leading-[30px]" />
          <div><Badge tone="real">Opposite trends</Badge></div>
          <div className={MEDIA}><div className={`${ZOOM} gap-2`}>
            {/* Water variable: less rain = orange (drier), more rain = blue (wetter). */}
            {[["amazon", "Amazon rainforest: less rain", "var(--warming)"], ["himalaya", "Himalaya & Tibet: more rain", "var(--cooling)"]].map(([id, label, col]) => {
              const d = cases[id]?.variables.PRECTOTCORR;
              return d && (
                <div key={id} className="flex flex-col gap-0.5">
                  <span className="hud">{label}</span>
                  <Sparkline y={d.annual} className="h-12 w-full" color={col} trend={[d.intercept, d.intercept + (d.slope_decade / 10) * (d.annual.length - 1)]} label={`${label}: yearly rain 1980 to 2025`} />
                </div>
              );
            })}
          </div></div>
          <p className="text-base leading-relaxed text-ink-dim">Both got warmer and both have more water vapor in the air, yet rain fell in one and rose in the other. Both trends pass the strict test.</p>
          <span className="hud text-ink">Compare them</span>
        </Link>
        <div className="flex w-[min(80vw,380px)] shrink-0 flex-col gap-5">
          <p className="font-display text-[clamp(32px,3.4vw,48px)] leading-tight tracking-[-0.03em]">Or start your own.</p>
          <Button href="/explore" className="self-start">Pick a place</Button>
        </div>
      </motion.div>
      <motion.div aria-hidden="true" style={{ clipPath: curtain }} className="absolute inset-0 z-20 bg-paper" />
    </>
  );
}

/* ---------------------------------------------------------------- 5. Four checks, stacking */
const CHECKS = [
  ["Wobble", "Is the change bigger than the normal wobble?", "A normal Arctic year sits about 0.4 °C off the trend. The 2 °C rise is nearly 5 times that."],
  ["Shuffle", "Could shuffled years do this?", "Scramble the 46 years 2,000 times. Random order beat the real Arctic data less than 1 time in 1,000."],
  ["Many places", "Does it survive checking many places at once?", "The strict one, and the one the verdict uses. Arctic false-alarm rate: far below 1 in 10,000."],
  ["Over time", "Does it hold up over time?", "Found in 1980–2002 (+0.27 °C per decade), still there in 2003–2025 (+0.35 °C per decade)."],
];
export function ChecksScene() {
  return (
    <Pinned vh={360} tone="paper" chapter="checks">
      {(p) => <ChecksStage p={p} />}
    </Pinned>
  );
}
function ChecksStage({ p }: { p: MotionValue<number> }) {
  return (
    <>
      <div className="relative z-10 mx-auto flex h-full max-w-[1200px] flex-col justify-center gap-6 px-4 pt-20 sm:gap-10 sm:px-8 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-5 lg:w-[40%]">
          <SectionLabel>Method</SectionLabel>
          <h2 className="font-display text-[clamp(36px,6vw,84px)] leading-[0.95] tracking-[-0.03em]">
            <span className="block">Four</span>
            <span className="block pl-[0.6em]">checks</span>
          </h2>
          <p className="hidden max-w-[420px] text-[17px] leading-relaxed text-ink-paper-dim sm:block">We run four checks on every trend. The verdict comes from the strictest one, check 3. Here they are on the Arctic case, which passes all four.</p>
          <div className="hidden flex-wrap gap-3 sm:flex">
            <Button href="/how">How it works</Button>
            <Button href="/explore?place=arctic&v=T2M&case=arctic" variant="glass">Open the Arctic case</Button>
          </div>
        </div>
        <div className="relative h-[min(52vh,360px)] lg:h-[52vh] lg:w-[60%]">
          {CHECKS.map(([name, q, d], i) => <CheckCard key={q} p={p} i={i} name={name} q={q} d={d} />)}
        </div>
      </div>
    </>
  );
}
/** CheckCards: playing cards dealt face-down from the stack (rotateY 180 → 0) as you scroll. */
function CheckCard({ p, i, name, q, d }: { p: MotionValue<number>; i: number; name: string; q: string; d: string }) {
  const a = 0.06 + i * 0.2;
  const y = useTransform(p, [a, a + 0.14], i === 0 ? ["0vh", "0vh"] : ["90vh", "0vh"]);
  const rotateY = useTransform(p, [a, a + 0.14], i === 0 ? [0, 0] : [180, 0]);
  // Shrink and dim as later cards land on top.
  const scale = useTransform(p, [a + 0.2, a + 0.2 * (CHECKS.length - i)], [1, 1 - 0.05 * (CHECKS.length - 1 - i)]);
  // The PASSED stamp lands once this card has arrived (state only flips when the threshold is crossed).
  const arrive = a + (i === 0 ? 0.02 : 0.12);
  const [landed, setLanded] = useState(() => p.get() >= arrive);
  useMotionValueEvent(p, "change", (v) => setLanded(v >= arrive));
  return (
    <motion.div style={{ y, scale, rotateY, top: `${i * 18}px`, zIndex: i, transformPerspective: 1400 }}
      className="absolute inset-x-0 h-[min(40svh,340px)] origin-top [transform-style:preserve-3d]">
      <div className="absolute inset-0 flex flex-col justify-between gap-3 rounded-[var(--radius-sm)] border border-hairline bg-ground-raised p-5 shadow-[0_30px_80px_-30px_rgba(11,16,32,0.4)] [backface-visibility:hidden] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="pixel text-ink-muted">{name}</span>
            <h3 className="font-display text-[clamp(22px,2.2vw,30px)] leading-tight">{q}</h3>
          </div>
          <span className="pixel shrink-0 text-[clamp(28px,4vw,48px)] leading-none text-ink-muted">0{i + 1}</span>
        </div>
        <div className="flex items-end justify-between gap-4">
          <p className="max-w-[460px] text-[16px] leading-[22px] text-ink-muted">{d}</p>
          <span className="flex min-h-[36px] min-w-[96px] shrink-0 justify-end">{landed && <VerdictStamp verdict="passed" />}</span>
        </div>
        <span aria-hidden="true" className="pixel absolute bottom-2 left-1/2 hidden -translate-x-1/2 rotate-180 text-[10px] text-ink-faint sm:block">{name}</span>
      </div>
      {/* Face-down back, seen while the card is dealt. */}
      <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-sm)] bg-slate [backface-visibility:hidden] [transform:rotateY(180deg)]">
        <span className="pixel text-[clamp(28px,4vw,48px)] text-on-slate/40">+</span>
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- 6. End beat */
/** A short "keep scrolling" line between the last scene and the footer (Lusion-style). */
export function EndBeat() {
  return (
    <div data-chapter="end" className="bleed flex justify-center px-6 py-24 sm:py-32">
      <Button href="/explore" variant="glass">Keep going · open a case</Button>
    </div>
  );
}

/* ---------------------------------------------------------------- The story globe */
// One globe behind the whole landing page. Each chapter has a pose (centre offset in vw/vh from the middle of the screen,
// scale, opacity); it holds while the chapter plays and glides to the next pose across the hand-off between chapters.
type Pose = { x: number; y: number; s: number; o: number };
const POSES: Record<string, Pose[]> = {
  hero: [{ x: 0, y: 40, s: 1, o: 1 }, { x: 0, y: 12, s: 0.8, o: 1 }],
  mission: [{ x: 30, y: 6, s: 0.7, o: 0.75 }],
  noise: [{ x: -40, y: -27, s: 0.17, o: 0.9 }],
  cases: [{ x: 30, y: 6, s: 0.62, o: 0.8 }],
  checks: [{ x: -30, y: 24, s: 0.5, o: 0.7 }],
  end: [{ x: 0, y: -11, s: 0.3, o: 0.55 }],
};
// Phones stack the noise chapter vertically, so the mini globe moves to the empty bottom-right corner.
const POSES_NARROW: Record<string, Pose[]> = { noise: [{ x: 32, y: 45, s: 0.26, o: 0.9 }] };
const WIDE = { lat: 30, lng: -25, altitude: 1.7 }; // the globe stays inside its full-bleed canvas (any closer and its edge would be cut)
const mix = (a: Pose, b: Pose, t: number): Pose => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, s: a.s + (b.s - a.s) * t, o: a.o + (b.o - a.o) * t });

/** Fixed behind the landing page: moves with the story and turns to the place each case is about (with its outline). */
export function StoryGlobe({ grid, meta }: { grid: Grid | null; meta: Meta }) {
  const { scrollY } = useScroll();
  // Measured chapter keyframes: [scroll position, pose] pairs, rising.
  const keys = useRef<{ at: number; pose: Pose; chapter: string; top: number; len: number }[]>([]);
  const [place, setPlace] = useState<string | null>(null);

  useEffect(() => {
    const measure = () => {
      const vh = window.innerHeight, out: typeof keys.current = [];
      const set = window.innerWidth < 768 ? { ...POSES, ...POSES_NARROW } : POSES;
      document.querySelectorAll<HTMLElement>("[data-chapter]").forEach((el) => {
        const name = el.dataset.chapter!, poses = set[name];
        if (!poses) return;
        const top = el.getBoundingClientRect().top + window.scrollY, len = Math.max(1, el.offsetHeight - vh);
        out.push({ at: top, pose: poses[0], chapter: name, top, len });
        out.push({ at: top + len, pose: poses[poses.length - 1], chapter: name, top, len });
      });
      keys.current = out;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  const poseAt = (y: number): Pose => {
    const k = keys.current;
    if (!k.length) return POSES.hero[0];
    if (y <= k[0].at) return k[0].pose;
    for (let i = 1; i < k.length; i++) if (y <= k[i].at) return mix(k[i - 1].pose, k[i].pose, (y - k[i - 1].at) / Math.max(1, k[i].at - k[i - 1].at));
    return k[k.length - 1].pose;
  };
  const x = useTransform(scrollY, (y) => `${poseAt(y).x}vw`);
  const yy = useTransform(scrollY, (y) => `${poseAt(y).y}vh`);
  const scale = useTransform(scrollY, (y) => poseAt(y).s);
  const opacity = useTransform(scrollY, (y) => poseAt(y).o);

  // Which place to turn to: the case card in view while the cases scroll sideways, the Arctic during the checks.
  useMotionValueEvent(scrollY, "change", (y) => {
    const vh = window.innerHeight;
    const ch = keys.current.find((c) => y >= c.top - vh / 2 && y < c.top + c.len + vh / 2);
    let next: string | null = null;
    if (ch?.chapter === "checks") next = "arctic";
    if (ch?.chapter === "cases") {
      const t = Math.min(1, Math.max(0, ((y - ch.top) / ch.len - 0.05) / 0.83)); // same window as the sideways track
      const i = Math.round(t * (DEMOS.length + 2)); // intro, the demos, the compare card, the outro
      next = i <= DEMOS.length ? DEMOS[Math.max(0, i - 1)].place : i === DEMOS.length + 1 ? "compare" : null;
    }
    setPlace((p) => (p === next ? p : next));
  });

  const region = place && place !== "compare" ? meta?.regions.find((r: { id: string }) => r.id === place) : null;
  const focus = useMemo(() => {
    if (place === "compare") return { lat: 5, lng: 15, altitude: 2.2 };
    if (!region) return WIDE;
    const [a, b, c, d] = region.box;
    return d - c >= 359 ? { lat: 70, lng: 20, altitude: 1.7 } : { lat: (a + b) / 2, lng: (c + d) / 2, altitude: 1.5 };
  }, [place, region]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div style={{ x, y: yy, scale, opacity }} className="absolute inset-0">
        <Globe grid={grid} mode="real" spin={!region && place !== "compare"} zoom={false} fill focus={focus} box={region?.box}
          label="A globe of NASA air-temperature trends that follows the story. Orange shows warming, blue cooling, where the trend passed the strict test." />
      </motion.div>
    </div>
  );
}
