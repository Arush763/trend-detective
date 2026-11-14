"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { DEMOS, get, type Grid, type Meta, type Region } from "@/lib/data";
import { Globe } from "@/components/Globe";
import { Badge, Sparkline } from "@/components/ui";
import { Aurora, GhostWord, ScrollLit, Stars } from "@/components/Fancy";

const rise = (i = 0) => ({ initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.6, delay: i * 0.1 } });

export default function Landing() {
  const [meta, setMeta] = useState<Meta>(null);
  const [grid, setGrid] = useState<Grid>(null);
  const [cases, setCases] = useState<Record<string, Region>>({});
  const hero = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const ribbon = useTransform(scrollYProgress, [0, 0.6], [0.3, 1]);
  const globeY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);

  useEffect(() => {
    get("meta.json").then(setMeta);
    get("grid/T2M.json").then(setGrid);
    DEMOS.forEach((d) => get(`regions/${d.place}.json`).then((r) => setCases((c) => ({ ...c, [d.id]: r }))));
  }, []);
  const s = meta?.grid_summary.T2M;

  return (
    <div className="-mb-20 -mt-8">
      {/* Hero: night sky, aurora ribbon drawn by scrolling, the data globe rising like a planet */}
      <section ref={hero} className="bleed relative flex min-h-[calc(100svh-60px)] flex-col items-center overflow-hidden">
        <Stars />
        <svg aria-hidden="true" viewBox="0 0 1440 600" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 h-[70%] w-full">
          <defs>
            <linearGradient id="rib" x1="0" x2="1">
              <stop offset="0" stopColor="#2dd4bf" /><stop offset="0.5" stopColor="#8b5cf6" /><stop offset="1" stopColor="#f472b6" />
            </linearGradient>
            <filter id="glow"><feGaussianBlur stdDeviation="14" /></filter>
          </defs>
          {[{ w: 70, f: "url(#glow)", o: 0.55 }, { w: 26, f: undefined, o: 0.9 }].map((l, i) => (
            <motion.path key={i} d="M-40,120 C260,40 420,260 700,170 S1140,20 1480,140" fill="none" stroke="url(#rib)" strokeWidth={l.w} strokeLinecap="round"
              filter={l.f} opacity={l.o} style={{ pathLength: ribbon }} />
          ))}
        </svg>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
          className="relative z-10 mt-[12vh] flex max-w-[900px] flex-col items-center gap-6 px-4 text-center">
          <p className="text-[15px] italic text-[var(--soft)]">NASA Space Apps 2026 · 46 years of NASA climate data</p>
          <h1 className="font-display text-[clamp(44px,7vw,88px)] font-extralight leading-[1.02] tracking-tight">Is Earth really changing, or is it just luck?</h1>
          <p className="max-w-[620px] text-lg leading-relaxed text-[var(--soft)]">Check enough places and some will look like they&apos;re changing by pure chance. We show you which trends are real.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="#cases" className="btn btn-primary">Watch a demo case</a>
            <Link href="/explore" className="btn btn-ghost bg-[#070b1a]/60 backdrop-blur-md">Pick your own place</Link>
          </div>
        </motion.div>
        <motion.div style={{ y: globeY }} className="pointer-events-none absolute bottom-0 left-1/2 w-[min(1100px,135vw)] -translate-x-1/2 translate-y-[62%]">
          <Globe grid={grid} mode="real" spin zoom={false}
            label="A slowly spinning globe of NASA data. Orange shows places where air temperature rose since 1980 and passed every test." />
        </motion.div>
        <p className="absolute bottom-4 z-10 text-[12px] uppercase tracking-[0.16em] text-[var(--muted)]">Orange = proven warming since 1980 · scroll</p>
      </section>

      {/* Mission: a light band whose words light up as you scroll */}
      <section className="bleed relative overflow-hidden bg-[#f4f3f8] text-[#16161d]">
        <Stars className="opacity-60" />
        <div className="relative z-10 mx-auto max-w-[1100px] px-6 pb-[22vh] pt-[16vh] sm:px-10">
          <div className="flex gap-6">
            <span aria-hidden="true" className="mt-3 w-px shrink-0 bg-gradient-to-b from-[#8b5cf6] via-[#2dd4bf] to-transparent" />
            <ScrollLit className="font-display text-[clamp(26px,3.4vw,44px)] font-light leading-[1.25]"
              text="Every year the weather wobbles: a hot summer, a dry spring, a wet winter. Test **12,960 places** on Earth for a trend and **about 650 will look like they're changing** by pure luck. Trend Detective takes **46 years of NASA data** and puts every trend through **four checks** that luck can't pass, so anyone can tell the **signal** from the **noise.**" />
          </div>
          <div className="mt-[12vh] grid gap-8 border-t border-black/10 pt-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: s?.cells, c: "from-[#6d28d9] to-[#8b5cf6]", t: "places tested", d: "Squares about 200 km wide, covering the whole planet." },
              { n: s?.noise_sig, c: "from-[#d97706] to-[#f59e0b]", t: "false alarms", d: "Shuffled data with no trend still fooled a simple test this many times." },
              { n: s?.real_sig, c: "from-[#ea580c] to-[#f43f5e]", t: "places really warming", d: "Air temperature rose, and it survives every check for luck." },
              { n: meta?.years.length, c: "from-[#0d9488] to-[#2dd4bf]", t: "years of NASA data", d: "MERRA-2, every month from 1980 to 2025." },
            ].map((k, i) => (
              <motion.div key={k.t} {...rise(i)} className="flex flex-col gap-1.5 border-l border-black/10 pl-5">
                <p className={`bg-gradient-to-r bg-clip-text font-display text-[52px] font-light leading-none text-transparent ${k.c}`}>{k.n != null ? k.n.toLocaleString() : "…"}</p>
                <p className="font-medium">{k.t}</p>
                <p className="text-sm leading-normal text-[#55556a]">{k.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <Aurora />
        <GhostWord className="bottom-2 left-6 text-white">Signal</GhostWord>
      </section>

      {/* Demo cases */}
      <section id="cases" className="bleed relative scroll-mt-16 overflow-hidden">
        <Stars className="opacity-70" />
        <div className="relative z-10 mx-auto flex max-w-[1200px] flex-col gap-10 px-4 pb-[18vh] pt-[14vh] sm:px-8">
          <motion.div {...rise()} className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="font-display text-[clamp(44px,6vw,72px)] font-light leading-[0.95] tracking-tight">Open a<br /><span className="text-[var(--accent)]">case</span></h2>
            <p className="max-w-[420px] text-[17px] leading-relaxed text-[var(--soft)]">Three real places, three different answers. Each one walks you through the evidence in about a minute.</p>
          </motion.div>
          <div className="grid gap-5 md:grid-cols-3">
            {DEMOS.map((c, i) => {
              const d = cases[c.id]?.variables[c.v];
              return (
                <motion.div key={c.id} {...rise(i)}>
                  <Link href={`/explore?place=${c.place}&v=${c.v}&case=${c.id}`}
                    className="group flex h-full flex-col gap-4 rounded-[22px] border border-white/10 bg-white/[0.04] p-7 text-[var(--text)] no-underline backdrop-blur-md transition-all hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.07]">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] uppercase tracking-[0.14em] text-[var(--muted)]">Case 0{i + 1}</span>
                      <Badge tone={c.tone}>{c.tag}</Badge>
                    </div>
                    <h3 className="font-display text-[26px] font-light leading-tight">{c.title}</h3>
                    {d ? <Sparkline y={d.annual} trend={c.tone === "real" ? [d.intercept, d.intercept + (d.slope_decade / 10) * (d.annual.length - 1)] : undefined}
                      label={`${c.title}: yearly values 1980 to 2025`} /> : <div className="h-16" />}
                    <p className="text-[15px] leading-relaxed text-[var(--soft)]">{c.text}</p>
                    <span className="mt-auto inline-flex items-center gap-2 font-semibold text-[var(--accent)]">Open the case <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span></span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
        <Aurora className="opacity-40" />
        <GhostWord className="bottom-0 right-6 text-[var(--text)]">Cases</GhostWord>
      </section>

      {/* The four checks along a ribbon */}
      <section className="bleed relative overflow-hidden bg-[#f4f3f8] text-[#16161d]">
        <div className="relative z-10 mx-auto flex max-w-[1200px] flex-col gap-12 px-4 pb-[16vh] pt-[14vh] sm:px-8">
          <motion.div {...rise()} className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="font-display text-[clamp(44px,6vw,72px)] font-light leading-[0.95] tracking-tight">Four<br /><span className="text-[#7c3aed]">checks</span></h2>
            <p className="max-w-[440px] text-[17px] leading-relaxed text-[#55556a]">Every trend has to get past all of these before we call it real. Fail the strict one and it&apos;s &quot;not proven yet&quot;.</p>
          </motion.div>
          <div className="relative">
            <svg aria-hidden="true" viewBox="0 0 1200 260" preserveAspectRatio="none" className="absolute inset-x-0 top-6 hidden h-[260px] w-full md:block">
              <defs><linearGradient id="band" x1="0" x2="1"><stop offset="0" stopColor="#2dd4bf" /><stop offset="0.5" stopColor="#8b5cf6" /><stop offset="1" stopColor="#f97316" /></linearGradient></defs>
              <path d="M0,150 C200,60 360,220 600,130 S1000,40 1200,120 L1200,190 C1000,110 820,260 600,200 S180,130 0,220 Z" fill="url(#band)" opacity="0.9" />
            </svg>
            <ol className="relative m-0 grid list-none gap-6 p-0 md:grid-cols-4">
              {[
                ["Bigger than the wobble?", "Is the total change larger than a normal year's ups and downs?"],
                ["Survives shuffling?", "Scramble the years 2,000 times. Does random order do as well?"],
                ["Survives many tests?", "The strict one: corrected for testing thousands of places at once."],
                ["Holds up over time?", "Found in 1980–2002, still there in 2003–2025?"],
              ].map(([t, d], i) => (
                <motion.li key={t} {...rise(i)} className={`flex flex-col gap-3 rounded-[22px] bg-white/90 p-6 shadow-[0_20px_60px_-20px_rgba(76,29,149,0.35)] backdrop-blur ${i % 2 ? "md:mt-28" : ""}`}>
                  <span className="font-display text-4xl font-extralight text-[#7c3aed]">0{i + 1}</span>
                  <h3 className="font-display text-xl font-medium">{t}</h3>
                  <p className="text-[15px] leading-relaxed text-[#55556a]">{d}</p>
                </motion.li>
              ))}
            </ol>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/how" className="btn rounded-full bg-[#16161d] text-white hover:bg-black hover:text-white">How it works, in detail</Link>
            <Link href="/globe" className="btn border border-black/20 text-[#16161d] hover:bg-black/5 hover:text-[#16161d]">See all 12,960 places on the globe</Link>
          </div>
        </div>
        <GhostWord className="bottom-2 left-6 text-[#c4b5fd]">Method</GhostWord>
      </section>
    </div>
  );
}
