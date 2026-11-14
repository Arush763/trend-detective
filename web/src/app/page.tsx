"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { DEMOS, fmt, get, type Grid, type Meta, type Region } from "@/lib/data";
import { Globe } from "@/components/Globe";
import { Badge, Card, Sparkline } from "@/components/ui";

const rise = (i = 0) => ({ initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.45, delay: i * 0.08 } });

export default function Landing() {
  const [meta, setMeta] = useState<Meta>(null);
  const [grid, setGrid] = useState<Grid>(null);
  const [cases, setCases] = useState<Record<string, Region>>({});

  useEffect(() => {
    get("meta.json").then(setMeta);
    get("grid/T2M.json").then(setGrid);
    DEMOS.forEach((d) => get(`regions/${d.place}.json`).then((r) => setCases((c) => ({ ...c, [d.id]: r }))));
  }, []);
  const s = meta?.grid_summary.T2M;

  return (
    <div className="flex flex-col gap-24">
      <section className="flex flex-wrap items-center gap-12">
        <motion.div {...rise()} className="flex min-w-0 flex-[1_1_480px] flex-col gap-6">
          <p className="eyebrow">NASA Space Apps 2026 · NASA MERRA-2 data, 1980–2025</p>
          <h1 className="text-[44px] font-bold leading-[1.05] tracking-tight sm:text-[60px]">Is Earth really changing here, or is it just luck?</h1>
          <p className="max-w-[560px] text-[19px] leading-relaxed text-[var(--soft)]">
            Weather jumps around every year. Check enough places and some will look like they have a trend by pure chance.
            Trend Detective tests 46 years of NASA climate data in {s ? fmt(s.cells, 5) : "12,960"} places and tells you which changes are real.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#cases" className="btn btn-primary">Watch a demo case</a>
            <Link href="/explore" className="btn btn-ghost">Pick your own place</Link>
          </div>
        </motion.div>
        <figure className="m-0 flex min-w-0 flex-[1_1_420px] flex-col items-center gap-4">
          <div className="w-full max-w-[480px]">
            <Globe grid={grid} mode="real" spin zoom={false} label="Spinning globe. Orange squares are places where air temperature rose since 1980 and passed every test." />
          </div>
          <figcaption className="max-w-[420px] text-center text-sm text-[var(--muted)]">
            <span className="font-semibold text-[var(--up)]">Orange</span> = places where air temperature rose since 1980 and passed every test.
            {" "}<span className="font-semibold text-[var(--soft)]">Dark</span> = not proven. Drag to spin it.
          </figcaption>
        </figure>
      </section>

      <section aria-label="Key numbers" className="grid gap-5 md:grid-cols-3">
        {[
          { n: s?.cells, color: "", t: "places tested", d: "The whole planet, split into squares about 200 km wide." },
          { n: s?.noise_sig, color: "text-[var(--maybe)]", t: "false alarms from pure luck", d: "We shuffled every place's years into random order. A simple test still \"found\" a trend in this many." },
          { n: s?.real_sig, color: "text-[var(--up)]", t: "places with real warming", d: "Air temperature rose there, and the rise survives every check for luck." },
        ].map((k, i) => (
          <motion.div key={k.t} {...rise(i)}>
            <Card className="flex h-full flex-col gap-2 p-7">
              <p className={`font-display text-[44px] font-bold ${k.color}`}>{k.n != null ? k.n.toLocaleString() : "…"}</p>
              <p className="font-semibold">{k.t}</p>
              <p className="text-[15px] leading-normal text-[#a9b6d3]">{k.d}</p>
            </Card>
          </motion.div>
        ))}
      </section>

      <section id="cases" className="flex scroll-mt-6 flex-col gap-7">
        <div className="flex flex-col gap-2.5">
          <h2 className="text-4xl font-bold">Start with a case</h2>
          <p className="max-w-[640px] text-[17px] text-[#a9b6d3]">Three real places, three different answers. Each takes about a minute.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {DEMOS.map((c, i) => {
            const d = cases[c.id]?.variables[c.v];
            return (
              <motion.div key={c.id} {...rise(i)}>
                <Link href={`/explore?place=${c.place}&v=${c.v}&case=${c.id}`}
                  className={`flex h-full flex-col gap-4 rounded-[20px] border p-7 text-[var(--text)] no-underline transition-colors hover:bg-white/[0.06] ${c.tone === "real" ? "border-[var(--up)]/40 bg-gradient-to-b from-[var(--up)]/10 to-white/[0.03]" : "border-[var(--line)] bg-white/[0.04]"}`}>
                  <span className="self-start"><Badge tone={c.tone}>{c.tag}</Badge></span>
                  <h3 className="text-2xl font-semibold">{c.title}</h3>
                  {d ? <Sparkline y={d.annual} trend={c.tone === "real" ? [d.intercept, d.intercept + (d.slope_decade / 10) * (d.annual.length - 1)] : undefined}
                    label={`${c.title} yearly values 1980 to 2025`} /> : <div className="h-16" />}
                  <p className="text-base leading-relaxed text-[var(--soft)]">{c.text}</p>
                  <span className="mt-auto font-semibold text-[var(--accent)]">Open the case →</span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-7">
        <h2 className="text-4xl font-bold">How it works</h2>
        <ol className="m-0 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Pick a place", "Choose a desert, a rainforest, a big city or the Arctic. We suggest what to look at there, like dust in a desert."],
            ["Remove the seasons", "Summer is always hotter than winter. We average each year so only the change from year to year is left."],
            ["Test it three ways", "Is the change bigger than the normal wobble? Does it vanish when we shuffle the years? Does it survive checking thousands of places at once?"],
            ["Get a plain verdict", "Real signal, not proven yet, or no clear trend. If it's not proven, we estimate how many more years it would take."],
          ].map(([t, d], i) => (
            <motion.li key={t} {...rise(i)} className="flex flex-col gap-2.5">
              <p className="font-display text-[15px] font-semibold text-[var(--accent)]">Step {i + 1}</p>
              <h3 className="font-sans text-[19px] font-semibold">{t}</h3>
              <p className="text-[15px] leading-relaxed text-[#a9b6d3]">{d}</p>
            </motion.li>
          ))}
        </ol>
        <Link href="/how" className="self-start font-semibold">Read the full method →</Link>
      </section>

      <Card className="flex flex-col gap-6 p-9">
        <h2 className="text-[28px] font-bold">Three words you&apos;ll see</h2>
        <div className="grid gap-7 md:grid-cols-3">
          {[
            ["Signal", "text-[var(--up)]", "A real, lasting change, like the Arctic getting warmer decade after decade."],
            ["Noise", "text-[#c7d2fe]", "The normal ups and downs: one year is rainy, the next is dry, for no lasting reason."],
            ["False alarm", "text-[var(--maybe)]", "Noise that happens to line up and look like a trend. Test 100 random places and about 5 will do this."],
          ].map(([t, c, d]) => (
            <div key={t} className="flex flex-col gap-2">
              <h3 className={`font-sans text-lg ${c}`}>{t}</h3>
              <p className="text-[15px] leading-relaxed text-[var(--soft)]">{d}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
