"use client";
// Scroll-scrubbed landing scenes. Each scene is a tall section with a sticky full-screen stage;
// everything inside is driven by how far you've scrolled through it (scroll back and it rewinds).
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import Lenis from "lenis";
import { DEMOS, NICE, type Grid, type Meta, type Region } from "@/lib/data";
import { Globe, coast } from "./Globe";
import { Badge, Button, HudCallout, RegMarks, SectionLabel, Sparkline, VerdictStamp } from "./ui";
import { Dust, LightLeaks } from "./Fancy";

/** Smooth, inertial scrolling for the page this is mounted on (off for reduced motion). */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ autoRaf: true, anchors: { offset: -60 }, lerp: 0.09 });
    return () => lenis.destroy();
  }, []);
  return null;
}

/** A section `vh` tall with a sticky full-screen stage; children get the 0→1 scroll progress. `tone` is the chapter colour. */
function Pinned({ vh, id, tone, children }: { vh: number; id?: string; tone: "void" | "paper"; children: (p: MotionValue<number>) => ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const bg = tone === "paper" ? "paper" : "bg-void";
  return (
    <section ref={ref} id={id} className={`bleed ${bg}`} style={{ height: `${vh}vh` }}>
      <div className={`sticky top-0 h-[100svh] overflow-hidden ${bg}`}>{children(scrollYProgress)}</div>
    </section>
  );
}

const useFade = (p: MotionValue<number>, a: number, b: number, c: number, d: number) => useTransform(p, [a, b, c, d], [0, 1, 1, 0]);

/* ---------------------------------------------------------------- 1. Hero */
export function HeroScene({ grid, cells }: { grid: Grid | null; cells?: number }) {
  return (
    <Pinned vh={300} tone="void">
      {(p) => <HeroStage p={p} grid={grid} cells={cells} />}
    </Pinned>
  );
}
function HeroStage({ p, grid, cells }: { p: MotionValue<number>; grid: Grid | null; cells?: number }) {
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
      {/* The inset card: 16–24px margin on the sides and bottom, and clear of the floating nav on top. */}
      <div className="absolute inset-x-4 bottom-5 top-[72px] sm:inset-x-6">
        <div className="absolute inset-0 overflow-hidden rounded-[28px] border border-glass-stroke bg-night/70">
          <LightLeaks />
          <Dust />
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
            <p className="hud">Scale of the test · air temperature</p>
            <p className="text-balance font-display text-[clamp(32px,4.6vw,60px)] leading-[1.05] tracking-[-0.03em]">
              We tested <span className="num tabular-nums text-warming">{cells ? cells.toLocaleString() : "12,960"}</span> places on Earth for a trend since 1980.
            </p>
          </motion.div>

          <motion.div style={{ y: globeY, scale: globeS }} className="pointer-events-none absolute bottom-0 left-1/2 w-[min(1100px,135vw)] -translate-x-1/2">
            <Globe grid={grid} mode="real" spin zoom={false} label="A slowly spinning globe of NASA data. Orange shows places where air temperature rose since 1980 and passed the strict test." />
          </motion.div>
        </div>
        <RegMarks />
        <motion.p style={{ opacity: hint }} className="hud absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2 whitespace-nowrap bg-void px-4 py-1">Scroll to explore</motion.p>
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
    <Pinned vh={320} tone="paper">
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
  const curtain = useTransform(p, [0.86, 1], ["circle(0% at 50% 100%)", "circle(150% at 50% 100%)"]);
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
            // #a21caf: --false-alarm (#e879f9) is far too pale on --paper (about 2:1), so this darker magenta keeps the same hue at 5.5:1.
            { n: s?.noise_sig, c: "text-[#a21caf]", t: "false alarms from luck" },
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
      <motion.div aria-hidden="true" style={{ clipPath: curtain }} className="absolute inset-0 z-20 bg-void" />
    </>
  );
}

/* ---------------------------------------------------------------- 3. The noise test (dot map) */
type RGB = [number, number, number];
// Same hues as the tokens: --warming, --cooling, --false-alarm, and a dark neutral for "no trend found".
const DIM: RGB = [40, 46, 60], UP: RGB = [255, 138, 61], DOWN: RGB = [74, 163, 255], LUCK: RGB = [232, 121, 249];
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
    <Pinned vh={480} tone="void">
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
      let r = rad, tt = 0;
      if (dissolving && d.dis) {
        tt = Math.min(1, Math.max(0, (t - d.dis.delay * 0.6) / (1 - d.dis.delay * 0.6)));
        r = rad * (1 - 0.5 * tt);
      }
      const k = tt > 0 ? Math.min(1, tt * 1.6) : t; // the dot itself goes dark a little faster than the particles leave
      ctx.fillStyle = `rgb(${a[0] + (b[0] - a[0]) * k},${a[1] + (b[1] - a[1]) * k},${a[2] + (b[2] - a[2]) * k})`;
      ctx.beginPath();
      ctx.arc(d.x * W, d.y * H, r, 0, 6.2832);
      ctx.fill();
      if (tt > 0 && tt < 1 && d.dis) {
        ctx.fillStyle = `rgb(${LUCK[0]},${LUCK[1]},${LUCK[2]})`;
        ctx.globalAlpha = (1 - tt) * 0.9;
        for (const q of d.dis.parts) {
          const dist = q.dist * reach * tt;
          ctx.beginPath();
          ctx.arc(d.x * W + Math.cos(q.ang) * dist, d.y * H + Math.sin(q.ang) * dist - tt * reach * 0.4, Math.max(0.5, rad * q.size * (1 - tt * 0.4)), 0, 6.2832);
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
              <HudCallout from={[540, 30]} to={[706, -18]} align="right" lines={["Arctic · 66.5°N+", "Passes all four checks"]} show={stage === 3} />
            </svg>
          </div>
          <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-dim">
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-warming" />warming</span>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-cooling" />cooling</span>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-false-alarm" />false alarm (shuffled data)</span>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#282e3c] ring-1 ring-white/20" />no trend found</span>
            <Link href="/globe" className="hud text-signal sm:ml-auto">Explore it on the globe →</Link>
          </figcaption>
        </figure>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- 4. Cases, sideways */
export function CasesScene({ cases }: { cases: Record<string, Region> }) {
  return (
    <Pinned vh={320} id="cases" tone="void">
      {(p) => <CasesStage p={p} cases={cases} />}
    </Pinned>
  );
}
const CASE_TONE = { arctic: "real", beijing: "alarm", murray: "maybe" } as const;
/** A real number for the HUD: minus sign only when it is negative, 3 significant figures. */
const fmt = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(v) >= 10 ? Math.abs(v).toFixed(1) : Number(Math.abs(v).toPrecision(3))}`;
const CARD = "group glass flex h-[min(calc(70svh-4rem),560px)] w-[min(82vw,520px)] shrink-0 flex-col gap-4 rounded-[28px] p-6 text-ink no-underline transition-colors hover:border-white/35 sm:gap-5 sm:p-8";

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
          const a0: number | undefined = d?.annual[0], a1: number | undefined = d?.annual.at(-1);
          return (
            <Link key={c.id} href={`/explore?place=${c.place}&v=${c.v}&case=${c.id}`} className={CARD}>
              <div className="hud flex items-center justify-between gap-3 border-b border-glass-stroke pb-3">
                <span className="truncate">Case_0{i + 1} · {c.place.replace("-", " ")} · {nice?.short ?? c.v}</span>
              </div>
              <h3 className="font-display text-[clamp(26px,2.8vw,38px)] leading-tight">{c.title}</h3>
              <div><Badge tone={CASE_TONE[c.id as keyof typeof CASE_TONE] ?? c.tone}>{c.tag}</Badge></div>
              <div className="flex min-h-0 flex-1 flex-col justify-center gap-1">
                {d && <>
                  <Sparkline y={d.annual} className="h-28 w-full" trend={c.tone === "real" ? [d.intercept, d.intercept + (d.slope_decade / 10) * (d.annual.length - 1)] : undefined} label={`${c.title}: yearly values 1980 to 2025`} />
                  {a0 != null && a1 != null && (
                    <div aria-hidden="true" className="hud num flex justify-between gap-2 tabular-nums">
                      <span className="inline-flex items-center gap-1.5"><svg width="6" height="6"><circle cx="3" cy="3" r="3" fill="currentColor" /></svg>1980 {fmt(a0)} {nice?.units}</span>
                      <span className="inline-flex items-center gap-1.5">2025 {fmt(a1)} {nice?.units}<svg width="6" height="6"><circle cx="3" cy="3" r="3" fill="currentColor" /></svg></span>
                    </div>
                  )}
                </>}
              </div>
              <p className="text-base leading-relaxed text-ink-dim">{c.text}</p>
              <span className="hud inline-flex items-center gap-2 text-signal">Open the case <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span></span>
            </Link>
          );
        })}
        <Link href="/compare" className={CARD}>
          <div className="hud flex items-center justify-between gap-3 border-b border-glass-stroke pb-3">
            <span className="truncate">Case_0{DEMOS.length + 1} · Amazon / Himalaya · Rain</span>
          </div>
          <h3 className="font-display text-[clamp(26px,2.8vw,38px)] leading-tight">Same warming, opposite rain?</h3>
          <div><Badge tone="real">Opposite trends</Badge></div>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
            {/* Water variable: less rain = dry ochre, more rain = cooling blue (teal is UI only). */}
            {[["amazon", "Amazon rainforest: less rain", "#c48a3f"], ["himalaya", "Himalaya & Tibet: more rain", "var(--cooling)"]].map(([id, label, col]) => {
              const d = cases[id]?.variables.PRECTOTCORR;
              return d && (
                <div key={id} className="flex flex-col gap-0.5">
                  <span className="hud">{label}</span>
                  <Sparkline y={d.annual} className="h-12 w-full" color={col} trend={[d.intercept, d.intercept + (d.slope_decade / 10) * (d.annual.length - 1)]} label={`${label}: yearly rain 1980 to 2025`} />
                </div>
              );
            })}
          </div>
          <p className="text-base leading-relaxed text-ink-dim">Both got warmer and both have more water vapor in the air, yet rain fell in one and rose in the other. Both trends pass the strict test.</p>
          <span className="hud inline-flex items-center gap-2 text-signal">Compare them <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span></span>
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
  ["Is the change bigger than the normal wobble?", "A normal Arctic year sits about 0.4 °C off the trend. The 2 °C rise is nearly 5 times that."],
  ["Could shuffled years do this?", "Scramble the 46 years 2,000 times. Random order beat the real Arctic data less than 1 time in 1,000."],
  ["Does it survive checking many places at once?", "The strict one, and the one the verdict uses. Arctic false-alarm rate: far below 1 in 10,000."],
  ["Does it hold up over time?", "Found in 1980–2002 (+0.27 °C per decade), still there in 2003–2025 (+0.35 °C per decade)."],
];
export function ChecksScene() {
  return (
    <Pinned vh={360} tone="paper">
      {(p) => <ChecksStage p={p} />}
    </Pinned>
  );
}
function ChecksStage({ p }: { p: MotionValue<number> }) {
  // End on the site's dark colour so the light scene hands off smoothly to the dark footer.
  const curtain = useTransform(p, [0.88, 1], ["circle(0% at 50% 100%)", "circle(150% at 50% 100%)"]);
  return (
    <>
      <motion.div aria-hidden="true" style={{ clipPath: curtain }} className="absolute inset-0 z-30 bg-void" />
      <div className="relative z-10 mx-auto flex h-full max-w-[1200px] flex-col justify-center gap-6 px-4 pt-20 sm:gap-10 sm:px-8 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-5 lg:w-[40%]">
          <SectionLabel>Method</SectionLabel>
          <h2 className="font-display text-[clamp(36px,6vw,84px)] leading-[0.95] tracking-[-0.03em]">
            <span className="block">Four</span>
            <span className="block pl-[0.6em]">checks</span>
          </h2>
          <p className="hidden max-w-[420px] text-[17px] leading-relaxed text-ink-paper-dim sm:block">We run four checks on every trend. The verdict comes from the strictest one, check 3. Here they are on the Arctic case, which passes all four.</p>
          <div className="hidden flex-wrap gap-3 sm:flex">
            <Button href="/how" className="bg-ink-paper text-white hover:bg-black hover:text-white">How it works</Button>
            <Button href="/explore?place=arctic&v=T2M&case=arctic" variant="glass" className="border-ink-paper/30 bg-transparent text-ink-paper hover:bg-ink-paper/5 hover:text-ink-paper">Open the Arctic case</Button>
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
  // The PASSED stamp lands once this card has arrived (state only flips when the threshold is crossed).
  const arrive = a + (i === 0 ? 0.02 : 0.12);
  const [landed, setLanded] = useState(() => p.get() >= arrive);
  useMotionValueEvent(p, "change", (v) => setLanded(v >= arrive));
  return (
    <motion.div style={{ y, scale, top: `${i * 18}px`, zIndex: i }}
      className="absolute inset-x-0 flex h-[min(40svh,340px)] origin-top flex-col justify-between rounded-[28px] bg-white p-5 shadow-[0_30px_80px_-30px_rgba(11,16,32,0.4)] sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-[clamp(24px,2.4vw,34px)] leading-tight">{q}</h3>
        <span className="num text-[clamp(28px,4vw,56px)] leading-none tabular-nums text-ink-paper-dim">0{i + 1}</span>
      </div>
      <div className="flex items-end justify-between gap-4">
        <p className="max-w-[460px] text-[16px] leading-relaxed text-ink-paper-dim">{d}</p>
        <span className="flex min-h-[36px] min-w-[96px] shrink-0 justify-end">{landed && <VerdictStamp verdict="passed" paper />}</span>
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- 6. End beat */
/** A short "keep scrolling" line between the last scene and the footer (Lusion-style). */
export function EndBeat() {
  return (
    <div className="bleed flex justify-center bg-void px-6 py-24 sm:py-32">
      <Link href="/explore" className="hud group inline-flex min-h-[44px] items-center gap-2 text-signal">
        Keep scrolling · open a case <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
